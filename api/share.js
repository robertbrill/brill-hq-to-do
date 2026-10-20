/* Vercel function — private share links for one note, task, to-do or project.
 *
 * Owner actions (Authorization: Bearer <supabase access token>):
 *   POST /api/share { action: "create", kind, itemRef, title, content, passcode?, expiresInDays? }
 *        -> { share: { id, token, kind, item_ref, title, expires_at, has_passcode, views, ... } }
 *   POST /api/share { action: "update", id, title?, content?, passcode?, clearPasscode?, expiresInDays? }
 *        -> { share }   (refresh the shared copy and/or change its passcode / expiry)
 * Listing and turning links off go straight through RLS from the app (BrillDB).
 *
 * Public action (no login — this is what the /s/<token> page calls):
 *   POST /api/share { action: "view", token, passcode? }
 *        -> 200 { kind, title, content, updated_at }
 *        -> 401 { error: "passcode_required" | "wrong_passcode" }
 *        -> 429 { error: "locked" }        (too many wrong passcodes; try later)
 *        -> 404 { error: "not_found" }     (unknown, turned off, or expired — not told apart)
 *
 * Why this is private and not public: the shares table is owner-only under
 * RLS, so the anon key reads nothing. This function is the single way in for
 * someone without a login, and it answers only for an exact 192-bit token —
 * there is no listing, search or id lookup. A share holds a COPY of the item
 * made when it was shared (or last updated), never a pointer into the live
 * tables, so nothing else in the account can be reached through it.
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (same as reminders).
 */
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { verifyUser, jsonBody, supabaseEnv } = require("../lib/verify-user");

const KINDS = ["note", "task", "ptodo", "project"];
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;   // a very long note; Vercel caps bodies at 4.5MB
const MAX_DAYS = 365;
const MAX_FAILED = 5;                        // wrong passcodes in a row before a pause
const LOCK_MS = 15 * 60 * 1000;
const OWNER_COLS = "id, token, kind, item_ref, title, has_passcode, expires_at, views, last_viewed_at, created_at, updated_at";

function newId() { return "sh_" + crypto.randomBytes(8).toString("hex"); }
function newToken() { return crypto.randomBytes(24).toString("base64url"); }   // 32 chars, 192 bits

function hashPasscode(pass) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pass), salt, 32);
  return salt.toString("hex") + ":" + hash.toString("hex");
}

function passcodeMatches(pass, stored) {
  const [saltHex, hashHex] = String(stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, "hex");
  const got = crypto.scryptSync(String(pass || ""), Buffer.from(saltHex, "hex"), want.length);
  return crypto.timingSafeEqual(got, want);
}

function expiryFrom(days) {
  const n = Number(days);
  if (!n || n <= 0) return null;
  return new Date(Date.now() + Math.min(n, MAX_DAYS) * 86400000).toISOString();
}

function cleanContent(content) {
  const c = content && typeof content === "object" && !Array.isArray(content) ? content : {};
  const size = Buffer.byteLength(JSON.stringify(c), "utf8");
  return size > MAX_CONTENT_BYTES ? null : c;
}

const notFound = (res) => res.status(404).json({ error: "not_found", message: "This link has expired or been turned off." });

