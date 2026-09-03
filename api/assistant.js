/* Vercel serverless function — the Assistant chat behind the app's
 * "Assistant" view. You talk to it in plain English and it turns that into
 * structured actions (add a task, start a project, write a long note, set a
 * reminder) which the *browser* then applies to the user's own data through
 * Supabase with their own session, so Row-Level Security still governs every
 * write. This function never touches the database itself.
 *
 *   POST /api/assistant   Authorization: Bearer <supabase access token>
 *   { messages: [{role:"user"|"assistant", content:string}, ...],
 *     context:  { nowLocal, nowIso, timezone, utcOffset, projects, notes,
 *                 noteGroups, reminders, inboxOpen } }
 *   -> { reply: string, actions: [{ id, name, input }], model }
 *
 * Env (Vercel -> Project -> Settings -> Environment Variables):
 *   ANTHROPIC_API_KEY   required — the assistant is disabled (503) without it
 *   ASSISTANT_MODEL     optional — defaults to claude-opus-5
 *   SUPABASE_URL / SUPABASE_ANON_KEY — already set; used to verify the caller
 */

const Anthropic = require("@anthropic-ai/sdk");
const { verifyUser, jsonBody } = require("../lib/verify-user");

const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5";
const MAX_HISTORY = 24;       // turns of chat history we replay
const MAX_TURN_CHARS = 8000;  // per-message cap, keeps a pasted novel from blowing the request

// Stable instructions first (cached across requests); the per-request state
// (time, projects, notes...) goes in a second system block after it.
const SYSTEM = `You are the intake assistant inside Brill HQ, the user's private task / project / notes dashboard. The user talks to you to capture things quickly, often from a phone or by voice. Your job is to turn what they say into the right records using the tools, then confirm briefly.

What the app holds:
- Tasks: a flat Inbox of quick to-dos with a priority (urgent / high / normal / low). Use add_task WITHOUT a project for a stand-alone to-do.
- Projects: named containers with their own to-do list, status (Active / Paused / Done), owner, due date and notes. Use add_task WITH a project name to file a to-do into a project (it is created if it doesn't exist), or create_project for a brand-new initiative, especially when the user lists several steps.
- Long Notes: free-form documents (meeting notes, plans, brain dumps), optionally under a group heading. Use create_note when the user wants to write something down rather than do something; use append_to_note to add to an existing note they name.
- Reminders: a notification at a specific date and time (with optional repeat). Use set_reminder whenever the user says "remind me", "ping me", "alert me", "don't let me forget", or gives a time to be told about something. A reminder is separate from a task: if they want both ("add a task and remind me Friday"), do both.

How to behave:
- Act immediately on clear requests; don't ask for confirmation first. Only ask a question when something essential is genuinely ambiguous (e.g. "remind me later" with no time at all). Make sensible assumptions otherwise and state them in your reply.
- Match existing project names and note titles from the provided context when the user's wording clearly refers to one (case-insensitive, allow minor variations). Otherwise use the user's wording as the new name.
- Resolve relative dates and times against the current local time given in the context. "Tomorrow morning" = 9:00 AM, "afternoon" = 2:00 PM, "evening" = 6:00 PM, "tonight" = 8:00 PM, "end of day" = 5:00 PM, unless the user says otherwise. If the user gives only a day, use 9:00 AM. Never set a reminder in the past; if the stated time already passed today, use the same time tomorrow and say so.
- due_at must be a full ISO 8601 timestamp WITH the user's UTC offset, e.g. 2026-09-04T09:00:00-07:00.
- Long-form notes: keep the user's own words and structure; use simple Markdown (paragraphs, "- " bullets, "1. " numbered lists, "- [ ] " checkboxes, "## " headings). Don't pad or embellish. Give the note a short descriptive title.
- Tasks: one add_task per to-do; write each as a short imperative sentence. Infer priority from urgency words ("ASAP", "today" -> urgent; "this week", "important" -> high; "someday", "eventually" -> low), default normal.
- You may call several tools in one turn.
- Reply in one or two short sentences confirming what you did, in plain language (e.g. "Added to the Kith Kitchens project and set a reminder for Fri 9:00 AM."). No markdown headings, no bullet lists in the reply, no restating the whole note. If nothing needed recording (small talk, a question about how this works), just answer briefly.`;

