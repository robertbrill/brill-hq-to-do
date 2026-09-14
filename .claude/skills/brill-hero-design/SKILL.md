---
name: brill-hero-design
description: Build or restyle UI in the Brill Media "Hero" look (V10.5) — navy heroes, blue action color, orange brand accents, Poppins, eyebrows, hairline lists. Use whenever adding a screen, view, panel, form, table, card, report or landing page to this app, or when the user mentions the Brill look, the design system, the design reference, or "make it match the other Brill tools".
---

# Brill "Hero" design skill

The full spec is `design/DESIGN.md`. The code is `design/brill-hero.css` (tokens + classes, scoped under `.bh`) and `design/brill-hero.js` (behaviors). `design/preview.html` shows every pattern rendered. Read `DESIGN.md` before building anything non-trivial; this file is the short version.

## Setup on a page

```html
<link rel="stylesheet" href="/design/fonts.css">
<link rel="stylesheet" href="/design/brill-hero.css">
<script src="/design/brill-hero.js" defer></script>
<body class="bh">
```

Put `class="bh"` on `<body>` or on the root of the region that should use this look. Use the `--bh-*` tokens; never hard-code a hex that already has a token. Do not add new colors, grays, radii or shadows.

## Build order for any page

1. **Shell**: `.shell-topbar` with `brill-logo.png` at 32px, `.shell-tabs` (active = navy + orange underline), actions far right with one `.btn-primary`.
2. **Dark hero**: `.hero-band` (introduces a tool), `.hero-card` + `.hero-meta` (names a subject, 3-up meta), or `.lp-hero` (chapter opener). Headline ends with `<span class="dot">.</span>`.
3. **Summary strip**: `.chips-row` or a `.stat-grid` with exactly one `.hl` tile.
4. **Sections**: each a `.panel` opening with a `.section-head` (eyebrow → h2 → right meta counter or a `data-bh-toggle` button). Two-column grids only inside a section.
5. **Close**: `.summary-box` (one paragraph + 3 stats) or `.cta-dark`.

## Pick the pattern

| Need | Use |
|------|-----|
| Ranked recommendations | `.num-list` (outlined blue numerals) |
| A branded process / product steps | `.step-list` (blue circles), inside `.panel-tint` |
| Things to do / done states | `.check-list` (green, the only place green appears); `<label class="check-item"><input type="checkbox">` for interactive |
| Deck-like findings | `.finding-row` rows in a `[data-bh-findings]` container |
| Flat enumeration inside a panel | `.panel-caps-title` + `.index-list` |
| Key numbers | `.stat-grid > .stat-tile`, `data-bh-count` to animate |
| Tabular data | `table.data` in `.table-scroll`; numbers in `.num`, totals in `tfoot` |
| Budget / share split | `.mix-row[data-bh-mix]` + `.progress[data-bh-progress]` |
| "The answer" the reader keeps | `.panel-tint` + `.quote-box` with a `data-bh-copy` button |
| Handoff to the next tool | `.cta-row` (copy left, one blue button right) |
| Intake form | `.form-head` + `.segmented` + `.form-cols` + underline `.field`s |
| Switching big content panels | `.navcards[data-bh-tabs]` with `data-target` |
| Secondary nav inside a page | `.subnav[data-bh-tabs]` (pipe-divided links) |
| List states (task status etc.) | `.pill.pill-gray|blue|green|orange|wine|navy` |
| Feedback | `BrillHero.toast()`, `.empty`, `.skeleton` |

## Hard rules (check before finishing)

- Blue is the action color; orange is brand only (logo, tab underline, mix bars). No orange buttons or body links.
- One filled blue button in view at a time. Buttons are 10px radius and never wrap.
- Every section opens with an eyebrow; every page opens with a navy hero; display headlines end with the blue period.
- Rows divide with hairlines, not boxes. Never nest a card inside a card.
- Exactly one `.hl` ring per group.
- Green only for checks/success; wine only for gaps/negatives.
- Paper-white with navy anchors. No dark mode, no heavy shadows.
- Poppins only: 400 body, 500 nav, 600 headings/labels, 700 titles/numbers. Launchpad titles are 600.
- Keep it responsive: the sheet collapses grids at 900px and 600px; don't add fixed widths.

## When re-rendering with JS

After you inject markup, call `BrillHero.init(container)` so tabs, toggles, copy buttons, progress bars and count-ups wire up. Behaviors are idempotent (they mark what they've wired).

## Verify

Open `design/preview.html` (or the page you built) in a browser and screenshot it at desktop and ~400px width. Compare against `DESIGN.md` § 10 before calling it done.
