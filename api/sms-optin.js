/* Vercel function — SMS enrollment (double opt-in), called by the app.
 *
 *   POST /api/sms-optin   Authorization: Bearer <supabase access token>
 *   { action: "start", phone: "+13105550123" }  -> saves the number as PENDING and
 *                                                  texts a confirmation the user must
 *                                                  answer YES to (handled by sms-inbound)
 *   { action: "resend" }                         -> re-sends the confirmation text
 *   { action: "stop" }                           -> turns texts off for this account
 *   -> { sms: { phone, status, requested_at, confirmed_at } }
 *
 * State is kept in the auth user's app_metadata (service-role only), so the
 * browser cannot mark a number confirmed itself.
 */
const { createClient } = require("@supabase/supabase-js");
const { verifyUser, jsonBody, supabaseEnv } = require("../lib/verify-user");
const { twilioEnv, isE164, sendSms, messages, TWILIO_BLOCKED, blockedHelp } = require("../lib/sms");

const RESEND_COOLDOWN_MS = 60 * 1000;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }

  const t = twilioEnv();
  const { url, serviceKey } = supabaseEnv();
  if (!t.enabled) { res.status(503).json({ error: "sms_not_configured", message: "Text messages aren't set up on the server yet (TWILIO_* env vars)." }); return; }
  if (!url || !serviceKey) { res.status(503).json({ error: "server_not_configured", message: "SUPABASE_SERVICE_ROLE_KEY is not set." }); return; }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: got, error: getErr } = await db.auth.admin.getUserById(user.id);
  if (getErr || !got || !got.user) { res.status(500).json({ error: "user_lookup_failed", message: getErr ? getErr.message : "no user" }); return; }
  const appMeta = got.user.app_metadata || {};
  const current = appMeta.sms || {};
  const body = jsonBody(req);
  const action = String(body.action || "");
  const now = new Date().toISOString();

  async function save(sms) {
    const { error } = await db.auth.admin.updateUserById(user.id, { app_metadata: { ...appMeta, sms } });
    if (error) throw error;
    return sms;
  }

  try {
    if (action === "start") {
      const phone = String(body.phone || "").trim();
      if (!isE164(phone)) { res.status(400).json({ error: "bad_phone", message: "Enter the number with country code, e.g. +13105550123." }); return; }
      if (!body.consent) { res.status(400).json({ error: "consent_required", message: "Please tick the consent box first." }); return; }
      const prev = appMeta.sms || null;
      const sms = await save({ phone, status: "pending", requested_at: now, consent_at: now, confirmed_at: null });
      try {
        await sendSms(phone, messages().confirm);
      } catch (e) {
        // The confirmation never went out, so "pending" would be a dead end:
        // the card would ask the user to reply YES to a text they never got.
        await save(prev).catch(() => { /* best effort — the send failure is what matters */ });
        if (e && e.twilioCode === TWILIO_BLOCKED) {
          res.status(409).json({ error: "number_opted_out", message: blockedHelp() });
          return;
        }
        throw e;
      }
      res.status(200).json({ sms });
      return;
    }
    if (action === "resend") {
      if (current.status !== "pending" || !isE164(current.phone)) { res.status(400).json({ error: "nothing_pending", message: "There's no pending confirmation to resend." }); return; }
      if (current.requested_at && Date.now() - Date.parse(current.requested_at) < RESEND_COOLDOWN_MS) {
        res.status(429).json({ error: "too_soon", message: "Give it a minute before resending." }); return;
      }
      const sms = await save({ ...current, requested_at: now });
      try {
        await sendSms(current.phone, messages().confirm);
      } catch (e) {
        await save(current).catch(() => { /* restore the old cooldown stamp */ });
        if (e && e.twilioCode === TWILIO_BLOCKED) {
          res.status(409).json({ error: "number_opted_out", message: blockedHelp() });
          return;
        }
        throw e;
      }
      res.status(200).json({ sms });
      return;
    }
    if (action === "stop") {
      const sms = await save({ phone: "", status: "off", requested_at: null, confirmed_at: null, stopped_at: now });
      res.status(200).json({ sms });
      return;
    }
    res.status(400).json({ error: "bad_action" });
  } catch (e) {
    res.status(502).json({ error: "sms_failed", message: (e && e.message) || "failed" });
  }
};
