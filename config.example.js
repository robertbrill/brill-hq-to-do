/* Brill HQ cloud config — copy this file to `config.js` and fill in your
   Supabase project's values. `config.js` is git-ignored.

   Both values are safe to expose in the browser: the anon key is designed for
   client-side use and Row-Level Security (every row owned by auth.uid()) is
   what actually protects the data. Find them in the Supabase dashboard under
   Project Settings -> API.

   For Vercel: because this is a private repo and these values are public-safe,
   the simplest path is to commit a real config.js (remove it from .gitignore),
   or generate it at deploy time. See supabase/MIGRATION.md. */

window.BRILL_SUPABASE = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
