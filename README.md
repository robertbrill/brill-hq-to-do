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

## Data → Supabase (in progress)

The JSON-file storage is being migrated to Supabase for durability while keeping the
same Tailscale-private hosting. See `supabase/` for the schema and migration once added.
