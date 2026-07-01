/* =====================================================================
   BrillDB — Supabase data layer for the Brill HQ cloud app.

   Replaces the old Python-server JSON-blob backend (/api/state, /api/files,
   /api/add-task) with direct browser -> Supabase access. The app's in-memory
   shape is unchanged; this module reconstructs it from the normalized tables
   on load, and writes it back on save. Row-Level Security (every row owned by
   auth.uid()) is the security boundary now that hosting is public, not the
   old Tailscale IP allowlist.

   Config comes from window.BRILL_SUPABASE = { url, anonKey } (see config.js).
   The anon key is public by design — RLS, not secrecy, keeps data private.
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.BRILL_SUPABASE || {};
  const TEXT_CAP = 200000;              // cap client-extracted text stored for search
  const SIGNED_URL_TTL = 8 * 3600;      // signed download links valid for 8h (a work session)
  const BUCKET = "uploads";

  // Extensions we can read as plain text in the browser for in-file search.
  // (The old server also parsed pdf/docx/xlsx; that needs extra libs and is a
  // documented follow-up — binary files still upload, just aren't full-text
  // searchable until then.)
  const TEXT_EXTS = new Set([
    "txt", "md", "markdown", "csv", "tsv", "log", "json", "xml", "html", "htm",
    "js", "ts", "jsx", "tsx", "css", "scss", "py", "rb", "go", "rs", "java",
    "c", "h", "cpp", "sh", "bash", "zsh", "yml", "yaml", "toml", "ini", "sql", "rtf",
  ]);

  function missingConfig() {
    return !CFG.url || !CFG.anonKey || /YOUR_/.test(CFG.url) || /YOUR_/.test(CFG.anonKey);
  }

  let client = null;
  let userId = null;                    // auth.uid() of the signed-in user
  // id -> display name, so file rows can show which project/note they belong to
  // (the files table stores only ids; names live in the app's in-memory state).
  const ctx = { projects: {}, notes: {} };
  const processedInboxIds = new Set();  // inbox rows already filed into a project this session

  function makeClient() {
    if (client || missingConfig()) return client;
    if (!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(CFG.url, CFG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    return client;
  }

  function safeName(name) {
    const base = String(name || "file").split(/[\\/]/).pop().trim() || "file";
    return base.replace(/[^A-Za-z0-9._()\-]/g, "_").slice(0, 160);
  }

  function extOf(name) {
    const n = String(name || "");
    return n.includes(".") ? n.split(".").pop().toLowerCase() : "";
  }

  // Preserve app-supplied timestamps where parseable; otherwise let the DB
  // default (now()) stand by omitting the column entirely.
  function toTs(v) {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  // Reconcile a table to exactly `rows`: upsert the current set, then delete
  // any rows (owned by this user) whose id is no longer present. Data volume is
  // tiny (dozens of rows), so a full sync per save is simpler and safer than
  // per-field diffing, and it matches the old "write the whole blob" model.
  async function reconcile(table, rows, idCol, conflict) {
    if (rows.length) {
      const { error } = await client.from(table).upsert(rows, { onConflict: conflict || idCol });
      if (error) throw error;
    }
    const keep = new Set(rows.map((r) => String(r[idCol])));
    const { data: existing, error: selErr } = await client.from(table).select(idCol);
    if (selErr) throw selErr;
    const doomed = (existing || []).map((r) => r[idCol]).filter((id) => !keep.has(String(id)));
    if (doomed.length) {
      const { error: delErr } = await client.from(table).delete().in(idCol, doomed);
      if (delErr) throw delErr;
    }
  }

  async function ensureUser() {
    if (userId) return userId;
    const { data } = await client.auth.getSession();
    userId = data && data.session ? data.session.user.id : null;
    return userId;
  }

  const BrillDB = {
    /* ---------- lifecycle ---------- */
    missingConfig,
    isReady() { return !!makeClient(); },   // config present AND supabase-js loaded
    ready: Promise.resolve(makeClient()),

    async getSession() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      const session = data ? data.session : null;
      userId = session ? session.user.id : null;
      return session;
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      userId = data.session ? data.session.user.id : null;
      return data.session;
    },

    async signOut() {
      userId = null;
      processedInboxIds.clear();
      if (client) await client.auth.signOut();
    },

    onAuth(cb) {
      if (client) client.auth.onAuthStateChange((_event, session) => cb(session));
    },

    // Let the app hand us current project/note names so file rows can display
    // "attached to <name>" without an extra join.
    setContext(projects, notes) {
      ctx.projects = {};
      ctx.notes = {};
      (projects || []).forEach((p) => { ctx.projects[String(p.id)] = p.name || "Untitled"; });
      (notes || []).forEach((n) => { if (n && n.id) ctx.notes[String(n.id)] = n.title || "Untitled"; });
    },

    /* ---------- whole-state load / save ---------- */

    // Rebuild the app's in-memory state object from the normalized tables.
    async loadAll() {
      await ensureUser();
      const [projRes, todoRes, noteRes, ovrRes] = await Promise.all([
        client.from("projects").select("*").order("sort_order", { ascending: true }),
        client.from("project_todos").select("*").order("sort_order", { ascending: true }),
        client.from("notes").select("*").order("sort_order", { ascending: true }),
        client.from("task_overrides").select("*"),
      ]);
      for (const r of [projRes, todoRes, noteRes, ovrRes]) if (r.error) throw r.error;

      const todosByProject = {};
      (todoRes.data || []).forEach((t) => {
        (todosByProject[t.project_id] = todosByProject[t.project_id] || []).push({
          id: t.id, text: t.body || "", completed: !!t.completed,
          urgency: t.urgency || "medium", createdAt: toTs(t.created_at) || "", notes: t.notes || "",
        });
      });

      const projectItems = (projRes.data || []).map((p) => ({
        id: p.id, name: p.name || "", status: p.status || "Active", owner: p.owner || "",
        due: p.due || "", notes: p.notes || "", personal: !!p.personal, ai: !!p.ai,
        archived: !!p.archived, isTemplate: !!p.is_template,
        createdAt: toTs(p.created_at) || "", updatedAt: toTs(p.updated_at) || "",
        todos: todosByProject[p.id] || [],
      }));

      const personalItems = (noteRes.data || []).map((n) => ({
        id: n.id, title: n.title || "", body: n.body || "", group: n.grp || "",
        archived: !!n.archived,
        createdAt: toTs(n.created_at) || "", updatedAt: toTs(n.updated_at) || "",
      }));

      const completed = {}, edits = {}, notes = {}, deleted = {};
      (ovrRes.data || []).forEach((o) => {
        if (o.completed) completed[o.task_key] = true;
        if (o.edited_text) edits[o.task_key] = o.edited_text;
        if (o.note) notes[o.task_key] = o.note;
        if (o.deleted) deleted[o.task_key] = true;
      });

      return { completed, edits, notes, deleted, projectItems, personalItems };
    },

    // Full normalized sync of the in-memory state. Order matters: projects
    // before project_todos (FK), and files are cleaned up via their own paths.
    async saveAll(state) {
      const uid = await ensureUser();
      if (!uid) throw new Error("not signed in");
      const projects = Array.isArray(state.projectItems) ? state.projectItems : [];
      const personal = Array.isArray(state.personalItems) ? state.personalItems : [];

      const projRows = projects.map((p, i) => ({
        id: String(p.id), user_id: uid, name: p.name || "", status: p.status || "Active",
        owner: p.owner || "", due: p.due || "", notes: p.notes || "", personal: !!p.personal,
        ai: !!p.ai, archived: !!p.archived, is_template: !!p.isTemplate, sort_order: i,
      }));
      await reconcile("projects", projRows, "id");

      const todoRows = [];
      projects.forEach((p) => (p.todos || []).forEach((t, i) => todoRows.push({
        id: String(t.id), user_id: uid, project_id: String(p.id), body: t.text || "",
        completed: !!t.completed, urgency: t.urgency || "medium", notes: t.notes || "", sort_order: i,
      })));
      await reconcile("project_todos", todoRows, "id");

      const noteRows = personal.map((n, i) => ({
        id: String(n.id), user_id: uid, title: n.title || "", body: n.body || "",
        grp: n.group || "", archived: !!n.archived, sort_order: i,
      }));

      const keys = new Set([
        ...Object.keys(state.completed || {}), ...Object.keys(state.edits || {}),
        ...Object.keys(state.notes || {}), ...Object.keys(state.deleted || {}),
      ]);
      const ovrRows = [...keys].map((k) => ({
        user_id: uid, task_key: k,
        completed: !!(state.completed || {})[k],
        edited_text: (state.edits || {})[k] || null,
        note: (state.notes || {})[k] || null,
        deleted: !!(state.deleted || {})[k],
      }));

      await Promise.all([
        reconcile("notes", noteRows, "id"),
        reconcile("task_overrides", ovrRows, "task_key", "user_id,task_key"),
      ]);
    },

    /* ---------- inbox ---------- */

    async loadInbox() {
      await ensureUser();
      const { data, error } = await client.from("inbox").select("*").order("added", { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id, task: r.task || "", priority: r.priority || "normal",
        project: r.project || "", notes: r.notes || "", routed: !!r.routed,
        added: r.added ? new Date(r.added).toLocaleString() : "",
      }));
    },

    async addInbox(item) {
      const uid = await ensureUser();
      const row = {
        user_id: uid, task: String(item.task || "").trim(),
        priority: String(item.priority || "normal").trim(),
        project: String(item.project || "").trim(), notes: String(item.notes || "").trim(),
      };
      const { error } = await client.from("inbox").insert(row);
      if (error) throw error;
    },

    async markInboxRouted(id) {
      if (id == null) return;
      processedInboxIds.add(String(id));
      try { await client.from("inbox").update({ routed: true }).eq("id", id); } catch (e) { /* retry next load */ }
    },

    alreadyRouted(id) {
      return processedInboxIds.has(String(id));
    },

    /* ---------- files ---------- */

    // Attach signed download URLs (bucket is private) and owner display names.
    async _decorate(rows) {
      const paths = rows.map((r) => r.storage_path).filter(Boolean);
      let urlByPath = {};
      if (paths.length) {
        const { data } = await client.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
        (data || []).forEach((d) => { if (d && d.path && d.signedUrl) urlByPath[d.path] = d.signedUrl; });
      }
      return rows.map((r) => ({
        id: r.id, name: r.name || "", ext: r.ext || "", size: r.size || 0, mime: r.mime || "",
        projectId: r.project_id || "", noteId: r.note_id || "",
        projectName: r.project_id ? (ctx.projects[String(r.project_id)] || "Project") : "",
        noteTitle: r.note_id ? (ctx.notes[String(r.note_id)] || "Note") : "",
        uploadedAt: r.uploaded_at || "", url: urlByPath[r.storage_path] || "",
      }));
    },

    // opts: { projectId, noteId, q } — any combination; empty returns all.
    async filesFor(opts) {
      await ensureUser();
      opts = opts || {};
      const base = () => {
        let q = client.from("files").select("*").order("uploaded_at", { ascending: false });
        if (opts.projectId) q = q.eq("project_id", opts.projectId);
        if (opts.noteId) q = q.eq("note_id", opts.noteId);
        return q;
      };
      if (opts.q) {
        // Match the old server's plain substring search. Two ilike queries
        // merged (rather than .or()) so commas/parens/dots in the term can't
        // break PostgREST's filter parser; escape LIKE wildcards so they're
        // treated literally.
        const like = "%" + String(opts.q).replace(/[%_\\]/g, "\\$&") + "%";
        const [byName, byText] = await Promise.all([
          base().ilike("name", like),
          base().ilike("content_text", like),
        ]);
        if (byName.error) throw byName.error;
        if (byText.error) throw byText.error;
        const seen = new Set(), merged = [];
        for (const r of [...(byName.data || []), ...(byText.data || [])]) {
          if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
        }
        return this._decorate(merged);
      }
      const { data, error } = await base();
      if (error) throw error;
      return this._decorate(data || []);
    },

    async filesCount() {
      await ensureUser();
      const { count, error } = await client.from("files").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },

    // owner: { projectId, projectName } | { noteId, noteTitle }
    async uploadFile(file, owner) {
      const uid = await ensureUser();
      owner = owner || {};
      const name = safeName(file.name);
      const ext = extOf(name);
      const fid = "f_" + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
      const path = `${uid}/${fid}/${name}`;

      const up = await client.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined, upsert: false,
      });
      if (up.error) throw up.error;

      let contentText = "";
      if (TEXT_EXTS.has(ext)) {
        try { contentText = (await file.text()).slice(0, TEXT_CAP); } catch (e) { /* best effort */ }
      }

      const row = {
        id: fid, user_id: uid, name, ext, size: file.size || 0, mime: file.type || "",
        project_id: owner.projectId || null, note_id: owner.noteId || null,
        storage_path: path, content_text: contentText,
      };
      const { error } = await client.from("files").insert(row);
      if (error) { await client.storage.from(BUCKET).remove([path]).catch(() => {}); throw error; }
      return (await this._decorate([{ ...row, uploaded_at: new Date().toISOString() }]))[0];
    },

    async deleteFile(id) {
      await ensureUser();
      const { data } = await client.from("files").select("storage_path").eq("id", id).maybeSingle();
      if (data && data.storage_path) await client.storage.from(BUCKET).remove([data.storage_path]).catch(() => {});
      const { error } = await client.from("files").delete().eq("id", id);
      if (error) throw error;
    },

    // Cascade-remove every file attached to a deleted project or note.
    async deleteFilesFor(owner) {
      await ensureUser();
      owner = owner || {};
      let query = client.from("files").select("id,storage_path");
      if (owner.projectId) query = query.eq("project_id", owner.projectId);
      else if (owner.noteId) query = query.eq("note_id", owner.noteId);
      else return 0;
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      const paths = rows.map((r) => r.storage_path).filter(Boolean);
      if (paths.length) await client.storage.from(BUCKET).remove(paths).catch(() => {});
      if (rows.length) {
        const { error: delErr } = await client.from("files").delete().in("id", rows.map((r) => r.id));
        if (delErr) throw delErr;
      }
      return rows.length;
    },
  };

  window.BrillDB = BrillDB;
})();
