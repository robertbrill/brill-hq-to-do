# Brill HQ — Todo App

Single-file todo / project / notes dashboard for Brill Media ("HQ Tasks"). No build
step. The cloud edition (`index.html` + `supabase-db.js`, Vercel functions in `api/`)
is the live app; `todo-v2.html` + `todo-server.py` are the legacy Mac/Tailscale
edition. See `README.md` for the file map and `supabase/MIGRATION.md` for setup.

## Design system

The app's look is documented in `design/`:

- `design/DESIGN.md` — the spec: tokens, type scale, every row/card/control pattern,
  page templates, do/don't rules, behaviour notes.
- `design/brill-hq-design-reference.html` — a self-contained page that renders every
  pattern with the app's own CSS. Open it to see what "right" looks like.
- `design/FUNCTIONALITY.md` — what the app does: every view and action, the data
  model, sync and polling, reminders delivery, the assistant's tools, server functions.
- `design/brill-hq-functionality-reference.html` — the same, as a self-contained
  page with annotated screens and flows.

The CSS source of truth is the `<style>` block in `index.html`; the class names in
the docs are the app's real class names.

Use the `brill-hq-design` skill (`.claude/skills/brill-hq-design/SKILL.md`) when
adding or restyling any view. The short rules: white with three text grays, one blue
that means "action / on", red only for destructive or urgent, system font, rows that
touch with a hover fill, everything edited in place, one filled blue button per
surface.

## Conventions

- Vanilla HTML/CSS/JS. No frameworks, no bundler. UI lives in `index.html`; shared
  code goes in `lib/` (server) or `supabase-db.js` (client data).
- Rendering is string templates from `render*()` functions; interactions are
  `data-action` attributes handled by one delegated click listener. Escape user text
  with `escHtml()`.
- Data access goes through `BrillDB` in `supabase-db.js`; Row-Level Security is the
  privacy model, so never bypass the user's session.
- Serverless functions in `api/` verify the caller with `lib/verify-user.js`.
- `todo-data.js` and `todo-v2.html` are excluded from deploy via `.vercelignore`;
  don't add personal data to files that ship.
- Commit messages: imperative, prefixed by area when useful (`Tasks:`, `Notes:`,
  `SMS:`, `Design:`).
