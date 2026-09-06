/* Vercel serverless function — serves the client config from env vars.
 *
 * A static site can't read Vercel Environment Variables directly, so the app
 * loads <script src="/config.js">, which vercel.json rewrites to this endpoint.
 * It emits ONLY public-safe values: the Supabase URL + anon key (RLS is the
 * real protection), the Web Push VAPID *public* key, and whether the
 * assistant is configured. The service-role key, the Anthropic key and the
 * VAPID private key are never read here and must never reach the client.
 *
 * Set in Vercel -> Project -> Settings -> Environment Variables:
 *   SUPABASE_URL        = https://<project-ref>.supabase.co
 *   SUPABASE_ANON_KEY   = <anon public key>
 *   VAPID_PUBLIC_KEY    = <public half of `npx web-push generate-vapid-keys`>  (optional; enables push)
 *   ANTHROPIC_API_KEY   = <only its presence is reported here>                 (optional; enables the assistant)
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER (or TWILIO_MESSAGING_SERVICE_SID)
 *                       = <only "configured or not" is reported here>          (optional; enables SMS reminders)
 * (NEXT_PUBLIC_* / VITE_* aliases are also accepted for the Supabase values.)
 */
module.exports = (req, res) => {
  const env = process.env;
  const url =
    env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const anonKey =
    env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  const vapidPublicKey = env.VAPID_PUBLIC_KEY || "";
  const assistant = !!env.ANTHROPIC_API_KEY;
  const sms = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID));
  const smsNumber = env.TWILIO_FROM_NUMBER || "";          // shown in the opt-in copy ("text REMIND to …")
  const smsContact = env.SMS_CONTACT_EMAIL || "";          // support contact shown in SMS terms / HELP

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`window.BRILL_SUPABASE = ${JSON.stringify({ url, anonKey, vapidPublicKey, assistant, sms, smsNumber, smsContact })};`);
};
