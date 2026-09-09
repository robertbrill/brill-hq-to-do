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
 * Channels (at least one must be configured):
 *   Web Push  — VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or
 *               https: URL; defaults to the production deployment URL).
 *               Generate the pair once with:  npx web-push generate-vapid-keys
 *   SMS       — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_FROM_NUMBER
 *               (your Twilio number, E.164) or TWILIO_MESSAGING_SERVICE_SID. Texts go
 *               only to a number the user enrolled in the Reminders view AND
 *               confirmed by replying YES (app_metadata.sms.status = "confirmed";
 *               see api/sms-optin.js and api/sms-inbound.js).
 * Always: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");
const { supabaseEnv, bearerToken } = require("../lib/verify-user");
const smsLib = require("../lib/sms");

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

  const env = process.env;
  const { url, serviceKey } = supabaseEnv();
  const appUrl = env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
  const vapidPublic = env.VAPID_PUBLIC_KEY || "", vapidPrivate = env.VAPID_PRIVATE_KEY || "";
  const subject = env.VAPID_SUBJECT || appUrl;
  const pushEnabled = !!(vapidPublic && vapidPrivate && subject);
  const smsEnabled = smsLib.twilioEnv().enabled;

  const missing = [!url && "SUPABASE_URL", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  if (!pushEnabled && !smsEnabled) missing.push("a delivery channel (VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY for push, or TWILIO_* for SMS)");
  if (missing.length) { fail(res, "missing env: " + missing.join(", ")); return; }

  if (pushEnabled) webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Only a number the user enrolled AND confirmed by replying YES gets texts.
  const phoneCache = {};
  async function phoneFor(userId) {
    if (!smsEnabled) return "";
    if (userId in phoneCache) return phoneCache[userId];
    let phone = "";
    try {
      const { data } = await db.auth.admin.getUserById(userId);
      const sms = data && data.user && data.user.app_metadata ? data.user.app_metadata.sms : null;
      if (sms && sms.status === "confirmed" && smsLib.isE164(sms.phone)) phone = sms.phone;
    } catch (e) { phone = ""; }
    return (phoneCache[userId] = phone);
  }

  // Mirror a carrier-level opt-out into our own state, and drop the cached
  // number so the rest of this run stops texting it.
  async function markOptedOut(userId, phone) {
    phoneCache[userId] = "";
    try {
      const { data } = await db.auth.admin.getUserById(userId);
      const meta = (data && data.user && data.user.app_metadata) || {};
      const sms = meta.sms || {};
      if (sms.phone !== phone || sms.status === "stopped") return;   // already handled, or moved on
      await db.auth.admin.updateUserById(userId, {
        app_metadata: { ...meta, sms: { ...sms, status: "stopped", stopped_at: new Date().toISOString() } },
      });
    } catch (e) { console.error("[send-reminders] markOptedOut: " + ((e && e.message) || e)); }
  }

  const now = new Date();
  const { data: due, error } = await db.from("reminders").select("*")
    .is("fired_at", null).eq("done", false).lte("due_at", now.toISOString())
    .order("due_at", { ascending: true }).limit(BATCH);
  if (error) { fail(res, "reading reminders: " + error.message + (error.hint ? " (" + error.hint + ")" : "")); return; }
  if (!due || !due.length) { res.status(200).json({ checked: 0, sent: 0 }); return; }

  const userIds = [...new Set(due.map((r) => r.user_id))];
  const subsByUser = {};
  if (pushEnabled) {
    const { data: subs, error: subErr } = await db.from("push_subscriptions").select("*").in("user_id", userIds);
    if (subErr) { fail(res, "reading push_subscriptions: " + subErr.message); return; }
    (subs || []).forEach((s) => { (subsByUser[s.user_id] = subsByUser[s.user_id] || []).push(s); });
  }

  const dead = new Set();
  let sent = 0, smsSent = 0, delivered = 0, pendingNoDevice = 0, optedOut = 0;
  const failures = [];

  for (const r of due) {
    const targets = subsByUser[r.user_id] || [];
    const phone = await phoneFor(r.user_id);
    if (!targets.length && !phone) { pendingNoDevice++; continue; }
    const title = r.title || "Reminder";
    const via = [];

    // Web Push to every enabled device
    if (targets.length) {
      const payload = JSON.stringify({ id: r.id, title, body: r.notes || "", due_at: r.due_at, url: "/?view=reminders" });
      let ok = 0;
      await Promise.all(targets.map(async (s) => {
        try {
          await webpush.sendNotification(s.subscription, payload, { TTL: 6 * 3600, urgency: "high" });
          ok++;
        } catch (e) {
          const code = e && e.statusCode;
          if (code === 404 || code === 410) dead.add(s.id);   // subscription expired / unsubscribed
          else failures.push({ reminder: r.id, channel: "push", status: code || 0, message: e && e.body ? String(e.body).slice(0, 200) : String(e && e.message) });
        }
      }));
      if (ok) { sent += ok; via.push("push"); }
    }

    // SMS to the saved number
    if (phone) {
      try { await smsLib.sendSms(phone, smsLib.messages().reminder(title, r.notes)); smsSent++; via.push("sms"); }
      catch (e) {
        // A number that replied STOP is blocked at Twilio, and nothing we do
        // here can undo that. Left alone the enrollment stays "confirmed" and
        // every future reminder fails the same way, while the app goes on
        // claiming texts are on. Record the opt-out so the card tells the
        // truth and the sends stop.
        if (e && e.twilioCode === smsLib.TWILIO_BLOCKED) { await markOptedOut(r.user_id, phone); optedOut++; }
        failures.push({ reminder: r.id, channel: "sms", message: String(e && e.message).slice(0, 200) });
      }
    }

    if (!via.length) continue;   // nothing got through: leave it pending; the app shows it when opened
    delivered++;
    const next = r.repeat && r.repeat !== "none" ? nextOccurrence(r.due_at, r.repeat, now) : null;
    const patch = next
      ? { due_at: next, fired_at: null, last_fired_at: now.toISOString(), fired_via: via.join("+") }
      : { fired_at: now.toISOString(), last_fired_at: now.toISOString(), fired_via: via.join("+") };
    const { error: upErr } = await db.from("reminders").update(patch).eq("id", r.id);
    if (upErr) failures.push({ reminder: r.id, message: upErr.message });
  }

  if (dead.size) await db.from("push_subscriptions").delete().in("id", [...dead]);

  const summary = { checked: due.length, delivered, pushSent: sent, smsSent, pendingNoDevice, optedOut, removedSubscriptions: dead.size, failures };
  if (failures.length) console.warn("[send-reminders]", JSON.stringify(summary));
  res.status(200).json(summary);
};

module.exports.nextOccurrence = nextOccurrence;
