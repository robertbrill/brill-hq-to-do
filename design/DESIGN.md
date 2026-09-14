# Brill HQ · Design system

The look and behaviour of **HQ Tasks**, the Brill HQ workspace app (`index.html`):
tasks, projects, long notes, files, reminders and the assistant. Everything here is
lifted from the running app. The visual companion is
`design/brill-hq-design-reference.html`, which renders every pattern below using the
app's own CSS; open it in a browser when you want to see rather than read.

| File | What it is |
|------|------------|
| `design/brill-hq-design-reference.html` | Self-contained reference page: swatches, type scale, every component rendered, page wireframes, rules. |
| `design/DESIGN.md` | This document. |
| `.claude/skills/brill-hq-design/SKILL.md` | The same rules, written for Claude Code. |
| `index.html` `<style>` block | The source of truth for the CSS. Classes named below are the app's real class names. |

The character in one line: a quiet, Notion-style workspace. White, three grays of
text, one blue, the platform font, rows that touch, everything edited in place.

---

## 1 · Foundations

### Color

| Token | Value | Job |
|-------|-------|-----|
| `--bg` | `#ffffff` | The page. Everything sits on white. |
| `--sidebar` | `#f7f7f5` | Left nav, select chips, notes fields, info cards, login backdrop |
| (second column) | `#fbfbfa` | Entries / projects list column |
| `--text` | `#37352f` | Titles, body, current nav, active tab underline |
| `--muted` | `#787774` | Nav items, subtitles, section titles, notes |
| `--faint` | `#9b9a97` | Counts, meta, placeholders, done tasks, icon buttons |
| `--blue` | `#2383e2` | **The accent**: Add buttons, checked boxes, focus rings, links, progress fills |
| (blue hover) | `#1a73cd` | Primary button hover |
| `--blue-soft` | `rgba(35,131,226,.10)` | 3px focus ring, drop-zone fill |
| `--border` | `rgba(0,0,0,.08)` | Dividers, card borders |
| `--border-strong` | `rgba(0,0,0,.14)` | Anything you type into or press |
| `--hover` / `--active` | `rgba(0,0,0,.04)` / `.06` | Row hover / current nav item, selected entry |
| (danger) | `#eb5757` | Delete actions, urgent priority, high urgency dot, select-to-delete boxes |
| (danger text) | `#c4554d` | Danger hover text, overdue reminder time |
| (high) | `#f2994a` | High priority |
| (amber) | `#e9b44c` | Medium urgency dot |
| (star) | `#f5b301` | Pinned entries |
| (toast) | `#2f2f2c` | The one dark surface |

Ratio guide: ~90% white and warm-gray neutrals · ~8% ink text · ~2% blue. Blue means
"action or on". Red means "destructive or urgent". Yellow means "medium / paused /
waiting". Green means "active". Nothing else is coloured; hierarchy comes from the
three text grays.

**Pill pairs** (background / text):

| Pill | Colors | Meaning |
|------|--------|---------|
| `.pill-gray` | `#f1f1ef` / `#57564f` | Low urgency · Done project · default |
| `.pill-green` | `#dbeddb` / `#1c3829` | Active project |
| `.pill-yellow` | `#fdecc8` / `#402c1b` | Medium urgency · Paused · notices |
| `.pill-red` | `#ffe2dd` / `#5d1715` | High urgency · Due now · errors · danger hover |
| `.pill-blue` | `#d3e5ef` / `#183347` | Repeat cadence (Daily, Weekdays, Weekly, Monthly) |
| `.pill-purple` | `#e8deee` / `#412454` | Reserved, unused |

**Section dot colors** come from the data, iOS-style: red `#ff3b30`, orange `#ff9500`,
yellow `#f5c542`, green `#34c759`, blue `#007aff`, indigo `#5e5ce6`. They appear only as
the 8px dot on a section header and the 7px dot in a row's section tag.

### Typography

Font stack: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`.
The platform font, never a web font. Base 15px / 1.45.

| Role | Size / weight |
|------|---------------|
| Page title `.page-title` | 36px / 700 / −0.01em (28px on mobile) |
| Editable title `.detail-title-input`, `.entry-title-input` | 34px / 700 (26px on mobile), placeholder `#d4d2cc` |
| Empty-state title `.chat-empty-title` | 20px / 600 |
| Search modal input | 17px |
| Long-note body `.entry-body` | 15.5px / 1.6 |
| Body, task text, quick-add input | 15px / 400 |
| Nav item, tab, modal option, list title | 14px / 500 (600 when current or selected) |
| Subtitle, breadcrumb, buttons, notes, chips | 13–14px muted |
| Meta, counts, icon buttons, pills | 12px faint (pills 500) |
| Section title `.section-title` | 13px / 600 / caps / 0.04em muted |
| Column head, reminder section, group labels | 10.5–12px / 600 / caps / 0.04–0.05em faint |

