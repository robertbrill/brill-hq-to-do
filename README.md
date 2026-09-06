# Brill HQ — Todo App

A single-file todo / project / notes dashboard ("HQ Tasks"), self-hosted on a Mac
and reachable privately over Tailscale.

## What's here

| File | Purpose |
|------|---------|
| `todo-v2.html` | The entire app — UI, state, rendering (single file, no build step). |
| `todo-server.py` | Python stdlib server: serves the app, exposes `/api/state` and `/api/add-task`, restricts access to loopback + Tailscale. |
| `todo-data.js` | Legacy static task sections loaded by the app. |
| `add-todo.sh` | CLI used by the AI intake to append tasks (optionally tagged to a project). |
| `brill-logo.png`, `favicon-*.png`, `apple-touch-icon.png` | Branding / icons. |

## How it runs (current)

- The Mac runs `todo-server.py` on port 8080 (under launchd: `com.robert.ai-brill.todo-server`).
- `tailscale serve` fronts it with HTTPS at `https://<host>.ts.net/todo-v2.html` — **tailnet-only**.
- App state persists to `todo-state.json`; AI-added tasks land in `todo-inbox.json`.
  Both files are git-ignored (they hold real data).

## Access

Private by design: only devices on the Tailscale tailnet (or the Mac itself) can
connect. The server drops any other source IP and restricts CORS to the app's own
origins.

## Cloud edition (Supabase + Vercel)

The app is being moved off the Mac's Python server + JSON files onto **Supabase**
(Postgres + Auth + Storage), served as a static site on **Vercel**. The UI is the
same; only the storage layer changed.

| File | Role |
|------|------|
| `index.html` | The cloud app — a port of `todo-v2.html` with a login screen. |
| `supabase-db.js` | `BrillDB`: all Supabase reads/writes (auth, state, inbox, files). |
| `supabase/schema.sql` | Normalized tables + Row-Level Security + Storage bucket. |
| `supabase/migrate.mjs` | One-time importer: Mac JSON/files → Supabase. |
| `api/config.js` | Vercel function that serves `/config.js` from env vars. |
| `api/assistant.js` | Vercel function behind the **Assistant** view: Claude turns what you type (or dictate) into tasks / projects / long notes / reminders. |
| `api/send-reminders.js` | Vercel cron (every minute): sends due reminders as Web Push notifications. |
| `lib/verify-user.js` | Shared Supabase access-token check for the functions above. |
| `sw.js`, `manifest.webmanifest` | Service worker (receives push) + PWA manifest (lets iPhone install it, which iOS requires for push). |
| `config.example.js` | Template for local dev (`cp` to git-ignored `config.js`). |

**Privacy model changes.** The old app is Tailscale-only. The cloud app is on the
public internet, protected by a Supabase **login + Row-Level Security** (every row
owned by `auth.uid()`). Full setup, deploy and data-migration steps are in
[`supabase/MIGRATION.md`](supabase/MIGRATION.md).

The base task list (which contains names/emails/phone numbers) is **not** a public
file. It's served only to a signed-in user by `api/base-tasks.js`, which verifies
the caller's Supabase access token before returning anything. The old public
`todo-data.js` and `todo-v2.html` are excluded from the deploy via `.vercelignore`.

## Assistant & reminders

- **Assistant** (sidebar → Assistant): talk to the app. "Add a task to call Brad
  tomorrow", "start a project for the Q4 plan with these steps…", "write up
  these meeting notes as a long note", "remind me Friday at 9 to send the
  invoice". A Claude-backed function (`api/assistant.js`) decides what to file
  and the browser writes it through your own Supabase session, so RLS still
  applies. There's a mic button for dictation in browsers that support it.
- **Reminders** (sidebar → Reminders): everything scheduled, with Done / snooze.
  While the app is open, due reminders pop up as a toast + browser notification.
  Turn on **Enable notifications on this device** to also get them when the app
  is closed (Web Push, delivered by the `api/send-reminders.js` cron). On iPhone
  add the app to the Home Screen first. Save a mobile number under **Get
  reminders by text** to have them texted too (Twilio).
- **Tasks** can be sorted newest / oldest by date created, or grouped by section.

Setup (env vars, the two new tables, VAPID keys) is in
[`supabase/MIGRATION.md`](supabase/MIGRATION.md#assistant--reminders-setup).

The old `todo-v2.html` + `todo-server.py` keep running on the Mac, untouched, until
the cloud version is verified.
