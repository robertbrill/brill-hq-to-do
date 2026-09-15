# Brill HQ · Functionality reference

What **HQ Tasks**, the Brill HQ workspace app, actually does: every view, every
action, the data model, how data syncs, and the server pieces behind the assistant,
reminders, push and SMS. Everything here is read from the running code
(`index.html`, `supabase-db.js`, `api/*.js`, `lib/*.js`, `sw.js`,
`supabase/schema.sql`). The visual companion is
`design/brill-hq-functionality-reference.html`; the look of the app is in
`design/DESIGN.md`.

| File | Role |
|------|------|
| `index.html` | The whole client: state, rendering, actions, polling, auth gate. |
| `supabase-db.js` | `BrillDB`: auth, load/save of all state, inbox, files, reminders, push, SMS, assistant calls. |
| `api/config.js` | Serves `/config.js` (Supabase URL + anon key, VAPID public key, SMS flag) from env vars. |
| `api/base-tasks.js` | The private base task list, returned only to a signed-in user. |
| `api/assistant.js` | Claude-backed intake: plain English → structured actions. |
| `api/send-reminders.js` | Vercel cron, every minute: delivers due reminders by Web Push and SMS. |
| `api/sms-optin.js`, `api/sms-inbound.js`, `lib/sms.js` | Twilio double opt-in and the inbound keyword webhook. |
| `lib/verify-user.js` | Verifies the caller's Supabase access token for every function. |
| `sw.js` | Service worker: receives push, opens the app on tap. No caching. |
| `supabase/schema.sql` | Tables, Row-Level Security, the private `uploads` bucket. |
| `add-todo.sh` | Legacy CLI that appends to the inbox (Mac edition). |

---

## 1 · The shape of the app

One signed-in user, one workspace, six views reached from the sidebar:

| View | What it holds |
|------|---------------|
| **Assistant** | A chat that files tasks, projects, long notes and reminders for you. |
| **Tasks** | The flat inbox of quick to-dos, plus the base task list, in colour-coded sections. |
| **Projects** | Named containers with their own to-do list, status, area, due date, notes and files. A card-grid overview and a per-project detail page. |
| **Long Notes** | Free-form rich-text documents, optionally grouped, with attachments. |
| **Files** | Everything uploaded, searchable by name and (for text files) content. |
| **Reminders** | Scheduled notifications with optional repeat, delivered in-app, by push, or by text. |

A **global search** (⌘K or `/`) spans tasks, projects, to-dos, notes and files from
anywhere. Everything is edited in place and saved automatically; there are no edit
screens and no Save buttons.

### Data model (Supabase)

| Table | Columns that matter | Notes |
|-------|--------------------|-------|
| `projects` | `name`, `status` (Active / Paused / Done), `owner`, `due`, `notes`, `personal`, `ai`, `archived`, `pinned`, `sort_order` | `personal` and `ai` pick the group (Work / Personal / AI Projects). |
| `project_todos` | `project_id`, `body`, `completed`, `urgency` (low / medium / high), `notes`, `sort_order` | Cascade-deleted with the project. |
| `notes` | `title`, `body` (HTML), `grp`, `archived`, `pinned` | Long notes. |
| `files` | `name`, `ext`, `size`, `mime`, `project_id` or `note_id`, `storage_path`, `content_text` | Bytes live in the private `uploads` bucket; `content_text` feeds full-text search. |
| `inbox` | `task`, `priority` (urgent / high / normal / low), `project`, `notes`, `routed` | Quick tasks. A `project` value means "file me into that project". |
| `task_overrides` | `task_key`, `completed`, `edited_text`, `note`, `deleted`, `archived` | Per-item state for the read-only base list, keyed `sectionId::index`. |
| `reminders` | `title`, `notes`, `due_at`, `repeat` (none / daily / weekdays / weekly / monthly), `fired_at`, `last_fired_at`, `fired_via`, `done` | Pending = `fired_at` null and not done. |
| `push_subscriptions` | endpoint + keys per device | One row per browser that enabled push. |

Every table has `user_id = auth.uid()` with a Row-Level Security policy `own_all`,
so a user can only ever read or write their own rows. The `uploads` bucket has the
same rule on `owner`. The anon key in `config.js` is public by design; RLS is the
privacy boundary.

---

## 2 · Sign-in and startup

1. The page loads with an auth overlay. If `config.js` is missing or still has
   placeholder values, a "Not configured" card shows instead.