Weights: 400 body · 500 nav and pills · 600 current/selected, labels, buttons · 700
titles only. Uppercase + tracking only on section and group labels. Emoji are the
icons (☑ 📁 📝 📎 ⏰ 💬 📅 ⚙️ 🔍 ⋯).

### Shape and elevation

- Radii: rows, nav items, small buttons `6px` (`--radius`) · inputs, quick-add, menus, delete bar `8px` · cards, modals, info panels `10px` · search modal, login card, drop zone `12px` · chat composer and bubbles `14px` · group input and chat chips `12px` · checkboxes `3–4px`.
- Borders: hairline `--border` for dividers and cards; `--border-strong` for anything typed into or pressed. No coloured borders except blue on focus and red (`#f0b8b8`) on the delete bar.
- Shadow: flat by default. Floating things get `--shadow-card` (menus, modals, search). Cards get `0 2px 10px rgba(15,15,15,.07)` on hover only. Toast `0 5px 15px rgba(15,15,15,.2)`.
- Focus: `border-color: var(--blue)` + `box-shadow: 0 0 0 3px var(--blue-soft)` on the container (`:focus-within`), never an outline on the inner input.
- Rhythm: content column `max-width: 820px`, padded `56px 48px 120px` (`24px 16px 90px` on mobile). The projects overview widens to `1240px`. Rows are 6–10px padded and touch; whitespace separates them.

---

## 2 · App shell and navigation

Three columns, left to right:

1. **Sidebar** `.sidebar`: 232px, `--sidebar` fill, sticky full height, `12px 8px` padding. Brand = the real logo at full width with "HQ Tasks" under it. Then `.sidebar-search` (bordered, ⌘K hint), then `.nav-item`s (emoji icon · 14px/500 muted label · faint count on the right). The current item gets `--active` fill, `--text` colour, 600. Under Long Notes, a collapsible `.note-groups-nav` of `.nav-subitem`s. Footer stats in faint 12px above a hairline, then the quiet `.signout-btn` (red on hover).
2. **Second column** `.entries-sidebar`: 250px, `#fbfbfa`, only on Projects and Long Notes. Head = caps label with count + `+ New`. `.psb-filters` are tiny 11.5px chips (Active / Paused / Done / All / Archived). Items are `.entry-item`: 14px/500 title (600 selected), 11.5px faint date line, hover-revealed star that stays gold when pinned. Groups under `.psb-group` caps labels.
3. **Main** `.main`: the scroll area holding one `.page` at a time.

**Mobile (≤760px)**: the sidebar becomes a wrapping row of nav chips, the second column stacks above the page (max 40vh), and a `.compact-bar` (logo · current title · `+ New` · `Entries` · `☰ Menu` buttons) toggles them. Task actions are always visible.

## 3 · Page anatomy

Every list page opens the same way:

```
.page-title            36px title
.page-subtitle         14px muted line carrying live counts
.quick-add             one bordered row: faint "+" · borderless input · gray select · blue Add
.controls-row          underline .tab s · spacer · .search-input · .sort-select · ⋯ .menu
sections of rows
```

Detail pages (project, long note) instead open with a `.breadcrumb`, an editable
title input with a ⋯ menu beside it, a collapsible `.props-toggle` ("Details" +
status pill + due + count) over Notion-style `.prop-row`s (120px faint emoji label,
borderless select or date), a borderless `.detail-notes` textarea, then a
`.divider` and the body. Long notes add a rounded gray `.entry-group-input` chip
and an `.entry-toolbar` of icon buttons (B · I · • List · ☑ Checklist · 🔗 Link · 📎 Attach).

Tabs underline in `--text`, not blue. The ⋯ `.menu` holds bulk and destructive
actions (destructive rows are red text).

## 4 · Rows and lists

