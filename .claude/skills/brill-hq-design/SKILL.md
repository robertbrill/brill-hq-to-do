---
name: brill-hq-design
description: Build or restyle UI in the Brill HQ app look — the quiet Notion-style workspace of HQ Tasks (white, three text grays, one blue, system font, rows that touch, edited in place). Use whenever adding or changing a view, page, row type, control, modal, pill, card or state in index.html, or when the user mentions the HQ design system, the design reference, or "make it match the rest of the app".
---

# Brill HQ design skill

The full spec is `design/DESIGN.md`. The visual reference is
`design/brill-hq-design-reference.html` (every pattern rendered with the app's own
CSS). The CSS itself lives in the `<style>` block of `index.html`; the class names
below are the app's real class names, so reuse them rather than inventing new ones.
Behaviour (what each view and action does, the data model, sync, reminders, the assistant) is in `design/FUNCTIONALITY.md` with a rendered companion at `design/brill-hq-functionality-reference.html`. Read `DESIGN.md` before building anything non-trivial; this file is the short version.

## Build order for any view

1. **Page head**: `.page-title` (36px) → `.page-subtitle` (14px muted, carries the live counts).
2. **One input row**: a `.quick-add` (faint "+" · borderless input · gray select · one blue `.add-btn`) or a `.proj-search`.
3. **Controls row**: `.controls-row` with underline `.tab`s, a `.controls-spacer`, then `.search-input`, `.sort-select`, and a ⋯ `.icon-btn` opening a `.menu` for bulk/destructive actions.
4. **Sections of rows**: `.section` → `.section-header` (caret · colour dot · caps title · count) → `.section-body` of rows.
5. **Empty state**: `.empty-note`, one centered faint sentence.

Detail views instead open with `.breadcrumb` → `.detail-title-input` (an input that looks like a heading) + ⋯ → `.props-toggle` and `.prop-row`s → `.detail-notes` → `.divider` → body.

## Pick the pattern

| Need | Use |
|------|-----|
| A checkable item | `.task-row` with `.checkbox` · `.task-body` (`.task-text`, `.task-meta`) · hover-revealed `.task-actions` of `.icon-btn`s |
| An item with urgency | `.ptodo-row` + a clickable lowercase urgency `.pill` (low gray · medium yellow · high red) |
| A scheduled item | `.rem-row` (`.rem-title`, `.rem-when`, `.rem-notes`, `.rem-actions`); `.due` for overdue |
| A list of projects | `.project-row` (emoji · name · `.p-bar` · `.p-count` · status pill · `.p-due`) |
| A card grid | `.cards-grid` of `.proj-card` on a `.page-wide` page, grouped under `.ov-group` |
| A second column list | `.entries-sidebar` with `.entry-item`s, `.psb-filters`, `.psb-group` labels |
| Status | `.pill.pill-green` Active · `.pill-yellow` Paused/medium · `.pill-gray` Done/low · `.pill-red` high/Due now · `.pill-blue` cadence |
| Properties | `.props` of `.prop-row` (`.prop-label` emoji + 120px faint label, `.prop-value` borderless select/date) |
| A confirmation or picker | `.modal-overlay` + `.modal-card` (`.modal-head`, `.modal-list`/`.modal-body`, `.modal-foot`) |
| An info panel | `.push-card`; a warning: `.chat-notice`; destructive confirm: `.delete-bar` |
| Feedback | `showToast("…")` (bottom-centre dark toast) |
| Files | `.file-row` with `.file-thumb` or `.file-ext`, `.file-name`, `.file-meta` |
| Chat | `.chat-msg.user|assistant|error` bubbles, `.chat-chip` results, `.chat-composer` |

## Hard rules (check before finishing)

- Blue (`--blue`) is the only accent and means "action / on": Add, checked, focus, links, progress. One filled blue button per surface.
- Red only for destructive or urgent, and mostly on hover; solid red only in the delete bar.
- Text hierarchy is `--text` / `--muted` / `--faint`. No new grays, no coloured headings, no gradients, no dark mode, no web fonts.
- Rows touch and use the `--hover` fill; task rows never get borders. Hairlines only between reminders, files and project rows.
- Radius: 6px rows/small controls (`--radius`), 8px inputs and menus, 10px cards and modals, 12px search/login, 14px chat.
- Focus = blue border + `0 0 0 3px var(--blue-soft)` on the container, never an outline on the inner input.
- Shadows only on floating things (menus, modals, search, toast).
- Uppercase only on section and group labels; bold only on titles, current items and buttons.
- Everything editable is edited in place and saves itself; no edit screens, no Save buttons.
- Emoji are the icons. Reuse the existing ones (☑ 📁 📝 📎 ⏰ 💬 📅 ⚙️ 🔍 ⋯).
- Keep it responsive: the 760px breakpoint stacks the columns and shows a `.compact-bar`; row actions are always visible on touch.

## Working in index.html

- Add CSS to the existing `<style>` block under the matching `/* ==== Section ==== */` comment, using the `--*` tokens. Prefer extending an existing class.
- Markup is produced by render functions returning template strings; actions are `data-action` attributes handled by the delegated click listener. Follow that pattern rather than adding per-element listeners.
- Escape user text with `escHtml()`.
- Read `design/FUNCTIONALITY.md` before changing behaviour: it lists every action, the save/sync rules (never re-render over an in-progress edit), inbox routing, reminder delivery and the assistant's action contract.

## Verify

Open `design/brill-hq-design-reference.html` next to the view you built and compare. Screenshot at desktop and ~400px. Check the hard rules above before calling it done.