const TOOLS = [
  {
    name: "add_task",
    description: "Add a single to-do. Without `project` it lands in the Inbox; with `project` it is filed into that project's to-do list (creating the project if it doesn't exist).",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The to-do, as a short imperative sentence." },
        priority: { type: "string", enum: ["urgent", "high", "normal", "low"], description: "Defaults to normal." },
        project: { type: "string", description: "Optional project name to file this under. Use an existing project's exact name when the user means it." },
        notes: { type: "string", description: "Optional extra detail (names, links, context)." },
      },
      required: ["text"],
    },
  },
  {
    name: "create_project",
    description: "Create a new project (an initiative with its own to-do list). Optionally seed it with to-dos and notes.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short project name." },
        notes: { type: "string", description: "Optional description / context for the project." },
        status: { type: "string", enum: ["Active", "Paused", "Done"], description: "Defaults to Active." },
        due: { type: "string", description: "Optional due date, YYYY-MM-DD." },
        owner: { type: "string", description: "Optional owner name." },
        todos: { type: "array", items: { type: "string" }, description: "Optional initial to-dos, in order." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_note",
    description: "Create a Long Note — a free-form document (meeting notes, a plan, a brain dump). Use simple Markdown in `body`.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short descriptive title." },
        body: { type: "string", description: "The note content in simple Markdown (paragraphs, '- ' bullets, '1. ' lists, '- [ ] ' checkboxes, '## ' headings)." },
        group: { type: "string", description: "Optional group heading to file the note under (reuse an existing group name when it fits)." },
      },
      required: ["title", "body"],
    },
  },
  {
    name: "append_to_note",
    description: "Append text to an existing Long Note (identified by its id from the context).",
    input_schema: {
      type: "object",
      properties: {
        note_id: { type: "string", description: "The note's id, exactly as given in the context." },
        text: { type: "string", description: "What to add, in simple Markdown." },
      },
      required: ["note_id", "text"],
    },
  },
  {
    name: "set_reminder",
    description: "Schedule a notification for a specific date and time. Use for 'remind me', 'ping me', 'alert me', 'don't let me forget'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "What to remind the user about, as they'd want to read it in a notification." },
        due_at: { type: "string", description: "ISO 8601 timestamp with the user's UTC offset, e.g. 2026-09-04T09:00:00-07:00. Must be in the future." },
        notes: { type: "string", description: "Optional extra detail shown in the notification body." },
        repeat: { type: "string", enum: ["none", "daily", "weekdays", "weekly", "monthly"], description: "Defaults to none." },
      },
      required: ["title", "due_at"],
    },
  },
  {
    name: "cancel_reminder",
    description: "Cancel (delete) a pending reminder listed in the context.",
    input_schema: {
      type: "object",
      properties: {
        reminder_id: { type: "string", description: "The reminder's id, exactly as given in the context." },
      },
      required: ["reminder_id"],
    },
  },
];