| Row | Anatomy |
|-----|---------|
| **Section** `.section-header` | 11px faint caret (rotates −90° collapsed) · 8px colour `.section-dot` · 13px caps muted `.section-title` · 12px faint `.section-count`. Whole row is the toggle. |
| **Task** `.task-row` | 16px `.checkbox` (blue fill + white tick when `.checked`) · `.task-text` 15px · `.task-meta` 12px faint (section tag with dot when sorted by date · date · 📝 note preview) · `.task-actions` (Note / → Project / Edit / Archive) fade in on hover. `.done` = faint + strike-through. An open note is a gray `.notes-area` textarea under the text. Inline edit swaps in `.task-edit-input` (blue border + ring). |
| **Project to-do** `.ptodo-row` | Same as a task plus a lowercase clickable urgency `.pill` on the right (low gray · medium yellow · high red) that cycles on click. Sorted high → low. Completed to-dos fold into a collapsible "Completed" section. |
| **Reminder** `.rem-row` | Hairline-divided. 15px `.rem-title` · 12.5px muted `.rem-when` (goes `#c4554d`/500 when overdue with a red **Due now** pill; blue pill for cadence) · 13px muted `.rem-notes` · always-visible actions (✓ Done · ⏲ +1h · ✕). Grouped under `.rem-section-title` caps labels (Upcoming · Delivered · Done). |
| **Project (list)** `.project-row` | Emoji · 15px/600 name · 4px `.p-bar` progress (gray track, blue fill, max 160px) · faint `.p-count` · status pill · `.p-due`. Hairline-divided. |
| **File** `.file-row` | 40px `.file-thumb` for images (click → lightbox) or a faint caps `.file-ext` badge · `.file-name` link (blue on hover) · faint `.file-meta` · ✕. The aggregate Files view is a 6-column grid with a caps header row. |
| **Empty** `.empty-note` | Centered 14px faint sentence. |

Rows show `--hover` fill on hover. Only reminders, files and project lists divide
with hairlines; task rows never do.

## 5 · Pills, dots and states

- `.pill`: 12px / 500, `1px 8px` padding, 4px radius, no border, no icon. Meanings are fixed (see § 1).
- `.urg-dot` 6px: low `#d3d1cb` · medium `#e9b44c` · high `#eb5757`. Used inside overview cards.
- Task priority (Urgent `#eb5757` · High `#f2994a` · Normal `#2383e2` · Low `#9b9a97`) colours the inbox section, not a pill on the row.
- Checkbox states: default (`.14` border) → hover (blue border) → `.checked` (blue fill, white tick). `.select-box.checked` is red for delete mode. Long-note checklists use `ul.checklist li.checked`.

## 6 · Inputs and buttons

**Buttons**

| Class | Look | Use |
|-------|------|-----|
| `.new-btn.primary`, `.add-btn`, `.chat-send`, login button | Blue fill, white 600 text, 6px radius (10px in the composer, 8px on login) | The one filled button per surface |
| `.new-btn` | White, `.14` border, 13px/500 | Cancel, Turn off, secondary |
| `.new-btn.danger-solid` | Red fill | Only in the delete bar |
| `.icon-btn` | 12px faint text, 4px hover fill; `.danger` goes red on hover | Row verbs: Note · → Project · Edit · Archive · ✓ Done · ✕ |
| `.link-btn`, `.file-name` | Blue text | Links |
| `.danger-link` | Faint text, red on hover | "Delete this project…" in the danger zone |
| `.cb-btn` | White chip, 8px | Compact bar |
| `.chat-chip` | 12px white chip, 12px radius | Assistant results |

**Inputs**, two families:

- *Bordered containers* (`.quick-add`, `.proj-search`, `.sidebar-search`, `.modal-body` fields, `.chat-composer`): `.14` border, 8px radius, blue border + 3px ring on `:focus-within`. The input inside has no border of its own. Selects inside are gray chips (`--sidebar` fill, 13px muted).
- *Bare inputs* (`.detail-title-input`, `.entry-title-input`, `.detail-notes`, `.card-add`, `.prop-value select/input`): no border, transparent, read as text until clicked. Exception: `.notes-area` is a sidebar-gray box with a hairline that turns blue on focus.

Placeholders are `--faint` (titles `#d4d2cc`).

## 7 · Cards and panels

- **Overview card** `.proj-card`: 10px hairline card in `.cards-grid` (auto-fill, min 300px). Head = 14.5px/600 name + status pill. Progress strip. Up to a few `.card-todo`s (14px checkbox · `.urg-dot` · 13px text · 📝 flag) then `.card-more`, then a borderless `.card-add` input under a hairline. Hover: `.14` border + whisper shadow. Grouped under `.ov-group` caps labels.
- **Info card** `.push-card`: sidebar-gray, hairline, 10px, 13.5px muted copy with the lead in `--text`, action on the right. Used for push and SMS setup.
- **Delete bar** `.delete-bar`: the only red-bordered surface (`#f0b8b8` on `#fdf0ef`) with Cancel + red Delete selected.
- **Notice** `.chat-notice`: the yellow pill pair as a block.
- **Chat** `.chat-msg.user` blue bubble right-aligned, `.chat-msg.assistant` gray bubble with hairline, `.chat-msg.error` red pair; 14px radius with a 4px inner corner. Results are `.chat-chip`s (`.failed` red). `.chat-composer` is a sticky 14px-radius bordered box with a mic toggle that pulses red while listening.