2. Email + password sign in through Supabase Auth (`BrillDB.signIn`). Sessions
   persist and refresh automatically; a null session that is not an explicit
   sign-out does not reload the app.
3. On start the app loads, in order: all state (`BrillDB.loadAll`), the inbox, the
   base task list (`/api/base-tasks`, token-gated), reminders, push and SMS state.
   It then routes any inbox items that name a project (see § 4) and renders.
4. The last view, last open project, collapsed sections and the groups-nav state
   are remembered in `localStorage` and restored.
5. **Sign out** (sidebar footer) clears the session and returns to the overlay.

---

## 3 · Saving and syncing

- Every edit calls `queueSave()`, which marks the state dirty and saves the whole
  snapshot through `BrillDB.saveAll` after a short debounce. The saved payload is
  remembered so it is not synced back.
- Every 12 seconds, and whenever the tab becomes visible, `maybeSyncState()`
  reloads from the database. If the payload differs from the last one seen, another
  device changed the data and the app adopts it. It skips the sync while there are
  unsaved edits or while you are typing, so a re-render never steals the caret.
- Every 10 seconds the inbox is polled (`INBOX_POLL_MS`) so tasks added from the
  assistant, the CLI or another device appear without a refresh.
- Every 30 seconds reminders are reloaded (`REMINDER_POLL_MS`), a pending SMS
  enrollment is re-checked, and due reminders are delivered in-app.
- Re-renders preserve an open notes box and its caret (the "keep caret" logic); the
  notes pane has opt-in diagnostics (`?noteDebug`) for the rare case it closes.

---

## 4 · Tasks

**What's on the page.** Title and subtitle with counts → quick-add → tabs → sections.

- **Quick-add**: type a task, pick a priority (Urgent / High / Normal / Low), press
  Add or Enter. The task goes to the `inbox` table and appears under
  *Inbox — Priority*.
- **Sections**: inbox items are grouped by priority (urgent first, each with its
  priority colour), followed by the base task list's own sections (coloured by
  the data, iOS-style). Each section header toggles collapse; the state is
  remembered.
- **Tabs**: Active (default) · Completed · All · Archived.
- **Search** filters rows by text; **Sort** switches between newest first, oldest
  first, and by section (when sorted by date, each row shows a small section
  tag).
- **Row actions** (hover; always visible on touch):
  `Note` / `+ Note` opens a notes textarea under the row (`Hide note` closes it) ·
  `→ Project` opens the "Move to project" picker (choose a project or *New
  project…*) · `Edit` swaps the text for an inline input (Enter saves, Esc cancels)
  · `Archive` hides it (the Archived tab shows `↩ Restore`).
- **Checkbox** marks done (faint, struck through). Base-list items store all of
  this in `task_overrides`; inbox items update their own rows.
- **⋯ menu**: *Archive all remaining* · *Delete tasks…* which enters **delete mode**:
  checkboxes become red select boxes, a red bar shows the count with Cancel and
  Delete selected; Esc cancels.
- **Inbox routing**: an inbox item with a `project` field (from the assistant, the
  CLI or the API) is filed straight into that project's to-do list under
  *AI Projects*, creating the project if needed, with urgency mapped from priority
  (urgent/high → high, normal → medium, low → low). A dedup guard prevents filing
  the same text twice; the row is then marked `routed`.

---

## 5 · Projects

**Second column** lists projects with filters Active · Paused · Done · All ·
Archived, an *Overview* entry at the top, pinned projects first, then groups. `+ New`
creates an untitled project and opens it. Each item shows status and done/total;
the star pins it.

**Overview** (card grid, groups Work · Personal · AI Projects): each card shows the
name (click to open), status pill, progress bar, due date, up to 6 open to-dos with
checkboxes and urgency dots (📝 flags a note), `+ N more…`, and a `+ Add a to-do…`
input (Enter adds). Ticking a card to-do completes it in place. Clicking a to-do's
text opens the project with that to-do's notes expanded.

