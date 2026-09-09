/* Vercel function — Twilio "A message comes in" webhook for the reminders number.
 *
 * Configure in Twilio Console -> Phone Numbers -> your number -> Messaging ->
 * "A message comes in": Webhook, HTTP POST, https://<your app>/api/sms-inbound
 *
 * Handles the compliance keywords for the double opt-in flow:
 *   YES / START / CONFIRM          -> confirms a pending number (or re-subscribes) and
 *                                      sends the welcome message
 *   STOP family                     -> records the opt-out locally; we stay silent.
 *                                      A US toll-free number always unsubscribes the
 *                                      sender at the carrier level and returns its own
 *                                      confirmation, which a custom message cannot
 *                                      replace, and the number is blocked from that
 *                                      moment (outbound fails with 21610). Only START
 *                                      or UNSTOP undoes it — YES does not.
 *   HELP / INFO                     -> Twilio replies with its standard help text; we
 *                                      stay silent so the user gets one message
 *   anything else                   -> a short pointer to the app
 * Every request is checked against Twilio's X-Twilio-Signature (fail closed).
 */
const { createClient } = require("@supabase/supabase-js");
const { supabaseEnv } = require("../lib/verify-user");
const { validateTwilioSignature, formBody, twiml, messages, isE164 } = require("../lib/sms");

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const HELP_WORDS = new Set(["HELP", "INFO"]);
const YES_WORDS = new Set(["YES", "Y", "START", "UNSTOP", "CONFIRM", "SUBSCRIBE"]);

// Find the account whose SMS enrollment uses this number (a single-user app,
// so a short scan of auth users is fine).
async function userForPhone(db, phone) {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data || !data.users || !data.users.length) return null;
    const hit = data.users.find((u) => u.app_metadata && u.app_metadata.sms && u.app_metadata.sms.phone === phone);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).send("method not allowed"); return; }
  const params = formBody(req);
  if (!validateTwilioSignature(req, params)) { res.status(403).send("bad signature"); return; }

  const from = String(params.From || "");
  const word = String(params.Body || "").trim().toUpperCase().split(/\s+/)[0] || "";
  const reply = (text) => { res.setHeader("Content-Type", "text/xml"); res.status(200).send(twiml(text)); };
  const msg = messages();

  const { url, serviceKey } = supabaseEnv();
  if (!url || !serviceKey || !isE164(from)) { reply(""); return; }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const user = await userForPhone(db, from);
  const now = new Date().toISOString();
  const setSms = async (sms) => {
    if (!user) return;
    await db.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), sms } });
  };
  const sms = user ? user.app_metadata.sms : null;

  try {
    if (STOP_WORDS.has(word)) {
      if (sms) await setSms({ ...sms, status: "stopped", stopped_at: now });
      reply("");   // the carrier's own STOP confirmation is the only one that lands
      return;
    }
    if (HELP_WORDS.has(word)) { reply(""); return; }   // Twilio's standard HELP reply
    if (YES_WORDS.has(word)) {
      if (!sms) { reply(msg.unknown); return; }
      if (sms.status === "confirmed") { reply(msg.already); return; }
      await setSms({ ...sms, status: "confirmed", confirmed_at: now });
      reply(msg.welcome);
      return;
    }
    reply(sms && sms.status === "confirmed" ? msg.help : msg.unknown);
  } catch (e) {
    console.error("[sms-inbound] " + ((e && e.message) || e));
    reply("");
  }
};
