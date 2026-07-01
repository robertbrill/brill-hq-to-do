#!/usr/bin/env node
/* =====================================================================
   One-time migration: Mac JSON files  ->  Supabase.

   Reads the old app's local data (todo-state.json, todo-inbox.json,
   todo-files.json + uploads/) and loads it into the normalized Supabase
   tables + Storage bucket.

   It signs in AS THE USER (anon key + email/password) rather than using the
   service-role key, so Row-Level Security stamps every row with the right
   user_id and every uploaded file with the right Storage owner — which is
   exactly what the browser app needs to read them back. No schema change,
   no service-role key handling.

   Usage (run from the Mac, in the old app's data directory):
     npm i @supabase/supabase-js         # once, in this supabase/ folder
     SUPABASE_URL=https://xxxx.supabase.co \
     SUPABASE_ANON_KEY=eyJ... \
     MIGRATE_EMAIL=you@example.com \
     MIGRATE_PASSWORD='your-password' \
     DATA_DIR=/path/to/ai-brill-todo \
     node supabase/migrate.mjs

   DATA_DIR defaults to the current directory. Safe to re-run: projects,
   to-dos, notes, task-overrides and files upsert by id; only inbox rows
   (which have auto-generated ids) would duplicate on a second run.
   ===================================================================== */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  MIGRATE_EMAIL,
  MIGRATE_PASSWORD,
  DATA_DIR = ".",
} = process.env;

const BUCKET = "uploads";

function die(msg) { console.error("✗ " + msg); process.exit(1); }

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) die("SUPABASE_URL and SUPABASE_ANON_KEY are required.");
if (!MIGRATE_EMAIL || !MIGRATE_PASSWORD) die("MIGRATE_EMAIL and MIGRATE_PASSWORD are required (your app login).");

function readJson(name, fallback) {
  const p = path.join(DATA_DIR, name);
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { console.warn(`• ${name} not found or unreadable — skipping (${e.code || e.message})`); return fallback; }
}

// Mirror the app's deterministic id for legacy notes so file attachments
// (which reference noteId) line up after migration.
function legacyNoteId(note) {
  const seed = (note.createdAt || "") + "|" + (note.title || "") + "|" + (note.body || "").slice(0, 80);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return "n_lg" + (h >>> 0).toString(36);
}

