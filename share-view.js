/* The /s/<token> page: fetch one shared item from /api/share and render it.
 *
 * Note bodies are rich-text HTML written in the app (and possibly pasted from
 * elsewhere), shown here on the app's own origin — so they are never handed to
 * innerHTML as-is. sanitize() parses them inertly with DOMParser and rebuilds
 * the tree from scratch with an allowlist of tags, attributes and CSS
 * properties; anything else (scripts, event handlers, iframes, forms,
 * javascript: links, url() styles) simply never makes it into the page. The
 * Content-Security-Policy on this route (vercel.json) blocks inline script as
 * a second line of defence.
 */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const m = location.pathname.match(/^\/s\/([A-Za-z0-9_-]{20,64})\/?$/);
  const token = m ? m[1] : "";

  const STATUS = {
    todo: ["To do", "pill"], in_progress: ["In progress", "pill pill-blue"],
    waiting: ["Waiting", "pill pill-purple"], done: ["Done", "pill pill-green"],
  };
  const URGENCY = { high: ["High", "pill pill-red"], medium: ["Medium", "pill pill-yellow"], low: ["Low", "pill"] };
  const PROJECT_STATUS = { Active: "pill pill-green", Paused: "pill pill-yellow", Done: "pill" };

  /* ---------- tiny DOM helpers (text only ever goes in as text) ---------- */

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function pill(map, key) {
    const v = map[key];
    return v ? el("span", v[1], v[0]) : null;
  }

  function fmtDate(raw) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  /* ---------- allowlist sanitizer ---------- */

  const TAGS = new Set([
    "p", "div", "span", "br", "hr", "b", "strong", "i", "em", "u", "s", "strike", "del", "ins", "sub", "sup",
    "mark", "small", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code",
    "a", "img", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "font",
  ]);
  const DROP_WITH_CONTENT = new Set(["script", "style", "template", "iframe", "object", "embed", "noscript", "svg", "math", "head", "title", "textarea", "select", "button", "input", "form"]);
  const STYLE_PROPS = ["background-color", "color", "font-weight", "font-style", "text-decoration", "text-decoration-line", "text-align"];
  const CLASSES = new Set(["checklist", "checked"]);

  function safeUrl(raw, forImg) {
    const v = String(raw || "").trim();
    try {
      const u = new URL(v, location.origin);
      if (forImg) return u.protocol === "https:" ? u.href : "";
      return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol) ? u.href : "";
    } catch (e) { return ""; }
  }

  function safeStyle(src) {
    const probe = document.createElement("span");
    probe.setAttribute("style", src);
    const out = [];
    STYLE_PROPS.forEach(p => {
      const v = probe.style.getPropertyValue(p);
      if (v && !/url\(|expression|@import|\\/i.test(v)) out.push(p + ":" + v);
    });
    return out.join(";");
  }

  function cleanNode(src, dst) {
    src.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) { dst.appendChild(document.createTextNode(node.nodeValue)); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;   // comments, processing instructions, ...
      const tag = node.tagName.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) return;
      if (!TAGS.has(tag)) { cleanNode(node, dst); return; }   // unknown wrapper: keep its text, lose the tag

      const href = tag === "a" ? safeUrl(node.getAttribute("href"), false) : "";
      if (tag === "a" && !href) { cleanNode(node, dst); return; }   // unsafe or empty link: keep the words only
      const out = document.createElement(tag === "font" ? "span" : tag);
      if (href) { out.setAttribute("href", href); out.setAttribute("target", "_blank"); out.setAttribute("rel", "noopener noreferrer nofollow"); }
      if (tag === "img") {
        const s = safeUrl(node.getAttribute("src"), true);
        if (!s) return;
        out.setAttribute("src", s);
        out.setAttribute("alt", node.getAttribute("alt") || "");
        out.setAttribute("referrerpolicy", "no-referrer");
        out.setAttribute("loading", "lazy");
      }
      if (tag === "td" || tag === "th") {
        ["colspan", "rowspan"].forEach(a => { const v = parseInt(node.getAttribute(a), 10); if (v > 1 && v < 100) out.setAttribute(a, String(v)); });
      }
      const cls = (node.getAttribute("class") || "").split(/\s+/).filter(c => CLASSES.has(c));
      if (cls.length) out.className = cls.join(" ");
      let style = node.hasAttribute("style") ? safeStyle(node.getAttribute("style")) : "";
      if (tag === "font" && node.getAttribute("color")) style += (style ? ";" : "") + safeStyle("color:" + node.getAttribute("color"));
      if (style) out.setAttribute("style", style);
      cleanNode(node, out);
      dst.appendChild(out);
    });
  }

  function sanitize(html) {
    const doc = new DOMParser().parseFromString("<!doctype html><body>" + String(html || ""), "text/html");
    const frag = document.createDocumentFragment();
    cleanNode(doc.body, frag);
    return frag;
  }

  /* ---------- views ---------- */

  function message(title, text) {
    app.replaceChildren();
    const card = el("div", "card center");
    card.append(el("h2", null, title), el("p", null, text));
    app.appendChild(card);
    return card;
  }

  function askPasscode(errText) {
    const card = message("This link has a passcode", "Enter the passcode you were given to open it.");
    const form = el("form", "pass");
    const input = el("input");
    input.type = "password"; input.autocomplete = "off"; input.placeholder = "Passcode"; input.required = true;
    const btn = el("button", null, "Open");
    btn.type = "submit";
    const err = el("div", "err", errText || "");
    form.append(input, btn, err);
    card.appendChild(form);
    input.focus();
    form.addEventListener("submit", e => {
      e.preventDefault();
      btn.disabled = true;
      load(input.value);
    });
  }

  function header(card, title, bits) {
    card.appendChild(el("h1", null, title || "Untitled"));
    const meta = el("div", "meta");
    bits.filter(Boolean).forEach(b => meta.appendChild(typeof b === "string" ? el("span", null, b) : b));
    if (meta.childNodes.length) card.appendChild(meta);
  }

  function todoRow(t) {
    const row = el("div", "todo" + (t.done ? " done" : ""));
    const box = el("div", "box", t.done ? "✓" : "");
    const main = el("div", "todo-main");
    main.appendChild(el("div", "todo-text", t.text || ""));
    if (t.notes) main.appendChild(el("div", "todo-notes", t.notes));
    const pills = el("div", "pills");
    [pill(STATUS, t.done ? "done" : (t.status || "todo")), t.done ? null : pill(URGENCY, t.urgency)].filter(Boolean).forEach(p => pills.appendChild(p));
    row.append(box, main, pills);
    return row;
  }

  function render(data) {
    const c = data.content || {};
    const updated = data.updated_at ? "Updated " + fmtDate(data.updated_at) : "";
    document.title = (data.title || "Shared with you") + " · Brill HQ";
    app.replaceChildren();
    const card = el("article", "card");

    if (data.kind === "note") {
      header(card, data.title, [c.group ? el("span", "pill", c.group) : null, updated]);
      const body = el("div", "rich");
      body.appendChild(sanitize(c.html));
      card.appendChild(body);
    } else if (data.kind === "task" || data.kind === "ptodo") {
      header(card, data.title, [
        pill(STATUS, c.done ? "done" : (c.status || "todo")),
        c.done ? null : pill(URGENCY, c.urgency),
        c.project ? "Project: " + c.project : (c.section || ""),
        updated,
      ]);
      if (c.notes) { card.appendChild(el("div", "label", "Notes")); card.appendChild(el("div", "plain", c.notes)); }
    } else if (data.kind === "project") {
      const todos = Array.isArray(c.todos) ? c.todos : [];
      const done = todos.filter(t => t.done).length;
      header(card, data.title, [
        c.status ? el("span", PROJECT_STATUS[c.status] || "pill", c.status) : null,
        c.due ? "Due " + fmtDate(c.due + "T12:00:00") : "",
        todos.length ? `${done}/${todos.length} done` : "",
        updated,
      ]);
      if (c.notes) card.appendChild(el("div", "plain", c.notes));
      const open = todos.filter(t => !t.done), finished = todos.filter(t => t.done);
      if (open.length) { card.appendChild(el("div", "label", "To-dos")); open.forEach(t => card.appendChild(todoRow(t))); }
      if (finished.length) { card.appendChild(el("div", "label", "Completed")); finished.forEach(t => card.appendChild(todoRow(t))); }
      if (!todos.length && !c.notes) card.appendChild(el("p", "plain", "Nothing here yet."));
    } else {
      message("Can't show this", "This link points to something this page doesn't know how to display.");
      return;
    }
    app.appendChild(card);
  }

  async function load(passcode) {
    if (!token) { message("Link not found", "Check that you copied the whole link."); return; }
    let res, json = null;
    try {
      res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view", token, passcode: passcode || undefined }),
        credentials: "omit",
        cache: "no-store",
      });
      json = await res.json().catch(() => null);
    } catch (e) {
      message("Couldn't load this", "Check your connection and refresh the page.");
      return;
    }
    if (res.ok && json) { render(json); return; }
    const code = json && json.error;
    if (code === "passcode_required") askPasscode();
    else if (code === "wrong_passcode") askPasscode("That passcode isn't right.");
    else if (code === "locked") askPasscode(json.message || "Too many tries. Wait a few minutes.");
    else if (res.status === 404) message("This link isn't available", "It has expired or been turned off by the person who shared it.");
    else message("Couldn't load this", "Something went wrong. Try again in a moment.");
  }

  load();
})();
