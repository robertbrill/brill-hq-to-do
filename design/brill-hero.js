/* ==========================================================================
   BRILL MEDIA · "HERO" DESIGN SYSTEM — behaviors
   --------------------------------------------------------------------------
   The interactive half of design/brill-hero.css. Vanilla JS, no deps, no
   build step. Load with `defer`; everything wires itself up on DOMContentLoaded
   and again whenever you call BrillHero.init(root) after re-rendering.

   Declarative hooks (add attributes, no JS needed):
     data-bh-tabs                  on .shell-tabs / .subnav / .navcards / .segmented
                                   → click marks .active (+ aria-selected) and, if the
                                     item has data-target="#id", shows that panel and
                                     hides its siblings with data-bh-panel.
     data-bh-toggle="#id"          on a section-head button → collapses/expands the
                                   element, relabels itself "HIDE –" / "SHOW +".
     data-bh-findings              on a container of .finding-row → the row in view is
                                   full strength, the rest dim (scroll reveal).
     data-bh-copy="#id" | data-bh-copy-text="…"
                                   on a button → copies the text, flashes "Copied".
     data-bh-progress="42"         on .progress → animates .fill to 42%.
     data-bh-mix                   on .mix-row → sizes .mix-block[data-share] by share.
     data-bh-count="146952" data-bh-format="currency|number|compact|percent"
                                   on any element → formats (and counts up) a number.
     data-bh-print                 on a button → window.print() ("Save as PDF").

   Programmatic API (window.BrillHero):
     init(root?)                   wire everything under root (default: document)
     toast(message, {kind, action, onAction, timeout})
     fmt.currency(n) / fmt.number(n) / fmt.compact(n) / fmt.percent(n, digits)
     setProgress(el, pct)
     highlight(el, groupSelector)  give el the ring, remove it from its siblings
   ========================================================================== */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- number formatting -------------------------------------- */
  const fmt = {
    number: (n) => new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0)),
    // Whole dollars by default; keeps cents when the value has them ($6.54).
    currency: (n, digits) => {
      n = Number(n) || 0;
      if (digits == null) digits = Number.isInteger(n) ? 0 : 2;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
    },
    compact: (n) => {
      n = Number(n) || 0;
      const abs = Math.abs(n);
      if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(Math.round(n));
    },
    percent: (n, digits) => (Number(n) || 0).toFixed(digits == null ? 1 : digits) + '%',
    multiplier: (n, digits) => (Number(n) || 0).toFixed(digits == null ? 1 : digits) + '×',
  };

  // `target` is the final value: it decides the digit count so a count-up
  // toward 146952 never flickers cents and one toward 6.54 keeps them.
  function formatBy(kind, value, target) {
    if (target == null) target = value;
    switch (kind) {
      case 'currency': return fmt.currency(value, Number.isInteger(Number(target)) ? 0 : 2);
      case 'compact': return fmt.compact(value);
      case 'percent': return fmt.percent(value);
      case 'multiplier': return fmt.multiplier(value);
      default: return fmt.number(value);
    }
  }

  const reduceMotion = () => global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Count-up for stat numbers: <div class="v" data-bh-count="146952" data-bh-format="currency"> */
  function countUp(el) {
    const target = Number(el.dataset.bhCount);
    const kind = el.dataset.bhFormat || 'number';
    if (!isFinite(target)) return;
    if (reduceMotion() || el.dataset.bhCounted) { el.textContent = formatBy(kind, target, target); return; }
    el.dataset.bhCounted = '1';
    const dur = 700, start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatBy(kind, target * eased, target);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- tabs / segmented / navcards / subnav -------------------- */
  function wireTabs(group) {
    if (group.dataset.bhWired) return;
    group.dataset.bhWired = '1';
    const items = () => $$('a, button', group).filter((el) => el.parentElement === group || el.closest('[data-bh-tabs]') === group);
    const activate = (el) => {
      items().forEach((it) => {
        const on = it === el;
        it.classList.toggle('active', on);
        it.setAttribute('aria-selected', on ? 'true' : 'false');
        if (it.dataset.target) {
          const panel = $(it.dataset.target);
          if (panel) panel.hidden = !on;
        }
      });
      group.dispatchEvent(new CustomEvent('bh:tabchange', { bubbles: true, detail: { tab: el, value: el.dataset.value || el.textContent.trim() } }));
    };
    group.addEventListener('click', (e) => {
      const el = e.target.closest('a, button');
      if (!el || !group.contains(el)) return;
      if (el.tagName === 'A' && (el.getAttribute('href') || '#') === '#') e.preventDefault();
      activate(el);
    });
    // keyboard: arrow keys move between tabs
    group.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (i < 0) return;
      const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      next.focus(); activate(next); e.preventDefault();
    });
    // initial state: honor an existing .active, hide the other panels
    const current = $('.active', group) || items()[0];
    if (current) items().forEach((it) => {
      const on = it === current;
      it.classList.toggle('active', on);
      it.setAttribute('aria-selected', on ? 'true' : 'false');
      if (it.dataset.target) { const p = $(it.dataset.target); if (p) p.hidden = !on; }
    });
  }

  /* ---------- collapsible sections: HIDE – / SHOW + -------------------- */
  function wireToggle(btn) {
    if (btn.dataset.bhWired) return;
    btn.dataset.bhWired = '1';
    const target = $(btn.dataset.bhToggle);
    if (!target) return;
    const showLabel = btn.dataset.showLabel || 'Show +';
    const hideLabel = btn.dataset.hideLabel || 'Hide –';
    const render = () => {
      const open = !target.hidden;
      btn.textContent = open ? hideLabel : showLabel;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      target.hidden = !target.hidden;
      render();
      btn.dispatchEvent(new CustomEvent('bh:toggle', { bubbles: true, detail: { open: !target.hidden, target } }));
    });
    render();
  }

  /* ---------- presentation findings: scroll reveal ---------------------- */
  function wireFindings(container) {
    if (container.dataset.bhWired) return;
    container.dataset.bhWired = '1';
    const rows = $$('.finding-row', container);
    if (!rows.length) return;
    if (!('IntersectionObserver' in global) || reduceMotion()) { rows.forEach((r) => r.classList.remove('dim')); return; }
    rows.forEach((r, i) => { if (i > 0) r.classList.add('dim'); });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) en.target.classList.remove('dim'); });
    }, { rootMargin: '0px 0px -35% 0px', threshold: 0.2 });
    rows.forEach((r) => io.observe(r));
  }

  /* ---------- copy to clipboard ---------------------------------------- */
  function wireCopy(btn) {
    if (btn.dataset.bhWired) return;
    btn.dataset.bhWired = '1';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      let text = btn.dataset.bhCopyText;
      if (text == null && btn.dataset.bhCopy) { const src = $(btn.dataset.bhCopy); text = src ? (src.value != null && src.tagName !== 'DIV' ? src.value : src.innerText) : ''; }
      try {
        await navigator.clipboard.writeText(text || '');
        const old = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('copied');
        setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1400);
      } catch (err) { toast('Could not copy — select the text and copy it manually.', { kind: 'error' }); }
    });
  }

  /* ---------- progress + mix bars ---------------------------------------- */
  function setProgress(el, pct) {
    const fill = $('.fill', el) || el.appendChild(Object.assign(document.createElement('div'), { className: 'fill' }));
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    el.setAttribute('role', 'progressbar'); el.setAttribute('aria-valuenow', String(Math.round(v)));
    el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
    requestAnimationFrame(() => { fill.style.width = v + '%'; });
  }
  function wireMix(row) {
    if (row.dataset.bhWired) return;
    row.dataset.bhWired = '1';
    const blocks = $$('.mix-block', row);
    const total = blocks.reduce((s, b) => s + (Number(b.dataset.share) || 0), 0) || 1;
    blocks.forEach((b, i) => {
      const share = Number(b.dataset.share) || 0;
      b.style.flexGrow = String(Math.max(share / total * 100, 8));
      if (!/\bb\d\b/.test(b.className)) b.classList.add('b' + Math.min(i + 1, 5));
      b.addEventListener('click', () => {
        blocks.forEach((o) => o.classList.toggle('selected', o === b));
        row.dispatchEvent(new CustomEvent('bh:mixselect', { bubbles: true, detail: { block: b, share } }));
      });
    });
  }

  /* ---------- highlight ring: exactly one per group ------------------- */
  function highlight(el, groupSelector) {
    const group = groupSelector ? $$(groupSelector) : Array.from(el.parentElement.children);
    group.forEach((it) => it.classList.toggle('hl', it === el));
  }

  /* ---------- toast --------------------------------------------------- */
  function toast(message, opts) {
    opts = opts || {};
    let stack = $('.bh .toast-stack') || $('.toast-stack');
    if (!stack) {
      stack = document.createElement('div'); stack.className = 'toast-stack';
      ($('.bh') || document.body).appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (opts.kind ? ' ' + opts.kind : '');
    el.setAttribute('role', 'status');
    el.textContent = message;
    if (opts.action) {
      const b = document.createElement('button'); b.className = 'btn btn-soft btn-sm'; b.textContent = opts.action;
      b.addEventListener('click', () => { opts.onAction && opts.onAction(); el.remove(); });
      el.appendChild(b);
    }
    stack.appendChild(el);
    const t = setTimeout(() => el.remove(), opts.timeout == null ? 4000 : opts.timeout);
    el.addEventListener('click', () => { clearTimeout(t); if (!opts.action) el.remove(); });
    return el;
  }

  /* ---------- init ---------------------------------------------------- */
  function init(root) {
    root = root || document;
    $$('[data-bh-tabs]', root).forEach(wireTabs);
    $$('[data-bh-toggle]', root).forEach(wireToggle);
    $$('[data-bh-findings]', root).forEach(wireFindings);
    $$('[data-bh-copy], [data-bh-copy-text]', root).forEach(wireCopy);
    $$('[data-bh-progress]', root).forEach((el) => setProgress(el, el.dataset.bhProgress));
    $$('[data-bh-mix]', root).forEach(wireMix);
    $$('[data-bh-count]', root).forEach(countUp);
    $$('[data-bh-print]', root).forEach((b) => { if (!b.dataset.bhWired) { b.dataset.bhWired = '1'; b.addEventListener('click', () => global.print()); } });
    // Buttons must never wrap: warn in dev if one does.
    $$('.btn', root).forEach((b) => { if (b.scrollWidth > b.clientWidth + 1) b.setAttribute('data-bh-overflow', '1'); });
  }

  const api = { init, toast, fmt, setProgress, highlight, countUp };
  global.BrillHero = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
})(window);