function toTs(v) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// Drop undefined keys so we don't overwrite DB defaults (e.g. created_at) with null.
function clean(obj) {
  const out = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  console.log(`→ Signing in as ${MIGRATE_EMAIL} …`);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: MIGRATE_EMAIL, password: MIGRATE_PASSWORD,
  });
  if (authErr) die("Sign-in failed: " + authErr.message);
  const userId = auth.session.user.id;
  console.log(`✓ Signed in (user ${userId})`);

  const state = readJson("todo-state.json", {});
  const inbox = readJson("todo-inbox.json", []);
  const files = readJson("todo-files.json", []);

  const projectItems = Array.isArray(state.projectItems) ? state.projectItems : [];
  const personalItems = Array.isArray(state.personalItems) ? state.personalItems : [];
  const routedInbox = (state.routedInbox && typeof state.routedInbox === "object") ? state.routedInbox : {};

  /* ---- projects ---- */
  const projRows = projectItems.map((p, i) => clean({
    id: String(p.id), user_id: userId, name: p.name || "", status: p.status || "Active",
    owner: p.owner || "", due: p.due || "", notes: p.notes || "", personal: !!p.personal,
    ai: !!p.ai, archived: !!p.archived, is_template: !!p.isTemplate, sort_order: i,
    created_at: toTs(p.createdAt), updated_at: toTs(p.updatedAt),
  }));
  if (projRows.length) {
    const { error } = await supabase.from("projects").upsert(projRows, { onConflict: "id" });
    if (error) die("projects: " + error.message);
  }
  console.log(`✓ projects: ${projRows.length}`);

  /* ---- project_todos ---- */
  const todoRows = [];
  projectItems.forEach((p) => (Array.isArray(p.todos) ? p.todos : []).forEach((t, i) => todoRows.push(clean({
    id: String(t.id), user_id: userId, project_id: String(p.id), body: t.text || "",
    completed: !!t.completed, urgency: t.urgency || "medium", notes: t.notes || "", sort_order: i,
    created_at: toTs(t.createdAt),
  }))));
  if (todoRows.length) {
    const { error } = await supabase.from("project_todos").upsert(todoRows, { onConflict: "id" });
    if (error) die("project_todos: " + error.message);
  }
  console.log(`✓ project_todos: ${todoRows.length}`);

  /* ---- notes (Long Notes) ---- */
  const noteRows = personalItems.map((n, i) => clean({
    id: String(n.id || legacyNoteId(n)), user_id: userId, title: n.title || "", body: n.body || "",
    grp: n.group || "", archived: !!n.archived, sort_order: i,
    created_at: toTs(n.createdAt), updated_at: toTs(n.updatedAt),
  }));
  if (noteRows.length) {
    const { error } = await supabase.from("notes").upsert(noteRows, { onConflict: "id" });
    if (error) die("notes: " + error.message);
  }
  console.log(`✓ notes: ${noteRows.length}`);

  /* ---- task_overrides (legacy static-task edits) ---- */
  const keys = new Set([
    ...Object.keys(state.completed || {}), ...Object.keys(state.edits || {}),
    ...Object.keys(state.notes || {}), ...Object.keys(state.deleted || {}),
  ]);
  const ovrRows = [...keys].map((k) => ({
    user_id: userId, task_key: k,
    completed: !!(state.completed || {})[k],
    edited_text: (state.edits || {})[k] || null,
    note: (state.notes || {})[k] || null,
    deleted: !!(state.deleted || {})[k],
  }));
  if (ovrRows.length) {
    const { error } = await supabase.from("task_overrides").upsert(ovrRows, { onConflict: "user_id,task_key" });
    if (error) die("task_overrides: " + error.message);
  }
  console.log(`✓ task_overrides: ${ovrRows.length}`);

  /* ---- inbox ---- */
  const inboxRows = (Array.isArray(inbox) ? inbox : [])
    .filter((it) => it && (typeof it === "object" ? it.task : it))
    .map((it) => {
      const o = typeof it === "string" ? { task: it } : it;
      const routeKey = (o.task || "") + "|" + (o.added || "");
      return clean({
        user_id: userId, task: o.task || "", priority: o.priority || "normal",
        project: o.project || "", notes: o.notes || "",
        routed: !!routedInbox[routeKey], added: toTs(o.added),
      });
    });
  if (inboxRows.length) {
    const { error } = await supabase.from("inbox").insert(inboxRows);
    if (error) die("inbox: " + error.message);
  }
  console.log(`✓ inbox: ${inboxRows.length}`);

  /* ---- files (blobs -> Storage, metadata -> files table) ---- */
  let uploaded = 0, missing = 0;
  for (const f of (Array.isArray(files) ? files : [])) {
    if (!f || !f.id || !f.name) continue;
    const disk = path.join(DATA_DIR, "uploads", f.id, f.name);
    if (!fs.existsSync(disk)) { missing++; console.warn(`  • file blob missing: ${disk}`); continue; }
    const buf = fs.readFileSync(disk);
    const storagePath = `${userId}/${f.id}/${f.name}`;
    const up = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
      contentType: f.mime || undefined, upsert: true,
    });
    if (up.error) { console.warn(`  • upload failed (${f.name}): ${up.error.message}`); continue; }
    const row = clean({
      id: String(f.id), user_id: userId, name: f.name, ext: f.ext || "",
      size: f.size || buf.length, mime: f.mime || "",
      project_id: f.projectId || null, note_id: f.noteId || null,
      storage_path: storagePath, content_text: f.text || "", uploaded_at: toTs(f.uploadedAt),
    });
    const { error } = await supabase.from("files").upsert(row, { onConflict: "id" });
    if (error) { console.warn(`  • files row failed (${f.name}): ${error.message}`); continue; }
    uploaded++;
  }
  console.log(`✓ files: ${uploaded} uploaded${missing ? `, ${missing} blob(s) missing` : ""}`);

  console.log("\n✅ Migration complete.");
  await supabase.auth.signOut();
}

main().catch((e) => die(e.stack || e.message));
