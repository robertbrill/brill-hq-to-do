/* Vercel serverless function — serves the client Supabase config from env vars.
 *
 * A static site can't read Vercel Environment Variables directly, so the app
 * loads <script src="/config.js">, which vercel.json rewrites to this endpoint.
 * It emits ONLY the public URL + anon key (both safe in the browser; RLS is the
 * real protection). The service-role key is never read here and must never be
 * exposed to the client.
 *
 * Set in Vercel -> Project -> Settings -> Environment Variables:
 *   SUPABASE_URL        = https://<project-ref>.supabase.co
 *   SUPABASE_ANON_KEY   = <anon public key>
 * (NEXT_PUBLIC_* / VITE_* aliases are also accepted.)
 */
module.exports = (req, res) => {
  const env = process.env;
  const url =
    env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const anonKey =
    env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`window.BRILL_SUPABASE = ${JSON.stringify({ url, anonKey })};`);
};
