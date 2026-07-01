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
| `config.example.js` | Template for local dev (`cp` to git-ignored `config.js`). |

**Privacy model changes.** The old app is Tailscale-only. The cloud app is on the
public internet, protected by a Supabase **login + Row-Level Security** (every row
owned by `auth.uid()`). Full setup, deploy and data-migration steps are in
[`supabase/MIGRATION.md`](supabase/MIGRATION.md).

> ⚠️ **Before sharing the Vercel URL:** `todo-data.js` (the static base task list,
> which contains names/emails/phone numbers) is served *before* login as a static
> file, so it's readable by anyone with the URL. Decide how to handle it — move the
> base tasks behind auth, drop the static Tasks view, or enable Vercel Deployment
> Protection. See the follow-ups in `supabase/MIGRATION.md`.

The old `todo-v2.html` + `todo-server.py` keep running on the Mac, untouched, until
the cloud version is verified.
