# Brill Media · "Hero" design system (V10.5)

The layout language behind the Client Diagnostic, Media Planner and report views.
This document is the human-readable source of truth; the code lives next to it:

| File | What it is |
|------|------------|
| `design/brill-hero.css` | Tokens (`--bh-*`) + every component class, scoped under `.bh`. |
| `design/brill-hero.js` | Behaviors: tabs, collapsible sections, scroll-reveal findings, copy, progress, mix bars, toasts, number formatting. |
| `design/fonts.css` + `design/fonts/` | Self-hosted Poppins 400/500/600/700 (Latin subset). |
| `design/preview.html` | Every pattern rendered once. Open it to check your work. |
| `.claude/skills/brill-hero-design/SKILL.md` | The same rules, written for Claude Code. |

Wire it up:

```html
<link rel="stylesheet" href="/design/fonts.css">
<link rel="stylesheet" href="/design/brill-hero.css">
<script src="/design/brill-hero.js" defer></script>
<body class="bh"> … </body>
```

---

## 1 · Foundations

### Color

| Token | Hex | Job |
|-------|-----|-----|
| `--bh-navy-deep` | `#12182E` | Hero gradient base, darkest surface |
| `--bh-navy` | `#1B2447` | Headings, dark bands, table headers |
| `--bh-navy-soft` | `#2B345A` | Secondary dark fills |
| `--bh-blue` | `#3A8ECD` | **The action color**: buttons, links, active states, numerals, the heading period |
| `--bh-blue-deep` | `#2E75AC` | Button hover |
| `--bh-blue-numeral` | `#A9CDE9` | Big decorative numerals, eyebrows on navy |
| `--bh-blue-soft` | `#D9E9F5` | Tinted chips, soft borders |
| `--bh-blue-tint` | `#EFF6FC` | Highlight panel background |
| `--bh-orange` | `#E89147` | **The brand color**: logo, active tab underline, mix bars |
| `--bh-orange-deep` | `#D97E33` | Prose links inside the author box, hovers |
| `--bh-green` | `#2E9E63` | Checkmarks and success. Nowhere else. |
| `--bh-wine` | `#98424F` | Gaps / negative flags. Sparingly. |
| `--bh-ink` | `#14192B` | Primary text on white |
| `--bh-ink-2` | `#4A5070` | Body copy |
| `--bh-ink-3` | `#8A90A8` | Eyebrows on white, meta, captions |
| `--bh-page` | `#EEF1F6` | App canvas behind white cards |
| `--bh-border` | `#E3E7EE` | Card and table borders |
| `--bh-hairline` | `#EDF0F4` | Row dividers |

Ratio guide: ~70% white/page neutrals · ~20% navy · ~8% blue · ~2% orange.
Orange is *brand*, blue is *action*. Never swap their jobs.

### Typography — Poppins everywhere

| Role | Size / weight / tracking |
|------|--------------------------|
| Hero title | 38–46px / 700 / −0.03em, line-height 1.05 |
| Launchpad title | 64–90px / **600** (not 700 at this scale) |
| Section title | 22–26px / 700 / −0.02em |
| Card heading | 16–18px / 600 |
| Body | 13–14px / 400 / line-height 1.6–1.75, `ink-2` |
| Author-box body | 16.5px / 1.75 (deliberately airier) |
| Eyebrow | 10–11px / 600 / caps / 0.22em |
| Stat number | 28–40px / 700 / −0.03em |
| Table header | 10px / 600 / caps / 0.14em |

Signature moves: display headlines end with a **blue period** (`<span class="dot">.</span>`, or `?` for questions) · every section opens with an eyebrow · hierarchy comes from weight + tracking, not extra colors. Weights: 400 body, 500 nav, 600 headings/labels, 700 titles/numbers.

### Shape and elevation

- Radii: chips/pills `100px` · buttons and inner blocks `8–10px` · cards/tables `10–14px` · feature boxes (author box) `18px`.
- Borders: 1px `border` on every card; rows divide with 1px `hairline`. Never boxes inside boxes.
- Shadow, barely there: `0 1px 3px rgba(18,24,46,.05), 0 10px 30px rgba(18,24,46,.05)`.
- The **highlight ring** `0 0 0 3px rgba(58,142,205,.12)` + blue border marks exactly one item per group (`.hl`).
- Rhythm: content max-width 1180–1280px · sections pad 44–56px horizontally · 28px between sections · white sections sit on the `#EEF1F6` canvas.

---

## 2 · App shell and navigation