async function view(db, body, res) {
  const token = String(body.token || "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) { notFound(res); return; }
  const { data: row, error } = await db.from("shares")
    .select("id, kind, title, content, passcode_hash, expires_at, failed_attempts, locked_until, views, updated_at")
    .eq("token", token).maybeSingle();
  if (error) { res.status(500).json({ error: "lookup_failed" }); return; }
  if (!row) { notFound(res); return; }
  const now = Date.now();
  if (row.expires_at && Date.parse(row.expires_at) <= now) { notFound(res); return; }

  if (row.passcode_hash) {
    if (row.locked_until && Date.parse(row.locked_until) > now) {
      res.status(429).json({ error: "locked", message: "Too many wrong passcodes. Try again in a few minutes." });
      return;
    }
    const pass = String(body.passcode || "");
    if (!pass) { res.status(401).json({ error: "passcode_required" }); return; }
    if (!passcodeMatches(pass, row.passcode_hash)) {
      const failed = (row.failed_attempts || 0) + 1;
      const lock = failed >= MAX_FAILED;
      await db.from("shares").update({
        failed_attempts: lock ? 0 : failed,
        locked_until: lock ? new Date(now + LOCK_MS).toISOString() : row.locked_until,
      }).eq("id", row.id);
      res.status(lock ? 429 : 401).json(lock
        ? { error: "locked", message: "Too many wrong passcodes. Try again in a few minutes." }
        : { error: "wrong_passcode", message: "That passcode isn't right." });
      return;
    }
  }

  await db.from("shares").update({
    views: (row.views || 0) + 1, last_viewed_at: new Date(now).toISOString(), failed_attempts: 0, locked_until: null,
  }).eq("id", row.id);
  res.status(200).json({ kind: row.kind, title: row.title || "", content: row.content || {}, updated_at: row.updated_at });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }

  const { url, serviceKey } = supabaseEnv();
  if (!url || !serviceKey) { res.status(503).json({ error: "server_not_configured", message: "Sharing isn't set up on the server yet (SUPABASE_SERVICE_ROLE_KEY)." }); return; }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = jsonBody(req);
  const action = String(body.action || "");

  try {
    if (action === "view") { await view(db, body, res); return; }

    // Everything else is the owner managing their own links.
    const user = await verifyUser(req);
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }

    if (action === "create") {
      const kind = String(body.kind || "");
      if (!KINDS.includes(kind)) { res.status(400).json({ error: "bad_kind", message: "That can't be shared." }); return; }
      const content = cleanContent(body.content);
      if (!content) { res.status(413).json({ error: "too_large", message: "That's too large to share (2 MB max)." }); return; }
      const pass = String(body.passcode || "").trim();
      const row = {
        id: newId(), user_id: user.id, token: newToken(), kind,
        item_ref: String(body.itemRef || "").slice(0, 300),
        title: String(body.title || "").slice(0, 500),
        content,
        passcode_hash: pass ? hashPasscode(pass) : null,
        expires_at: expiryFrom(body.expiresInDays),
      };
      const { data, error } = await db.from("shares").insert(row).select(OWNER_COLS).single();
      if (error) throw error;
      res.status(200).json({ share: data });
      return;
    }

    if (action === "update") {
      const id = String(body.id || "");
      const { data: cur, error: getErr } = await db.from("shares").select("id, user_id").eq("id", id).maybeSingle();
      if (getErr) throw getErr;
      if (!cur || cur.user_id !== user.id) { res.status(404).json({ error: "not_found", message: "That link no longer exists." }); return; }
      const patch = { updated_at: new Date().toISOString() };
      if (body.content !== undefined) {
        const content = cleanContent(body.content);
        if (!content) { res.status(413).json({ error: "too_large", message: "That's too large to share (2 MB max)." }); return; }
        patch.content = content;
      }
      if (body.title !== undefined) patch.title = String(body.title || "").slice(0, 500);
      if (body.clearPasscode) patch.passcode_hash = null;
      else if (String(body.passcode || "").trim()) patch.passcode_hash = hashPasscode(String(body.passcode).trim());
      if (body.expiresInDays !== undefined) patch.expires_at = expiryFrom(body.expiresInDays);
      const { data, error } = await db.from("shares").update(patch).eq("id", id).eq("user_id", user.id).select(OWNER_COLS).single();
      if (error) throw error;
      res.status(200).json({ share: data });
      return;
    }

    res.status(400).json({ error: "bad_action" });
  } catch (e) {
    console.error("[share] " + (e && e.message ? e.message : e));
    res.status(500).json({ error: "share_failed", message: "Couldn't save the share link — try again." });
  }
};