**Project detail**:
- Breadcrumb *Projects / name*. The title is an input; edits save on the fly.
- **⋯ menu**: *Archive project* · *Delete project…* (moves to the danger zone
  confirmation) · *Delete to-dos…* (delete mode for this project's list).
- **Details** toggle shows the property rows: Status (Active / Paused / Done),
  Area (Work / Personal / AI Projects), Due (date), Progress (bar + count). The
  toggle row itself repeats status, due and count when collapsed.
- **Project notes**: a borderless textarea that grows as you type.
- **Quick-add to-do** with urgency Low / Medium / High.
- **To-do rows**, sorted high → low: checkbox · text · optional notes preview ·
  urgency pill (click cycles low → medium → high → low) · actions `+ Note` /
  `Edit` / `Delete`. Completed to-dos fold into a collapsible *Completed* section.
- **Files**: `+ Upload` button, or drag files anywhere onto the page (a dashed blue
  drop zone appears). Images show a thumbnail that opens a lightbox; other files a
  type badge. Each row links to a signed download URL (valid 8 hours) and has ✕.
  Max 50 MB per file.
- **Danger zone** at the bottom: *Delete this project…* (confirm) removes the
  project, its to-dos and its files.

---

## 6 · Long Notes

**Second column** lists entries (Active / Archived filter), newest first, pinned
first, grouped when the sidebar group nav has a group selected. `+ New` creates an
untitled entry. The sidebar's *Groups* nav under Long Notes lists every group with
counts and filters the entries list; it collapses and remembers its state.

**Editor**:
- Title input (34px), a date line, and a **group** chip input (type a group name;
  it becomes a heading in the nav).
- Toolbar: **B** · *I* · ~~S~~ · • List · 1. List · ☑ Checklist · 🔗 Link ·
  Clear formatting · 📎 Attach.
- The body is a contenteditable rich-text area saved as HTML. Typing `- ` or `* `
  at the start of a line auto-converts it to a bullet. **Tab** nests a bullet,
  **Shift+Tab** un-nests. Checklist items tick when their box is clicked and go
  faint and struck through.
- Files attach to the note the same way as projects (button or drag-and-drop).
- **Archive** and **Delete** live in the entry toolbar's overflow; deleting a note
  also deletes its files.

---

## 7 · Files

An aggregate of every upload across projects and notes: a 6-column grid (type ·
name · belongs to · size · date · ✕). The search box matches file names and, for
text-like files (txt, md, csv, json, code, etc.), their contents, which the browser
extracts and stores at upload time (capped at 200k characters). Clicking the
"belongs to" link opens that project or note. Deleting asks for confirmation and
removes the storage object and the row.

---

## 8 · Reminders

**Cards at the top**:
- **Push card**: *Enable notifications on this device* asks for permission,
  registers `sw.js`, subscribes with the server's VAPID key and saves the
  subscription. Shows how many devices are enrolled; *Turn off* unsubscribes this
  one. On iPhone the app must be added to the Home Screen first.
- **SMS card**: enter a mobile number and tick the consent box → the number is
  saved as *pending* and a confirmation text is sent; reply **YES** to confirm.
  States: off → pending (with *Resend* and *Refresh*) → confirmed (with *Stop*).
  Replying STOP to the number turns texts off at the carrier; only START or UNSTOP
  undoes that.

**Quick-add**: title · date-time · repeat (Once / Daily / Weekdays / Weekly /
Monthly) · Add. A reminder set for "now" is delivered immediately.

**Sections**: *Upcoming* (pending, soonest first; overdue rows go red with a
**Due now** pill) · *Delivered* (fired, waiting for you) · *Done* (collapsed
disclosure). Row actions: **✓ Done** · **⏲ +1h** snooze (when due or delivered) ·
**✕** delete.

**Delivery**:
- *While the app is open*: every 30 s (and on load) due reminders show a toast
  and a browser notification. If no push or SMS channel is enrolled, the app itself
  marks the reminder delivered (`fired_via: app`), or advances a repeating one to
  its next occurrence.
- *While closed*: the Vercel cron `send-reminders` runs every minute with the
  service-role key, finds due undelivered reminders across users, sends a Web Push
  to each registered device and an SMS to a confirmed number, and marks the
  reminder delivered (repeating ones advance instead). Dead push subscriptions are
  pruned. If a user has no channel the row stays pending for the app to show.
- Tapping a push notification focuses or opens the app on the Reminders view.

---

## 9 · Assistant

A chat view. Type (or dictate with the 🎤 button, where the browser supports
speech recognition) something like *"Remind me Friday at 9 to send the BSH invoice,
and add a task to call Brad."* Enter sends; Shift+Enter adds a line; the
conversation is kept in `localStorage` and *Clear conversation* wipes it.

**Flow**: the browser posts the chat history plus context (local time and zone,
project names, note titles and groups, pending reminders, open inbox count) to
`/api/assistant` with the user's access token. The function verifies the token,
calls Claude with a fixed system prompt and six tools, and returns a short reply
plus the tool calls it made. **The browser applies the actions itself** through
`BrillDB` with the user's own session, so RLS still governs every write. The
function never touches the database.

| Tool | What the app does with it |
|------|---------------------------|
| `add_task` (text, priority, project?, notes?) | Without a project: adds to the inbox. With one: files into that project (created if missing). |
| `create_project` (name, notes?, status?, due?, owner?, todos[]?) | Creates or updates the project and seeds its to-dos. |
| `create_note` (title, body Markdown, group?) | Creates a long note; Markdown becomes the note's HTML. |
| `append_to_note` (note_id, text) | Appends to an existing note. |
| `set_reminder` (title, due_at ISO with offset, notes?, repeat?) | Adds a reminder; never in the past. |
| `cancel_reminder` (reminder_id) | Deletes a pending reminder. |

Each applied action becomes a chip under the reply (✓ or ✕) that opens what it
created. Relative times resolve against the user's local clock ("tomorrow
morning" = 9:00, "afternoon" = 14:00, "evening" = 18:00, "tonight" = 20:00, "end of
day" = 17:00). Priority is inferred from wording (ASAP/today → urgent; this
week/important → high; someday → low). The history sent is capped at 24 turns and
8k characters per message.

