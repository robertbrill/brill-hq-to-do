# Brill HQ — Todo App

Single-file todo / project / notes dashboard for Brill Media. No build step.
Cloud edition (`index.html` + `supabase-db.js`, Vercel functions in `api/`) is the
live app; `todo-v2.html` + `todo-server.py` are the legacy Mac/Tailscale edition.
See `README.md` for the file map and `supabase/MIGRATION.md` for setup.

## Design system

All UI work follows the Brill Media **"Hero" look**. It is documented and coded
in `design/`:

- `design/DESIGN.md` — the spec (tokens, type scale, every pattern, page
  templates, do/don't rules).
- `design/brill-hero.css` — tokens (`--bh-*`) and component classes, scoped
  under `.bh`.
- `design/brill-hero.js` — behaviors (tabs, collapsible sections, scroll-reveal
  findings, copy, progress, mix bars, toasts, number formatting).
- `design/fonts.css` + `design/fonts/` — self-hosted Poppins.
- `design/preview.html` — every pattern rendered; open it to eyeball changes.

Use the `brill-hero-design` skill (`.claude/skills/brill-hero-design/SKILL.md`)
when adding or restyling any screen. The short rules: blue is the action color,
orange is brand only, one filled blue button in view, eyebrows above every
section, navy hero at the top of every page, hairlines not boxes, Poppins only.

## Conventions

- Vanilla HTML/CSS/JS. No frameworks, no bundler. Keep new UI in the same file
  it belongs to unless it is shared (then `design/` or `lib/`).
- Data access goes through `BrillDB` in `supabase-db.js`; Row-Level Security is
  the privacy model, so never bypass the user's session.
- Serverless functions in `api/` verify the caller with `lib/verify-user.js`.
- `todo-data.js` and `todo-v2.html` are excluded from deploy via `.vercelignore`;
  don't add personal data to files that ship.
- Commit messages: imperative, prefixed by area when useful (`Tasks:`, `Notes:`,
  `SMS:`, `Design:`).