function clip(s, n) {
  s = String(s == null ? "" : s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// Render the browser-supplied state as a compact text block for the model.
function contextText(ctx) {
  ctx = ctx && typeof ctx === "object" ? ctx : {};
  const lines = [];
  lines.push(`Current local date and time: ${clip(ctx.nowLocal || ctx.nowIso || new Date().toISOString(), 120)}`);
  if (ctx.timezone || ctx.utcOffset) lines.push(`Time zone: ${clip(ctx.timezone || "", 60)} (UTC offset ${clip(ctx.utcOffset || "", 8)})`);
  if (ctx.nowIso) lines.push(`Current time as ISO 8601: ${clip(ctx.nowIso, 40)}`);
  if (typeof ctx.inboxOpen === "number") lines.push(`Inbox: ${ctx.inboxOpen} open to-do(s).`);

  const projects = Array.isArray(ctx.projects) ? ctx.projects.slice(0, 120) : [];
  lines.push("", projects.length ? "Existing projects (name — status, open to-dos):" : "Existing projects: none yet.");
  projects.forEach((p) => lines.push(`- ${clip(p.name, 80)} — ${clip(p.status || "Active", 10)}, ${Number(p.open) || 0} open`));

  const groups = Array.isArray(ctx.noteGroups) ? ctx.noteGroups.slice(0, 40) : [];
  if (groups.length) lines.push("", "Long Note groups: " + groups.map((g) => clip(g, 40)).join("; "));

  const notes = Array.isArray(ctx.notes) ? ctx.notes.slice(0, 120) : [];
  lines.push("", notes.length ? "Existing Long Notes (id | title | group):" : "Existing Long Notes: none yet.");
  notes.forEach((n) => lines.push(`- ${clip(n.id, 40)} | ${clip(n.title || "Untitled", 80)}${n.group ? " | " + clip(n.group, 40) : ""}`));

  const reminders = Array.isArray(ctx.reminders) ? ctx.reminders.slice(0, 60) : [];
  lines.push("", reminders.length ? "Pending reminders (id | when | title):" : "Pending reminders: none.");
  reminders.forEach((r) => lines.push(`- ${clip(r.id, 40)} | ${clip(r.due_local || r.due_at, 40)} | ${clip(r.title, 100)}${r.repeat && r.repeat !== "none" ? " (repeats " + clip(r.repeat, 10) + ")" : ""}`));

  return lines.join("\n");
}

function sanitizeMessages(raw) {
  const out = [];
  (Array.isArray(raw) ? raw : []).slice(-MAX_HISTORY).forEach((m) => {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return;
    const content = clip(typeof m.content === "string" ? m.content : "", MAX_TURN_CHARS).trim();
    if (!content) return;
    out.push({ role: m.role, content });
  });
  // The API requires the conversation to start with a user turn.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "assistant_not_configured", message: "The assistant isn't set up yet: add ANTHROPIC_API_KEY to the Vercel project's environment variables and redeploy." });
    return;
  }

  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }

  const body = jsonBody(req);
  const messages = sanitizeMessages(body.messages);
  if (!messages.length) { res.status(400).json({ error: "empty_message" }); return; }

  const client = new Anthropic({ maxRetries: 2, timeout: 55000 });

  let response;
  try {
    // Beta namespace only for the server-side refusal fallback: if the model
    // declines a request on policy grounds the API re-runs it on a fallback
    // model in the same call, so a stray refusal doesn't strand the user.
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: "Context for this request:\n" + contextText(body.context) },
      ],
      tools: TOOLS,
      tool_choice: { type: "auto" },
      messages,
    });
  } catch (err) {
    const status = err instanceof Anthropic.APIError && err.status ? err.status : 502;
    const msg = err instanceof Anthropic.AuthenticationError
      ? "The ANTHROPIC_API_KEY set in Vercel was rejected."
      : err instanceof Anthropic.RateLimitError
        ? "The assistant is rate-limited right now — try again in a moment."
        : (err && err.message) ? String(err.message) : "assistant request failed";
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: "assistant_failed", message: msg });
    return;
  }

  if (response.stop_reason === "refusal") {
    res.status(200).json({ reply: "I can't help with that one.", actions: [], model: response.model });
    return;
  }

  const reply = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const actions = response.content
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input && typeof b.input === "object" ? b.input : {} }));

  res.status(200).json({ reply, actions, model: response.model, stop_reason: response.stop_reason });
};
