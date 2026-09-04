/* Vercel cron function — delivers due reminders as Web Push notifications.
 *
 * vercel.json schedules this every minute. Vercel calls it with
 * "Authorization: Bearer $CRON_SECRET", which we require (fail closed), so
 * nobody else can trigger sends. It reads every user's due, undelivered
 * reminders with the service-role key (this is the ONE place that key is
 * used; it never reaches the browser), pushes them to each of that user's
 * registered devices, and marks them delivered. Repeating reminders are
 * advanced to their next occurrence instead.
 *
 * A reminder is only marked delivered when at least one push actually went
 * out. If the user has no subscribed devices (or they've all expired) the
 * row stays pending, and the app itself shows it — with a toast and a
 * browser notification — the next time it's open. Dead subscriptions
 * (404/410 from the push service) are removed.
 *
 * Env: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL;
 *      defaults to the production deployment URL).
 * Generate the VAPID pair once with:  npx web-push generate-vapid-keys
 */

const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");
const { supabaseEnv, bearerToken } = require("../lib/verify-user");

const BATCH = 200;

// Every deliberate failure is logged so the cause shows up in Vercel's runtime
// logs (the cron's response body is never seen by anyone otherwise).
function fail(res, message) {
  console.error("[send-reminders] " + message);
  res.status(500).json({ error: message });
}

// Next occurrence strictly after `after` for a repeating reminder.
function nextOccurrence(dueIso, repeat, after) {
  let d = new Date(dueIso);
  if (Number.isNaN(d.getTime())) return null;
  const step = (x) => {
    const n = new Date(x);
    if (repeat === "daily") n.setUTCDate(n.getUTCDate() + 1);
    else if (repeat === "weekdays") {
      do { n.setUTCDate(n.getUTCDate() + 1); } while (n.getUTCDay() === 0 || n.getUTCDay() === 6);
    }
    else if (repeat === "weekly") n.setUTCDate(n.getUTCDate() + 7);
    else if (repeat === "monthly") {
      const day = n.getUTCDate();
      n.setUTCDate(1); n.setUTCMonth(n.getUTCMonth() + 1);
      const last = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).getUTCDate();
      n.setUTCDate(Math.min(day, last));
    }
    else return null;
    return n;
  };
  let guard = 0;
  while (d <= after && guard++ < 1000) { const n = step(d); if (!n) return null; d = n; }
  return d.toISOString();
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const secret = process.env.CRON_SECRET || "";
  if (!secret) { res.status(500).json({ error: "CRON_SECRET is not set" }); return; }
  if (bearerToken(req) !== secret) { res.status(401).json({ error: "unauthorized" }); return; }

  const { url, serviceKey } = supabaseEnv();
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || "";
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const missing = [
    !url && "SUPABASE_URL", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
    !vapidPublic && "VAPID_PUBLIC_KEY", !vapidPrivate && "VAPID_PRIVATE_KEY", !subject && "VAPID_SUBJECT",
  ].filter(Boolean);
  if (missing.length) { fail(res, "missing env: " + missing.join(", ")); return; }

  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const now = new Date();
  const { data: due, error } = await db.from("reminders").select("*")
    .is("fired_at", null).eq("done", false).lte("due_at", now.toISOString())
    .order("due_at", { ascending: true }).limit(BATCH);
  if (error) { fail(res, "reading reminders: " + error.message + (error.hint ? " (" + error.hint + ")" : "")); return; }
  if (!due || !due.length) { res.status(200).json({ checked: 0, sent: 0 }); return; }

  const userIds = [...new Set(due.map((r) => r.user_id))];
  const { data: subs, error: subErr } = await db.from("push_subscriptions").select("*").in("user_id", userIds);
  if (subErr) { fail(res, "reading push_subscriptions: " + subErr.message); return; }
  const subsByUser = {};
  (subs || []).forEach((s) => { (subsByUser[s.user_id] = subsByUser[s.user_id] || []).push(s); });

  const dead = new Set();
  let sent = 0, delivered = 0, pendingNoDevice = 0;
  const failures = [];

  for (const r of due) {
    const targets = subsByUser[r.user_id] || [];
    if (!targets.length) { pendingNoDevice++; continue; }
    const payload = JSON.stringify({
      id: r.id, title: r.title || "Reminder", body: r.notes || "",
      due_at: r.due_at, url: "/?view=reminders",
    });
    let ok = 0;
    await Promise.all(targets.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, payload, { TTL: 6 * 3600, urgency: "high" });
        ok++;
      } catch (e) {
        const code = e && e.statusCode;
        if (code === 404 || code === 410) dead.add(s.id);   // subscription expired / unsubscribed
        else failures.push({ reminder: r.id, status: code || 0, message: e && e.body ? String(e.body).slice(0, 200) : String(e && e.message) });
      }
    }));
    if (!ok) continue;   // leave it pending; the app shows it when opened
    sent += ok;
    delivered++;
    const next = r.repeat && r.repeat !== "none" ? nextOccurrence(r.due_at, r.repeat, now) : null;
    const patch = next
      ? { due_at: next, fired_at: null, last_fired_at: now.toISOString(), fired_via: "push" }
      : { fired_at: now.toISOString(), last_fired_at: now.toISOString(), fired_via: "push" };
    const { error: upErr } = await db.from("reminders").update(patch).eq("id", r.id);
    if (upErr) failures.push({ reminder: r.id, message: upErr.message });
  }

  if (dead.size) await db.from("push_subscriptions").delete().in("id", [...dead]);

  const summary = { checked: due.length, delivered, sent, pendingNoDevice, removedSubscriptions: dead.size, failures };
  if (failures.length) console.warn("[send-reminders]", JSON.stringify(summary));
  res.status(200).json(summary);
};

module.exports.nextOccurrence = nextOccurrence;
