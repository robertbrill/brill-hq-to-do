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
| `vercel.json` | Rewrites `/config.js` → the config function; schedules the reminder cron. |
| `api/assistant.js`, `api/send-reminders.js`, `lib/verify-user.js`, `sw.js`, `manifest.webmanifest` | Assistant chat + reminder push (see below). |

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

> The browser app never needs the `service_role` key, and `api/config.js` only
> ever emits the URL + anon key. The one server-side use is the reminder push
> cron (see *Assistant & reminders setup* below), which reads it from
> `SUPABASE_SERVICE_ROLE_KEY`.

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

## Assistant & reminders setup

Two features live behind extra config: the **Assistant** chat (Claude turns
plain English into tasks / projects / long notes / reminders) and **Reminders**
with push notifications.

### 1. Tables (once)

Re-run `supabase/schema.sql` in the Supabase SQL Editor. It's idempotent; the
new parts are the `reminders` and `push_subscriptions` tables (RLS, owned by
`auth.uid()` like everything else).

### 2. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `api/assistant.js` | Enables the Assistant. From console.anthropic.com. Without it the Assistant view shows a "not configured" notice. |
| `ASSISTANT_MODEL` | `api/assistant.js` | Optional. Defaults to `claude-opus-5`. |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/send-reminders.js` | Project Settings → API → `service_role`. **Server-only** — this is the only place it's used; it lets the cron read every user's due reminders. |
| `CRON_SECRET` | `api/send-reminders.js` | Any long random string (`openssl rand -hex 32`). Vercel sends it as the bearer token on cron calls; the function refuses anything else. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | push | Generate once: `npx web-push generate-vapid-keys`. The public half is also served to the browser via `/config.js`. |
| `VAPID_SUBJECT` | push | Optional. `mailto:you@example.com` or an https URL; defaults to the production deployment URL. |

Redeploy after adding them (env vars are read at deploy time for the cron
schedule and at request time for the rest).

### 3. How reminders are delivered

- **App open** (any device): the app polls every 30 s; a due reminder shows a
  toast and, if you've allowed notifications, a system notification.
- **App closed**: `vercel.json` runs `/api/send-reminders` every minute. It
  finds due, undelivered reminders and pushes them to every device where you
  clicked **Enable notifications on this device** (Reminders view). A reminder
  is only marked delivered once a push actually went out, so nothing is lost if
  you haven't enabled a device yet — it waits for you in the Reminders view.
- **iPhone / iPad**: Safari only allows Web Push for installed web apps. Share →
  **Add to Home Screen**, open HQ Tasks from the icon, then enable
  notifications inside it. (`manifest.webmanifest` + the iOS meta tags in
  `index.html` make it installable.)
- Repeating reminders (daily / weekdays / weekly / monthly) roll forward to the
  next occurrence after each delivery.

Per-minute cron schedules need a Vercel **Pro** plan (Hobby is once a day);
this project is on Pro.

### 4. Privacy note

The Assistant sends your message plus a compact summary of your workspace
(project names, note titles, pending reminder titles, current local time) to
the Anthropic API so it can file things in the right place. Note bodies and
task lists are not sent. Chat history is kept only in the browser
(`localStorage`), not in the database.

---

## Local development (optional)

To run `index.html` against Supabase from the Mac without Vercel:

```bash
cp config.example.js config.js   # fill in url + anonKey (git-ignored)
python3 -m http.server 8080      # or any static server; open /index.html
```

Locally, `/config.js` is served as the static file; on Vercel it's the function.
The `/api/*` functions (base tasks, Assistant, reminder push) only run under
`vercel dev` (with the env vars above in `.env.local`), not a plain static server.

---

## Known follow-ups (not blockers)

- ~~`todo-data.js` is served publicly.~~ **Resolved.** The base task list is now
  served only to a signed-in user by `api/base-tasks.js` (it verifies the Supabase
  access token before returning anything), and the old public `todo-data.js` /
  `todo-v2.html` are excluded from the deploy via `.vercelignore`.
- **In-file search for PDF/Word/Excel.** The old Python server extracted text
  from binary docs; the browser version only full-text-indexes plain-text files.
  Images and text files still upload and search by name. Adding pdf.js/mammoth is
  a future enhancement.
- **AI intake (`add-todo.sh`).** The old CLI posts to the Mac server. In the
  cloud app the Assistant view is the intake path (it writes to `inbox` /
  projects directly). A scripted intake can still insert into the Supabase
  `inbox` table (see `BrillDB.addInbox` for the shape).
- **Timestamps in unusual locales.** Migrated `created_at`/`updated_at` are parsed
  from the old app's stored values; if the Mac's locale wrote a non-US date string
  the migrator can't parse, that row falls back to the DB default (migration time).
  New edits in the cloud app store ISO timestamps, so this only affects pre-existing
  data and only the displayed date, never the content.