---

## 10 · Global search

⌘K / Ctrl+K anywhere, or `/` when not typing in a field. Results group into
Tasks (base list and inbox, including their notes), Projects and their to-dos,
Long Notes (title, body text, group), and Files (name and extracted contents, via
the database's full-text index). ↑ ↓ move the highlighted row, Enter opens it,
Esc closes.

---

## 11 · Keyboard and gestures

| Key | Where | Does |
|-----|-------|------|
| ⌘K / Ctrl+K | anywhere | Open global search |
| `/` | not in a field | Open global search |
| Enter | quick-add, card add, reminder form | Add |
| Enter / Esc | inline task or to-do edit | Save / cancel |
| Enter | assistant composer | Send (Shift+Enter for a newline) |
| Tab / Shift+Tab | long-note body | Indent / outdent a bullet |
| Esc | delete mode, picker, new-task dialog, lightbox, search | Close / cancel |
| Drag files | project or note page | Attach |
| Click urgency pill | project to-do | Cycle low → medium → high |
| Click section header, Details, Groups | anywhere | Collapse / expand (remembered) |

---

## 12 · Mobile

Under 760px the layout becomes a column: a compact bar (logo · current title ·
`+ New` · `Entries`/`Projects` toggle · `☰ Menu`), the sidebar as a wrapping row of
nav chips (hidden by default), the second column stacked above the page (max 40vh,
hidden by default), and the main area scrolling on its own so the note editor can
be brought to the top of the screen. Row actions are always visible; overview
card to-dos get larger tap targets. The app is installable (web manifest), which
iOS requires for push.

---

## 13 · Server functions and secrets

| Function | Auth | Purpose |
|----------|------|---------|
| `GET /config.js` | none | Public config: Supabase URL, anon key, VAPID public key, whether SMS is on. |
| `GET /api/base-tasks` | user token | The base task list (contains real names and numbers, so never public). |
| `POST /api/assistant` | user token | Chat → actions. Needs `ANTHROPIC_API_KEY`; optional `ASSISTANT_MODEL`. |
| `GET /api/send-reminders` | `CRON_SECRET` | Every minute. Needs `SUPABASE_SERVICE_ROLE_KEY`, VAPID keys and/or Twilio credentials. |
| `POST /api/sms-optin` | user token | `start` / `resend` / `stop` enrollment; state lives in the user's `app_metadata.sms`, writable only with the service role. |
| `POST /api/sms-inbound` | Twilio signature | YES / START / UNSTOP confirm; STOP family records opt-out; HELP is left to Twilio; anything else gets a pointer to the app. |

Every user-token function goes through `lib/verify-user.js`, which checks the
bearer token against Supabase and fails closed. `add-todo.sh` is the legacy Mac
CLI that appended to `todo-inbox.json`; in the cloud edition the equivalent is a
row in `inbox` (task, priority, optional project, notes).