## 8 · Overlays and feedback

- **Modal** `.modal-overlay` `rgba(15,15,15,.45)`, card 420px at 12vh from the top: 10px radius, `--shadow-card`, `.modal-head` 14px/600 with faint `.modal-sub`, `.modal-list` of `.modal-option`s or a `.modal-body` form, `.modal-foot` right-aligned above a hairline (secondary then primary).
- **Global search** (⌘K) `.search-modal`: 600px, 12px radius, 17px borderless input over a hairline, results grouped under `.search-group-label`s; arrow keys move `.active`.
- **Menu** `.menu`: hangs under ⋯, right-aligned, 8px radius, 13px rows, red text for destructive.
- **Toast** `.toast`: bottom-centre, `#2f2f2c`, 13px white, 8px radius, 1.9s, slides up 16px.
- **Login** `.auth-card`: 320px white card on the sidebar gray, logo 34px, 18px title, 8px inputs, full-width blue button, red error line.
- **Drop zone** `.drop-overlay`: dashed blue 12px box with `--blue-soft` fill over a note or project while dragging files.
- **Lightbox**: `rgba(0,0,0,.85)` backdrop, image at 8px radius.

## 9 · Page templates

All six views share one spine: **sidebar → (second column) → page: title / subtitle → one input row → controls → sections of rows.**

| View | Column(s) | Body |
|------|-----------|------|
| Tasks | sidebar | title · quick-add (priority select) · tabs + search + sort + ⋯ · colour-dotted sections of task rows |
| Project detail | sidebar · projects list | breadcrumb · editable title + ⋯ · Details toggle + props · notes · divider · quick-add (urgency) · to-do rows · Completed · files · danger zone |
| Projects overview | sidebar · projects list | wide page · group labels · card grid |
| Long notes | sidebar + groups · entries list | editable title · date · group chip · toolbar · rich-text body · files |
| Reminders | sidebar | title · push card · SMS card · quick-add (when · repeat) · Upcoming / Delivered / Done sections |
| Assistant | sidebar | title · chat log · sticky composer · hint |
| Files | sidebar | title · search · 6-column grid |

Everything editable is edited in place; there are no edit pages and no Save
buttons. Collapsing is always a caret on the label itself.

## 10 · Rules

**Do**
- Build every view as title → subtitle with counts → one quick-add row → tabs/controls → sections of rows.
- Use the three text grays for hierarchy; use blue only for "action" and "on".
- Let rows touch and show a `--hover` fill; reveal row actions on hover (always on touch).
- Make titles and notes editable in place; save on blur or Enter.
- Keep pill meanings fixed: green Active, yellow Paused/medium, gray Done/low, red high/Due now, blue cadence.
- Put bulk and destructive actions behind the ⋯ menu; confirm deletes with the red delete bar.
- Focus with the blue border + 3px soft ring on the container.
- Use an emoji as the icon; 6px radius on rows and small controls, 8px on inputs, 10px on cards.
- Confirm quiet actions with the dark toast; keep counts live in the sidebar and subtitles.

**Don't**
- Don't add colour for decoration: no coloured headings, tinted sections, gradients or dark mode.
- Don't put more than one filled blue button on a surface, and never a red one outside delete mode.
- Don't box rows in cards or add borders between task rows.
- Don't introduce a web font, a new gray, or a new pill colour.
- Don't use uppercase outside section and group labels; don't use bold outside titles, current items and buttons.
- Don't put shadows on things that don't float.
- Don't add a separate edit screen or a Save button.

## 11 · Behaviour notes

- State renders from data: `render()` rebuilds the visible page's HTML; actions are `data-action` attributes handled by one delegated click listener.
- Sections, Details and note groups remember their collapsed state (localStorage).
- Row actions: Note toggles a `.notes-area` under the row; → Project opens the picker modal; Edit swaps in the inline input; Archive hides the task (Archived tab restores).
- Delete mode replaces checkboxes with red select boxes and shows the delete bar until Cancel or confirm.
- Toast confirms archive, move, delete, copy and reminder actions for 1.9s.
- Drag files anywhere over a note or project to attach; images open in the lightbox.
- ⌘K opens global search from any view; arrow keys and Enter navigate results.
