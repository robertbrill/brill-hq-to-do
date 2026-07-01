# Brill HQ — Cloud migration (Supabase + Vercel)

This moves the todo app off the Mac's Python server + JSON files and onto
**Supabase** (Postgres + Auth + Storage) served by a static app on **Vercel**.
The app UI is unchanged; only the storage layer swapped.

- **Old:** `todo-v2.html` + `todo-server.py`, JSON files, Tailscale-private.
- **New:** `index.html` + `supabase-db.js`, normalized tables, gated by a
  Supabase login. Privacy now comes from **login + Row-Level Security**, not the
  network.

The old app on the Mac keeps working, untouched, until you've verified the new one.

---

## What's in the repo

| File | Role |
|------|------|
| `index.html` | The cloud app (port of `todo-v2.html` with a login screen). |
| `supabase-db.js` | `BrillDB` — all Supabase reads/writes (auth, state, inbox, files). |
| `supabase/schema.sql` | The tables + RLS + Storage bucket (already run ✅). |
| `supabase/migrate.mjs` | One-time importer: Mac JSON/files → Supabase. |
| `api/config.js` | Vercel function that serves `/config.js` from env vars. |
| `config.example.js` | Template for **local** dev config (copy to `config.js`). |
| `vercel.json` | Rewrites `/config.js` → the config function. |

---

## Step 1 — Create your login (once)

Supabase dashboard → **Authentication → Users → Add user** → your email +
a password. (Or enable email sign-ups.) This is the account the app signs into
and that owns all your data. Disable public sign-ups afterward if you want it
single-user.

## Step 2 — Deploy to Vercel

You've already added the environment variables in Vercel. Make sure they're
named (any one of these aliases works):

```
SUPABASE_URL       = https://<project-ref>.supabase.co
SUPABASE_ANON_KEY  = <anon public key>        # Project Settings → API
```

> Do **not** put the `service_role` key in Vercel — the app never needs it, and
> `api/config.js` only ever emits the URL + anon key.

Then:

1. Import this repo into Vercel as a **new project**.
2. Framework preset: **Other** (no build step — it's static + one function).
   Leave build command empty; output directory = repo root.
3. Deploy. The app is served at `/` (`index.html`); `/config.js` is generated
   from your env vars by `api/config.js`.

Open the deployment URL → you should see the **Sign in** screen → log in with
the account from Step 1. It'll be empty until Step 3.

## Step 3 — Migrate your data (run once, on the Mac)

The migration reads the Mac's live files, so run it there. From the repo:

```bash
cd supabase
npm install                     # installs @supabase/supabase-js locally
cd ..

SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
MIGRATE_EMAIL=you@example.com \
MIGRATE_PASSWORD='your-login-password' \
DATA_DIR=/path/to/ai-brill-todo \
node supabase/migrate.mjs
```

`DATA_DIR` is the folder holding `todo-state.json`, `todo-inbox.json`,
`todo-files.json` and `uploads/` (defaults to the current directory). It signs
in as you and upserts projects, to-dos, long notes, task-overrides, inbox and
uploaded files. Re-running is safe for everything except inbox rows (they'd
duplicate), so run it once.

Reload the Vercel app → your 32 projects / 20 notes / files should be there.

## Step 4 — Verify, then retire the old app

Click through Tasks, Projects, Long Notes, Files; upload a test file; add an
inbox task; open on a second device to confirm live sync. Once happy, stop the
Mac `launchd` server (`com.robert.ai-brill.todo-server`) at your leisure.

---

## Local development (optional)

To run `index.html` against Supabase from the Mac without Vercel:

```bash
cp config.example.js config.js   # fill in url + anonKey (git-ignored)
python3 -m http.server 8080      # or any static server; open /index.html
```

Locally, `/config.js` is served as the static file; on Vercel it's the function.

---

## Known follow-ups (not blockers)

- **`todo-data.js` is served publicly.** The base task list (with names, emails,
  phone numbers) loads *before* login as a static file, so anyone with the Vercel
  URL could read it. Options: (a) move the base tasks into a DB table behind auth,
  (b) drop the static Tasks view, or (c) add Vercel Deployment Protection. See the
  README note — decide before sharing the URL widely.
- **In-file search for PDF/Word/Excel.** The old Python server extracted text
  from binary docs; the browser version only full-text-indexes plain-text files.
  Images and text files still upload and search by name. Adding pdf.js/mammoth is
  a future enhancement.
- **AI intake (`add-todo.sh`).** The old CLI posts to the Mac server. To keep AI
  task intake working against the cloud, insert into the Supabase `inbox` table
  instead (see `BrillDB.addInbox` for the shape). Not wired yet.
- **`updated_at` on edits.** Saves don't bump `updated_at` (to avoid marking every
  row "edited" on each full sync). Add a Postgres `updated_at = now()` trigger if
  you want live edit timestamps.