- **Topbar** `.shell-topbar`: white, 1px border, sticky (`.sticky`). Real logo lockup (`brill-logo.png`) at 32px tall, never a placeholder tile. Tabs `.shell-tabs`: 12.5px/500 ink-2; active is navy 600 with a 2px **orange** underline. Actions far right: outline for secondary saves, one filled blue primary. Labels never wrap.
- **Sub-menu** `.subnav`: plain links separated by 1px pipes. Active and hover go blue. No underlines, no pills.
- **Icon nav cards** `.navcards > .navcard`: 12px-radius outline cards, icon + 13.5px/600 label, 4-up grid. Active gets the blue border + glow ring.
- **Buttons** `.btn` + `btn-primary | btn-outline | btn-soft | btn-dark | btn-ghost | btn-glass`: 10px corners, `white-space: nowrap`. One filled blue button in view at a time; it carries the soft blue shadow and a 1px hover lift. Dark navy only inside CTA bands; glass only on navy.
- **Version badge** `.version-badge.fixed`: gray caps label + navy pill, bottom-right of the viewport.

## 3 · Hero patterns

| Pattern | Class | Use |
|---------|-------|-----|
| A · Page hero band | `.hero-band` | Introduces a tool. Navy gradient 180° with two radial blue glows. Full-bleed (`.bleed`) at the top of a page or rounded as a card. |
| B · Report hero card | `.hero-card` + `.hero-meta` | Names the subject, then a 3-up meta row (THE GOAL / THE NEED / THE OPPORTUNITY) divided by `rgba(255,255,255,.14)` hairlines. Keys 9.5px caps light blue, values 13px/600 white clamped to 2 lines. Swap for `.hero-flight` (FLIGHT · MARKET · TARGET) on planner pages. |
| C · Inputs chip row | `.chips-row` + `.chip` | Echoes what the user entered, between the band and the card. First chip (the subject) is `.strong`; the edit affordance is a `.btn-ghost.edit` on the right. |
| D · Launchpad hero | `.lp-hero` + `.glass-stats` | The biggest moment, one per product page. Eyebrow flanked by 26×1.5px blue dashes, title 76px/600, lede `#B9C2D8`, glass stat strip with `backdrop-filter: blur(8px)` and numbers in `#8FC0E8`. |

## 4 · List patterns

Every list is preceded by a **section head** (`.section-head`): blue eyebrow → navy title → right-aligned meta ("5 MOVES", "2 FOUND") or a `HIDE –` toggle in blue, hairline below.

| Pattern | Class | Numeral treatment |
|---------|-------|-------------------|
| A · Numbered priority list (the workhorse) | `.num-list > .num-item > .n/.t/.d` | Outlined blue digits: 32px/700, `color: transparent` + `-webkit-text-stroke: 1.6px blue`. Title 14px/600 navy, description 13px ink-2, hairline rows. Never circles or boxes here. |
| B · Step circles | `.step-list > .step > .c/.t` | 26px solid-blue circles, white 700 digits. For sequences that are a *product* (the 9-point audit), inside tinted panels. |
| C · Checklist | `.check-list > .check-item > .c/.t` | Green check in a 19px soft-green circle. Interactive variant: `<label class="check-item"><input type="checkbox"><span class="t">…</span></label>`. |
| D · Presentation findings | `.finding-row` (+ `data-bh-findings` on the parent) | 72px solid-navy numeral, 30px title, 15px body capped at 560px, 44px row padding. Rows not yet reached sit at `opacity .32` and reveal on scroll. |
| E · Numbered index rows | `.index-list > .index-row > .n/.t` under a `.panel-caps-title` | Zero-padded 12px/700 navy index (01, 02), 15.5px content. Quieter than the priority list. |

## 5 · Form patterns

- `.form-head`: eyebrow step counter ("STEP 1 OF 2") + 26px title left; a `.segmented` mode toggle right (14px-radius container, active segment white with blue 600 text and a small shadow).
- `.form-cols > .form-col`: columns divided by vertical hairlines, each opened by a blue caps `.form-group-label` (THE BUSINESS / THE NUMBERS / THE SITUATION).
- `.field`: **underline-only** inputs. 14.5px/600 navy label, gray placeholder, 2px bottom border `#C9D2DD` that turns blue on focus, wine when `.invalid`. Optional hints ride the label in `.opt`. Selects add a chevron, textareas grow.
- `.input-box`: the one boxed input, for "add a row" / search affordances inside tables and lists.

## 6 · Data patterns

- **Stat tiles** `.stat-grid > .stat-tile`: caps eyebrow → 30px/700 navy number → 11px gray sub. The lead metric gets `.hl` (ring + blue number). 3-up by default, `.cols-4` available. Add `data-bh-count` + `data-bh-format` to animate.
- **Data table** `table.data`: navy header with 10px caps white, channel cells lead with a 24px tinted icon tile (`.ch > .ico`), numbers right-aligned in `.num` cells, total row in `tfoot` separated by a 2px navy rule, prose columns in `.role`. Wrap in `.table-scroll` when it may overflow.
- **Mix blocks** `.mix-row[data-bh-mix] > .mix-block[data-share]`: sized by share, colored blue → orange → navy-soft in budget order. **Progress** `.progress[data-bh-progress]`: 6px hairline track, blue fill.

