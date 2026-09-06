/* Shared SMS bits for the Vercel functions: Twilio config, sending, the
 * compliance message copy, and webhook signature validation.
 *
 * Enrollment is double opt-in and the state lives in the auth user's
 * app_metadata.sms = { phone, status, requested_at, confirmed_at } —
 * app_metadata can only be written with the service-role key (never by the
 * browser), so a number is only ever "confirmed" after its owner replied YES.
 */
const crypto = require("crypto");

function twilioEnv() {
  const e = process.env;
  const sid = e.TWILIO_ACCOUNT_SID || "", token = e.TWILIO_AUTH_TOKEN || "";
  const from = e.TWILIO_FROM_NUMBER || "", service = e.TWILIO_MESSAGING_SERVICE_SID || "";
  return {
    sid, token, from, service,
    enabled: !!(sid && token && (from || service)),
    apiBase: e.TWILIO_API_BASE || "https://api.twilio.com",   // overridable for tests
    contact: e.SMS_CONTACT_EMAIL || "",
    appUrl: e.SMS_APP_URL || (e.VERCEL_PROJECT_PRODUCTION_URL ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}` : ""),
  };
}

function isE164(p) { return /^\+\d{8,15}$/.test(String(p || "")); }

async function sendSms(to, body) {
  const t = twilioEnv();
  if (!t.enabled) throw new Error("SMS is not configured (TWILIO_* env vars)");
  const params = new URLSearchParams({ To: to, Body: body });
  if (t.service) params.set("MessagingServiceSid", t.service); else params.set("From", t.from);
  const r = await fetch(`${t.apiBase}/2010-04-01/Accounts/${encodeURIComponent(t.sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${t.sid}:${t.token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!r.ok) {
    let msg = `Twilio HTTP ${r.status}`;
    try { const j = await r.json(); if (j && j.message) msg += `: ${j.message}`; } catch (e) { /* keep status */ }
    throw new Error(msg);
  }
}

// The program copy. Keep these in step with sms-opt-in.html (the public
// collateral page) — carriers compare the two.
const PROGRAM = "Brill HQ Reminders";
const FOOTER = "Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.";
function messages() {
  const t = twilioEnv();
  const terms = t.appUrl ? ` Terms: ${t.appUrl}/sms-terms.html` : "";
  const support = t.contact ? ` Support: ${t.contact}.` : "";
  return {
    confirm: `${PROGRAM}: Reply YES to confirm you want your scheduled reminders texted to this number. ${FOOTER}${terms}`,
    welcome: `${PROGRAM}: You're confirmed. We'll text you each reminder you schedule in Brill HQ. ${FOOTER}${terms}`,
    already: `${PROGRAM}: This number is already confirmed for reminder texts. ${FOOTER}`,
    help: `${PROGRAM}: We text you the reminders you schedule in your Brill HQ account.${support} ${FOOTER}`,
    stopped: `${PROGRAM}: You've been unsubscribed and will receive no further texts. Reply START to re-subscribe.`,
    unknown: `${PROGRAM}: To get reminder texts, sign in at ${t.appUrl || "the Brill HQ app"}, open Reminders and add this number. ${FOOTER}`,
    reminder(title, notes) {
      return `${PROGRAM}: ${title}${notes ? "\n" + String(notes).slice(0, 300) : ""}${t.appUrl ? "\n" + t.appUrl + "/?view=reminders" : ""}\nReply STOP to cancel.`;
    },
  };
}

// Twilio signs webhook requests: base64(HMAC-SHA1(authToken, url + concat(sorted key+value))).
function validateTwilioSignature(req, params) {
  const t = twilioEnv();
  const sig = req.headers["x-twilio-signature"] || "";
  if (!t.token || !sig) return false;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers["host"] || "").split(",")[0].trim();
  const url = `${proto}://${host}${req.url}`;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", t.token).update(Buffer.from(data, "utf8")).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Twilio posts application/x-www-form-urlencoded; Vercel usually parses it
// into req.body already, but accept the raw string too.
function formBody(req) {
  const b = req.body;
  if (b == null) return {};
  if (typeof b === "string") return Object.fromEntries(new URLSearchParams(b));
  if (Buffer.isBuffer(b)) return Object.fromEntries(new URLSearchParams(b.toString("utf8")));
  return b;
}

function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function twiml(text) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${text ? `<Message>${escapeXml(text)}</Message>` : ""}</Response>`;
}

module.exports = { twilioEnv, isE164, sendSms, messages, validateTwilioSignature, formBody, twiml, PROGRAM };