## 7 · Cards and callouts

- **Standard card** `.card`: white, 1px border, 10px radius, whisper shadow, caps `.card-eyebrow` first.
- **Highlight panel** `.panel-tint` + **quote box** `.quote-box`: blue tint marks "the answer"; the dashed blue box holds ready-to-use copy. Dashed border means "copy this text" (add a `data-bh-copy` button).
- **CTA row** `.cta-row`: copy left, one filled blue button right.
- **Dark CTA band** `.cta-dark`: closes a page. Two stacked actions, filled blue + glass outline.
- **Package cards** `.pkg-grid > .pkg-card`: 14px-radius, two-tone number (`0` in `#C4CBD9`, digit in blue), navy `.count` badges on deliverable rows.
- **Status pills** `.pill.pill-gray|blue|green|orange|wine|navy` for app list states.

## 8 · Author box and summary box

`.author-box`: 18px radius, 96px avatar circle, gray caps eyebrow, 16.5px/1.75 body with orange-deep underlined links, then a hairline-divided 3-stat row.
`.summary-box`: same anatomy without the avatar, blue eyebrow, key phrases bold in navy, the 3 numbers that matter. One paragraph + 3 stats, no more. Use it to close a diagnostic, cap a long section, or open a one-pager.

## 9 · Page templates

Both archetypes share the spine: **shell → dark hero → summary strip → sections separated by section-heads**. Sections stack at full content width; two-column grids appear only *inside* a section.

**A · Diagnostic / report page**
topbar → hero band → inputs chip row → report hero card + 3-up meta → § numbered list (what needs improvement) → § numbered list (opportunities) → § channel table → § CTA row → § tinted panel + steps → § checklist (quick wins) → summary / author box.

**B · Planner / dashboard page**
topbar → hero card + flight strip → KPI strip → 3-up stat tiles → § table + add-row input → audience card | reach curve → § mix blocks + detail → § collapsible reach & frequency.

## 10 · Rules of the look

**Do**
- Open every section with an eyebrow, and every page with a navy hero.
- End display headlines with the blue period (or `?` for questions).
- Separate list rows with hairlines; let whitespace do the framing.
- Right-align a counter or toggle in every section head.
- Reserve the highlight ring for exactly one item per group.
- Use the tinted panel + dashed quote box for "the deliverable".
- Close long reports with the summary-box pattern: one paragraph + 3 stats.
- Give buttons 10px corners and room to breathe; a label never wraps.
- Use the real Brill Media logo in the shell; sub-menus are pipe-divided links.

**Don't**
- Don't use orange for buttons or body links. Orange is brand + mix-bar color; blue is the action color (exception: prose links in the author box).
- Don't nest cards inside cards; one border per container.
- Don't introduce new grays. Stick to ink-2 / ink-3 / border / hairline.
- Don't use heavy shadows or dark mode; this system is paper-white with navy anchors.
- Don't put more than one filled blue button in view at a time.
- Don't use green outside checkmarks/success, or wine outside gap/negative flags.

## 11 · Behaviors (brill-hero.js)

| Hook | Effect |
|------|--------|
| `data-bh-tabs` on `.shell-tabs`, `.subnav`, `.navcards`, `.segmented` | Click sets `.active` / `aria-selected`; items with `data-target="#id"` show that panel and hide sibling `[data-bh-panel]`s. Arrow keys move focus. Emits `bh:tabchange`. |
| `data-bh-toggle="#id"` on a section-head button | Collapses/expands; relabels itself `Hide –` / `Show +`. Emits `bh:toggle`. |
| `data-bh-findings` on a `.finding-row` container | Scroll reveal: in-view rows full strength, the rest dimmed. Respects `prefers-reduced-motion`. |
| `data-bh-copy="#id"` or `data-bh-copy-text="…"` | Copies to clipboard, flashes "Copied". |
| `data-bh-progress="42"` on `.progress` | Animates the fill and sets ARIA values. |
| `data-bh-mix` on `.mix-row` | Sizes `.mix-block[data-share]` by share, auto-colors, emits `bh:mixselect`. |
| `data-bh-count="146952" data-bh-format="currency|number|compact|percent|multiplier"` | Formats and counts up a number. |
| `data-bh-print` | Triggers `window.print()`; print styles hide the shell and flatten panels ("Save as PDF"). |
| `BrillHero.toast(msg, {kind:'success'|'error', action, onAction})` | Navy toast bottom-right. |
| `BrillHero.init(root)` | Re-wire after re-rendering a region. |
