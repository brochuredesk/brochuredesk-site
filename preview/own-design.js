/* "Want your own design?" cards and request form.
   window.OwnDesign.mount(el, ctx). See the bottom of this file for ctx. All words live in COPY (drafts). */
(function () {
  'use strict';

  // ---------- COPY: every customer-facing string (DRAFT, the owner's call) ----------
  const COPY = {
    support: 'support@brochuredesk.com',
    agent: {
      heading: 'Your own design',
      body: "Send us your logo, colors and a piece or two you like. We'll build a fold-over that's yours alone, saved to your account for every listing after.",
      price: '$100 for the fold-over. Want the flyers or postcards to match? $25 each, one time.',
      promise: 'Ready in 2 business days. We keep fixing it until you approve it, and you pay only then.',
      button: 'Request my design'
    },
    brokerage: {
      heading: 'One design for your whole brokerage',
      body: "We build one fold-over around your brokerage's brand. Every agent you sponsor can use it, and each agent's pieces carry their own contact card.",
      price: '$250 for the fold-over. Matching flyers or postcards are $25 each, one time.',
      promise: 'Ready in 2 business days. We keep fixing it until you approve it, and you pay only then.',
      button: 'Request a brokerage design'
    },
    // Used when the org is a team instead of a brokerage (broker mode and public mode).
    team: {
      heading: 'One design for your whole team',
      body: "We build one fold-over around your team's brand. Every agent on your team can use it, and each agent's pieces carry their own contact card.",
      price: '$250 for the fold-over. Matching flyers or postcards are $25 each, one time.',
      promise: 'Ready in 2 business days. We keep fixing it until you approve it, and you pay only then.',
      button: 'Request a team design'
    },
    toggle: { label: 'I am', agent: 'An agent', broker: 'A team or broker' },
    portal: {
      above: {
        brokerage: 'Pick a design just for you, or one your whole brokerage can use.',
        team: 'Pick a design just for you, or one your whole team can use.'
      },
      orgHeading: { brokerage: 'One design for everyone', team: 'One design for everyone' },
      orgBody: {
        brokerage: 'Want one design for everyone at {org}? Ask your manager to reach out to us for brokerage-wide pricing.',
        team: 'Want one design for everyone on {org}? Ask your team lead to reach out to us for team-wide pricing.'
      },
      button: { brokerage: 'Let my manager know', team: 'Let my team lead know' },
      done: {
        brokerage: "Thanks. We'll be ready when your manager reaches out. They can write to {support}.",
        team: "Thanks. We'll be ready when your team lead reaches out. They can write to {support}."
      }
    },
    form: {
      name: 'Name', preferred: 'What should we call you?', email: 'Email', brokerage: 'Brokerage',
      logoHeading: 'Your logo', logoHint: 'PNG, JPG, WebP, SVG, PDF, AI or EPS. Up to 8 MB.',
      logoChoose: 'Choose a logo file', logoChange: 'Use a different logo', logoRemove: 'Remove',
      kitLine: "We'll use the logo and colors from your brand kit.",
      colorsHeading: 'Brand colors', colorsSuggest: 'We picked these from your logo.', colorsUse: 'Use these colors',
      colorsUsed: 'Colors confirmed.', colorsPick: 'Pick your colors', colorsOptional: 'Optional. Click a color to change it.',
      colorsAdd: 'Add a color', colorRemove: 'Remove color',
      likeHeading: 'Pieces you like (optional)', likeHint: 'Up to 2 files. PNG, JPG, WebP or PDF, up to 12 MB each.', likeChoose: 'Choose files',
      piecesHeading: 'Add matching pieces, $25 each',
      pieces: {
        'listing-flyer': 'Listing flyer',
        'open-house-flyer': 'Open House flyer',
        'just-listed-postcard': 'Just Listed postcard',
        'just-sold-postcard': 'Just Sold postcard'
      },
      notes: 'Anything we should know?',
      uploadsNote: "Uploads are optional. If anything's missing, our reply will ask for it.",
      sending: 'Sending...',
      thanks: 'Thanks, {preferred}. Your request is in.',
      due: 'Your first look is due {due}.',
      sentTo: 'We sent a confirmation to {email}.'
    },
    errors: {
      'rate-limit': "You've sent a few requests already today. Email {support} and we'll help.",
      'too-large': 'Those files are too big. Keep the logo under 8 MB, each piece under 12 MB, and everything together under 25 MB.',
      'bad-file': "We can't use one of those file types. Logos can be PNG, JPG, WebP, SVG, PDF, AI or EPS. Pieces can be PNG, JPG, WebP or PDF.",
      'missing-name': 'Add your name so we know who this is for.',
      'missing-email': 'Add your email so we know where to reply.',
      generic: "We couldn't send that just now. Try again, or email {support}.",
      needName: 'Add your name.', needEmail: 'Add an email address we can reply to.', badEmail: "That email doesn't look right. Check it and try again.",
      needBrokerage: 'Add your brokerage.',
      logoType: 'That logo file type will not work. Use PNG, JPG, WebP, SVG, PDF, AI or EPS.',
      logoSize: 'That logo is over 8 MB. Send a smaller file, or email it to {support}.',
      likeType: 'We can take PNG, JPG, WebP or PDF for the pieces you like.',
      likeSize: '"{file}" is over 12 MB. Send a smaller file, or email it to {support}.',
      likeCount: 'Choose up to 2 pieces. We kept the first two.',
      totalSize: 'Together your files are over 25 MB. Remove one or send smaller files.',
      notes: 'Keep the notes under 2,000 characters.'
    }
  };

  const LIMITS = { logo: 8 * 1048576, like: 12 * 1048576, total: 25 * 1048576, notes: 2000 };
  const LOGO_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'pdf', 'ai', 'eps'];
  const LIKE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
  const RASTER_SVG = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  const PIECE_KEYS = ['listing-flyer', 'open-house-flyer', 'just-listed-postcard', 'just-sold-postcard'];
  const DEFAULT_ENDPOINT = 'https://depwvwewbmxspoxidxrx.supabase.co/functions/v1/design-request';
  const DEFAULT_KEY = 'sb_publishable_mF60NaxAKLQV_pDLBoR2og_PzJ9fxxH';
  const BASE_CENTS = { agent: 10000, brokerage: 25000 };
  const PIECE_CENTS = 2500;

  // ---------- styles ----------
  const CSS = `
.od{--od-primary:var(--team-primary,var(--emerald,#1F1D1A));--od-deep:var(--team-deep,var(--od-primary));--od-ink:var(--team-ink,var(--ink,#1E2226));--od-muted:var(--slate,var(--muted,#5b6166));--od-line:var(--line,#d9d6d2);--od-card:#fff;--od-accent:var(--brass,var(--od-primary));
  font-family:var(--team-body,var(--body,system-ui,-apple-system,sans-serif));color:var(--od-ink);font-size:16px;line-height:1.5;display:grid;gap:20px;min-width:0}
.od *{box-sizing:border-box}
.od [hidden]{display:none!important}
.od-above{font-size:17px;color:var(--od-muted);margin:0}
.od-toggle{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.od-toggle>span{font-size:14px;font-weight:600;color:var(--od-muted)}
.od-seg{display:inline-flex;border:1px solid var(--od-ink);border-radius:999px;overflow:hidden}
.od-seg button{font:600 14.5px/1 inherit;font-family:inherit;border:0;background:transparent;color:var(--od-ink);padding:11px 18px;cursor:pointer}
.od-seg button[aria-pressed="true"]{background:var(--od-ink);color:#fff}
.od-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:22px;align-items:stretch}
.od-cards.one{grid-template-columns:minmax(0,640px)}
.od-card{background:var(--od-card);border:1px solid var(--od-line);border-radius:4px;padding:clamp(20px,3vw,30px);display:grid;gap:14px;align-content:start;min-width:0;transition:opacity .15s,border-color .15s,box-shadow .15s}
.od-card.on{border-color:var(--od-ink);box-shadow:0 14px 30px -18px rgba(30,34,38,.45)}
.od-card.dim{opacity:.62}
.od-card h3{margin:0;font-family:var(--team-display,var(--display,Georgia,serif));font-weight:400;font-size:clamp(24px,2.6vw,30px);line-height:1.1;text-wrap:balance}
.od-card p{margin:0;color:var(--od-muted)}
.od-card .od-price{color:var(--od-ink);font-weight:600}
.od-card .od-logo{max-width:180px;max-height:48px}
.od-card .od-logo svg,.od-card .od-logo img{max-width:100%;max-height:48px;height:auto;display:block}
.od-btn{display:inline-flex;align-items:center;justify-content:center;justify-self:start;border:0;border-radius:var(--od-radius,3px);background:var(--od-primary);color:#fff;font:600 15px/1.1 inherit;font-family:inherit;padding:14px 22px;cursor:pointer;text-decoration:none;min-height:44px}
.od-btn:hover{background:var(--od-deep)}
.od-btn[disabled]{opacity:.6;cursor:default}
.od-btn.line{background:transparent;color:var(--od-ink);border:1px solid var(--od-ink)}
.od-btn.sm{padding:9px 14px;min-height:38px;font-size:14px}
.od-link{background:none;border:0;padding:0;font:inherit;font-size:14px;color:var(--od-muted);text-decoration:underline;cursor:pointer}
.od-done{color:var(--od-ink)!important;border-left:3px solid var(--od-primary);padding-left:12px}
.od :focus-visible{outline:2px solid var(--od-primary);outline-offset:2px}
.od-formwrap{min-width:0}
.od-form{background:var(--od-card);border:1px solid var(--od-ink);border-radius:4px;padding:clamp(18px,3vw,30px);display:grid;gap:22px;max-width:760px}
.od-form h4{margin:0 0 8px;font:600 16px/1.3 inherit;font-family:inherit}
.od-form h3.od-fh{margin:0;font-family:var(--team-display,var(--display,Georgia,serif));font-weight:400;font-size:24px}
.od-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.od-fields label{display:grid;gap:5px;font-size:13.5px;font-weight:600;min-width:0}
.od-lbl{display:grid;gap:5px;font-size:13.5px;font-weight:600}
.od-fields label.full{grid-column:1/-1}
@media (max-width:560px){.od-fields{grid-template-columns:minmax(0,1fr)}}
.od-form input[type=text],.od-form input[type=email],.od-form textarea{font:inherit;font-weight:400;font-size:16px;padding:11px 12px;border:1px solid #b5b3ae;border-radius:3px;background:#fff;color:var(--od-ink);width:100%;min-width:0}
.od-form textarea{min-height:96px;resize:vertical}
.od-hint{font-size:13.5px;color:var(--od-muted);margin:0}
.od-file{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.od-file input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.od-fname{font-size:14px;color:var(--od-ink);word-break:break-all}
.od-prev{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px}
.od-prev .od-thumb{width:120px;height:64px;border:1px solid var(--od-line);border-radius:3px;background:#f6f5f3;display:grid;place-items:center;overflow:hidden;padding:4px}
.od-prev .od-thumb img,.od-prev .od-thumb svg{max-width:100%;max-height:100%;width:auto;height:auto}
.od-swatches{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:8px}
.od-sw{display:inline-flex;align-items:center;gap:2px}
.od-sw input[type=color]{width:44px;height:44px;padding:0;border:1px solid #b5b3ae;border-radius:3px;background:#fff;cursor:pointer}
.od-sw.unset input[type=color]{border-style:dashed;opacity:.55}
.od-sw .x{width:28px;height:28px;border:0;background:none;color:var(--od-muted);font-size:18px;line-height:1;cursor:pointer}
.od-pieces{display:grid;gap:4px}
.od-chk{display:flex;align-items:center;gap:10px;font-size:15.5px;padding:7px 0;cursor:pointer}
.od-chk input{width:20px;height:20px;accent-color:var(--od-primary);flex:none;margin:0}
.od-total{font-weight:600;margin:8px 0 0}
.od-err{border-left:3px solid #a63a2a;background:#fbf3f1;padding:10px 14px;font-size:15px;color:#6b231a}
.od-note{border-left:3px solid var(--od-accent);background:#faf8f4;padding:10px 14px;font-size:14.5px}
.od-hp{position:absolute!important;left:-9999px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important}
.od-ok{background:var(--od-card);border:1px solid var(--od-ink);border-radius:4px;padding:clamp(20px,3vw,32px);display:grid;gap:8px;max-width:760px}
.od-ok h3{margin:0;font-family:var(--team-display,var(--display,Georgia,serif));font-weight:400;font-size:clamp(26px,3vw,34px)}
.od-ok p{margin:0}
`;
  function injectCss() {
    if (document.getElementById('od-css')) return;
    const s = document.createElement('style');
    s.id = 'od-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- small helpers ----------
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
  const ext = f => ((f.name || '').split('.').pop() || '').toLowerCase();
  const money = c => '$' + (c / 100).toLocaleString('en-US');
  const firstWord = s => (String(s || '').trim().split(/\s+/)[0] || '');
  const hex2 = n => ('0' + n.toString(16)).slice(-2);
  const rgbHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);

  // Inline brand-kit SVG: keep it as a picture only.
  function safeSvg(markup) {
    try {
      const doc = new DOMParser().parseFromString(String(markup), 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
      svg.querySelectorAll('script,foreignObject,iframe,object,embed').forEach(n => n.remove());
      svg.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
        if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
      }));
      return document.importNode(svg, true);
    } catch (e) { return null; }
  }
  const svgBlob = markup => new Blob([markup], { type: 'image/svg+xml' });

  // Pull 2-4 brand colors out of a raster or SVG picture.
  function extractColors(blob) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const done = v => { URL.revokeObjectURL(url); resolve(v); };
      img.onload = () => {
        try {
          const iw = img.naturalWidth || 300, ih = img.naturalHeight || 150;
          const sc = 96 / Math.max(iw, ih);
          const w = Math.max(1, Math.round(iw * sc)), hh = Math.max(1, Math.round(ih * sc));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = hh;
          const cx = cv.getContext('2d', { willReadFrequently: true });
          cx.drawImage(img, 0, 0, w, hh);
          const d = cx.getImageData(0, 0, w, hh).data;
          const buckets = new Map();
          let total = 0;
          for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            if (a < 128) continue;
            const r = d[i], g = d[i + 1], b = d[i + 2];
            if (r > 235 && g > 235 && b > 235) continue;
            if (r < 32 && g < 32 && b < 32) continue;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            if (mx > 215 && (mx - mn) < 60) continue;   // pale tints, usually edge blending
            total++;
            const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
            const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
            e.n++; e.r += r; e.g += g; e.b += b;
            buckets.set(key, e);
          }
          if (!total) return done([]);
          const list = [...buckets.values()].sort((x, y) => y.n - x.n);
          const out = [];
          for (const e of list) {
            if (e.n < total * 0.02) break;
            const c = [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)];
            if (out.every(o => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 60)) out.push(c);
            if (out.length === 4) break;
          }
          done(out.map(c => rgbHex(c[0], c[1], c[2])));
        } catch (e) { done([]); }
      };
      img.onerror = () => done([]);
      img.src = url;
    });
  }

  // ---------- mount ----------
  function mount(el, ctx) {
    ctx = ctx || {};
    injectCss();
    const qs = new URLSearchParams(location.search);
    const mockParam = qs.get('mock');
    const mode = ['public', 'agent', 'broker', 'portal'].includes(ctx.mode) ? ctx.mode : 'public';
    const org = ctx.org || null;
    const orgKind = org && org.kind === 'team' ? 'team' : 'brokerage';
    const person = ctx.person || null;
    const endpoint = ctx.endpoint || DEFAULT_ENDPOINT;
    const apikey = ctx.apikey || DEFAULT_KEY;
    const mock = ctx.mock === true || mockParam === '1' || mockParam === 'fail';
    const mockFail = mockParam === 'fail';
    const hasKit = !!(org && (org.logoSvg || (org.colors && org.colors.length)));
    const orgCopy = COPY[orgKind === 'team' ? 'team' : 'brokerage'];

    const root = h('div', { class: 'od' });
    el.textContent = '';
    el.appendChild(root);

    const st = { kind: null, logo: null, logoOnFile: !!ctx.logo, useOwnLogo: false, likes: [], colors: [], suggested: false, confirmed: false, pieces: new Set(), managerDone: false };

    const cardsWrap = h('div', { class: 'od-cards' });
    const formWrap = h('div', { class: 'od-formwrap' });
    const cards = {};

    function card(kind) {
      const c = kind === 'agent' ? COPY.agent : orgCopy;
      const node = h('article', { class: 'od-card', 'data-card': kind });
      if (kind === 'brokerage' && org && org.logoSvg && mode !== 'public') {
        const svg = safeSvg(org.logoSvg);
        if (svg) node.append(h('div', { class: 'od-logo', 'aria-hidden': 'true' }, svg));
      }
      node.append(h('h3', { text: c.heading }), h('p', { text: c.body }), h('p', { class: 'od-price', text: c.price }), h('p', { text: c.promise }));
      node.append(h('button', { type: 'button', class: 'od-btn', text: c.button, onclick: () => openForm(kind) }));
      return node;
    }

    function portalOrgCard() {
      const node = h('article', { class: 'od-card', 'data-card': 'org' });
      if (org.logoSvg) {
        const svg = safeSvg(org.logoSvg);
        if (svg) node.append(h('div', { class: 'od-logo', 'aria-hidden': 'true' }, svg));
      }
      node.append(h('h3', { text: COPY.portal.orgHeading[orgKind] }));
      node.append(h('p', { text: fill(COPY.portal.orgBody[orgKind], { org: org.name || '' }) }));
      const status = h('p', { class: 'od-done', role: 'status', hidden: true, text: fill(COPY.portal.done[orgKind], { support: COPY.support }) });
      const err = h('div', { class: 'od-err', role: 'alert', hidden: true });
      const btn = h('button', { type: 'button', class: 'od-btn line', text: COPY.portal.button[orgKind] });
      btn.addEventListener('click', async () => {
        btn.disabled = true; err.hidden = true;
        const fd = new FormData();
        fd.append('kind', 'manager');
        const nm = (person && person.name) || '';
        fd.append('name', nm);
        fd.append('preferred', (person && person.preferred) || firstWord(nm));
        fd.append('email', (person && person.email) || '');
        fd.append('brokerage', (person && person.brokerage) || (org && org.name) || '');
        if (ctx.portal) fd.append('portal', ctx.portal);
        fd.append('website', '');
        try {
          const r = await send(fd);
          if (r && r.ok) { btn.hidden = true; status.hidden = false; return; }
          err.textContent = errorText(r && r.error); err.hidden = false;
        } catch (e) { err.textContent = errorText(); err.hidden = false; }
        btn.disabled = false;
      });
      node.append(btn, status, err);
      return node;
    }

    // ----- layout by mode -----
    if (mode === 'portal' && org) root.append(h('p', { class: 'od-above', text: COPY.portal.above[orgKind] }));
    if (mode === 'public') {
      const mk = (key, label) => h('button', { type: 'button', 'aria-pressed': 'false', 'data-who': key, text: label, onclick: () => highlight(key) });
      root.append(h('div', { class: 'od-toggle' }, h('span', { text: COPY.toggle.label }),
        h('div', { class: 'od-seg', role: 'group', 'aria-label': COPY.toggle.label }, mk('agent', COPY.toggle.agent), mk('broker', COPY.toggle.broker))));
    }
    if (mode === 'public' || mode === 'agent' || mode === 'portal') { cards.agent = card('agent'); cardsWrap.append(cards.agent); }
    if (mode === 'public' || mode === 'broker') { cards.brokerage = card('brokerage'); cardsWrap.append(cards.brokerage); }
    if (mode === 'portal' && org) { cards.org = portalOrgCard(); cardsWrap.append(cards.org); }
    if (cardsWrap.children.length === 1) cardsWrap.classList.add('one');
    root.append(cardsWrap, formWrap);

    function highlight(who) {
      root.querySelectorAll('.od-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === who)));
      cards.agent.classList.toggle('on', who === 'agent'); cards.agent.classList.toggle('dim', who !== 'agent');
      cards.brokerage.classList.toggle('on', who === 'broker'); cards.brokerage.classList.toggle('dim', who !== 'broker');
    }

    // ----- network -----
    async function send(fd) {
      if (mock) {
        await new Promise(r => setTimeout(r, 600));
        if (mockFail) return { ok: false, error: 'server-error' };
        return { ok: true, id: 'mock', due: new Date(Date.now() + 2 * 864e5).toISOString(), dueLabel: 'Thursday, October 23 by 3:15 PM Central', feeCents: 0 };
      }
      const headers = { apikey: apikey };
      if (ctx.accessToken) headers.Authorization = 'Bearer ' + ctx.accessToken;
      const res = await fetch(endpoint, { method: 'POST', headers, body: fd });
      let j = null;
      try { j = await res.json(); } catch (e) { /* not json */ }
      if (!j) throw new Error('bad response');
      return j;
    }
    function errorText(code) {
      const E = COPY.errors, v = { support: COPY.support };
      if (code && E[code] && code !== 'generic') return fill(E[code], v);
      return fill(E.generic, v);
    }

    // ----- the form -----
    function openForm(kind) {
      if (kind !== st.kind) {
        st.kind = kind; st.logo = null; st.useOwnLogo = false; st.likes = []; st.colors = []; st.suggested = false; st.confirmed = false; st.pieces = new Set();
      }
      renderForm();
      formWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const first = formWrap.querySelector('input,textarea');
      if (first) first.focus({ preventScroll: true });
    }

    function renderForm() {
      const kind = st.kind;
      const isOrg = kind === 'brokerage';
      const copy = kind === 'agent' ? COPY.agent : orgCopy;
      const kit = isOrg && hasKit;
      const base = BASE_CENTS[kind];
      const needPerson = !(person && person.name && person.email);
      const F = COPY.form;

      formWrap.textContent = '';
      const form = h('form', { class: 'od-form', novalidate: true, 'aria-label': copy.heading });
      form.append(h('h3', { class: 'od-fh', text: copy.heading }));

      const nameI = h('input', { type: 'text', name: 'name', autocomplete: 'name', value: (person && person.name) || '' });
      const prefI = h('input', { type: 'text', name: 'preferred', autocomplete: 'nickname', value: (person && person.preferred) || '' });
      const emailI = h('input', { type: 'email', name: 'email', autocomplete: 'email', inputmode: 'email', value: (person && person.email) || '' });
      const brokI = h('input', { type: 'text', name: 'brokerage', autocomplete: 'organization', value: (person && person.brokerage) || (isOrg && org && org.name) || '' });
      if (needPerson) {
        form.append(h('div', { class: 'od-fields' },
          h('label', {}, F.name, nameI),
          h('label', {}, F.preferred, prefI),
          h('label', {}, F.email, emailI),
          h('label', {}, F.brokerage, brokI)));
      }

      // logo and colors
      const logoBox = h('div'), colorBox = h('div'), logoErr = h('div', { class: 'od-err', role: 'alert', hidden: true });
      if (kit) {
        form.append(h('p', { class: 'od-note', text: F.kitLine }));
      } else {
        form.append(logoBox, colorBox);
      }

      // likes
      const likeBox = h('div');
      form.append(likeBox);

      // pieces
      const totalP = h('p', { class: 'od-total', 'aria-live': 'polite' });
      const pieceBox = h('div', { class: 'od-pieces' });
      PIECE_KEYS.forEach(k => {
        const cb = h('input', { type: 'checkbox', value: k });
        cb.checked = st.pieces.has(k);
        cb.addEventListener('change', () => { cb.checked ? st.pieces.add(k) : st.pieces.delete(k); updateTotal(); });
        pieceBox.append(h('label', { class: 'od-chk' }, cb, F.pieces[k]));
      });
      form.append(h('div', {}, h('h4', { text: F.piecesHeading }), pieceBox, totalP));
      function updateTotal() {
        const n = st.pieces.size;
        const t = base + n * PIECE_CENTS;
        totalP.textContent = n
          ? `Fold-over ${money(base)} + ${n} ${n === 1 ? 'piece' : 'pieces'} ${money(n * PIECE_CENTS)} = ${money(t)}, charged only when you approve`
          : `Fold-over ${money(base)}, charged only when you approve`;
      }
      updateTotal();

      const notes = h('textarea', { name: 'notes', maxlength: String(LIMITS.notes), rows: '4' });
      form.append(h('label', { class: 'od-lbl' }, F.notes, notes));

      // honeypot
      const hp = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
      form.append(h('div', { class: 'od-hp', 'aria-hidden': 'true' }, hp));

      form.append(h('p', { class: 'od-hint', text: F.uploadsNote }));
      const err = h('div', { class: 'od-err', role: 'alert', hidden: true });
      const submit = h('button', { type: 'submit', class: 'od-btn', text: copy.button });
      form.append(err, submit);
      formWrap.append(form);

      const showErr = msg => { err.textContent = msg; err.hidden = false; err.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
      const E = COPY.errors, V = { support: COPY.support };

      // --- logo section ---
      function renderLogo() {
        logoBox.textContent = '';
        logoBox.append(h('h4', { text: F.logoHeading }));
        const onFile = st.logoOnFile && !st.useOwnLogo && !st.logo;
        const input = h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.webp,.svg,.pdf,.ai,.eps,image/*,application/pdf', 'aria-label': F.logoChoose });
        input.addEventListener('change', () => {
          const f = input.files[0]; if (!f) return;
          logoErr.hidden = true;
          if (!LOGO_EXT.includes(ext(f))) { logoErr.textContent = fill(E.logoType, V); logoErr.hidden = false; input.value = ''; return; }
          if (f.size > LIMITS.logo) { logoErr.textContent = fill(E.logoSize, V); logoErr.hidden = false; input.value = ''; return; }
          st.logo = f; st.useOwnLogo = true; st.colors = []; st.suggested = false; st.confirmed = false;
          renderLogo(); suggest(f);
        });
        const pick = h('label', { class: 'od-btn line sm' }, onFile ? F.logoChange : F.logoChoose, input);
        if (onFile) {
          logoBox.append(h('div', { class: 'od-prev' }, h('div', { class: 'od-thumb' }, logoPreviewNode(ctx.logo)), pick));
        } else if (st.logo) {
          const prev = h('div', { class: 'od-thumb' });
          if (RASTER_SVG.includes(ext(st.logo))) { const u = URL.createObjectURL(st.logo); prev.append(h('img', { src: u, alt: 'Your logo', onload: () => URL.revokeObjectURL(u) })); }
          else prev.append(h('span', { class: 'od-hint', text: ext(st.logo).toUpperCase() }));
          const rm = h('button', { type: 'button', class: 'od-link', text: F.logoRemove, onclick: () => { st.logo = null; st.useOwnLogo = false; st.colors = []; st.suggested = false; st.confirmed = false; renderLogo(); renderColors(); if (st.logoOnFile) suggest(null); } });
          logoBox.append(h('div', { class: 'od-prev' }, prev, h('span', { class: 'od-fname', text: st.logo.name }), pick, rm));
        } else {
          logoBox.append(h('div', { class: 'od-file' }, pick), h('p', { class: 'od-hint', text: F.logoHint }));
        }
        logoBox.append(logoErr);
      }
      function logoPreviewNode(l) {
        if (l && l.svg) { const s = safeSvg(l.svg); if (s) return s; }
        if (l && l.url) return h('img', { src: l.url, alt: 'Your logo on file' });
        return document.createTextNode('');
      }

      // --- colors section ---
      function renderColors() {
        colorBox.textContent = '';
        const heading = st.suggested ? F.colorsHeading : F.colorsPick;
        colorBox.append(h('h4', { text: heading }));
        const row = h('div', { class: 'od-swatches' });
        const slots = st.colors.length ? st.colors : [null];
        slots.forEach((c, i) => {
          const inp = h('input', { type: 'color', value: c || '#ffffff', 'aria-label': 'Brand color ' + (i + 1) });
          const wrap = h('span', { class: 'od-sw' + (c ? '' : ' unset') }, inp);
          inp.addEventListener('input', () => {
            st.colors[i] = inp.value.toLowerCase(); st.confirmed = true;
            wrap.classList.remove('unset'); renderColorsActions();
          });
          if (c || st.colors.length > 1) {
            wrap.append(h('button', { type: 'button', class: 'x', 'aria-label': F.colorRemove, text: '×', onclick: () => { st.colors.splice(i, 1); if (!st.colors.length) st.suggested = false; renderColors(); } }));
          }
          row.append(wrap);
        });
        colorBox.append(row);
        const actions = h('div', { class: 'od-file', style: 'margin-top:8px' });
        colorBox.append(actions, h('p', { class: 'od-hint', text: st.suggested ? F.colorsSuggest : F.colorsOptional }));
        colorBox._actions = actions;
        renderColorsActions();
      }
      function renderColorsActions() {
        const a = colorBox._actions; if (!a) return;
        a.textContent = '';
        if (st.suggested && st.colors.length && !st.confirmed) {
          a.append(h('button', { type: 'button', class: 'od-btn sm', text: F.colorsUse, onclick: () => { st.confirmed = true; renderColorsActions(); } }));
        } else if (st.confirmed && st.colors.length) {
          a.append(h('span', { class: 'od-hint', text: F.colorsUsed }));
        }
        if (st.colors.length && st.colors.length < 4) {
          a.append(h('button', { type: 'button', class: 'od-link', text: F.colorsAdd, onclick: () => { st.colors.push(null); renderColors(); } }));
        } else if (!st.colors.length) {
          a.append(h('button', { type: 'button', class: 'od-link', text: F.colorsAdd, onclick: () => { st.colors = [null, null]; renderColors(); } }));
        }
      }
      async function suggest(file) {
        let blob = file;
        if (!blob && ctx.logo && ctx.logo.svg) blob = svgBlob(ctx.logo.svg);
        if (!blob || !RASTER_SVG.includes(ext(blob.name ? blob : { name: 'x.svg' }))) { renderColors(); return; }
        const cols = await extractColors(blob);
        if (st.colors.length) return;
        if (cols.length) { st.colors = cols; st.suggested = true; st.confirmed = false; }
        renderColors();
      }
      if (!kit) {
        renderLogo(); renderColors();
        if (st.logoOnFile && !st.logo) suggest(null);
      }

      // --- likes section ---
      function renderLikes() {
        likeBox.textContent = '';
        likeBox.append(h('h4', { text: F.likeHeading }));
        const input = h('input', { type: 'file', multiple: true, accept: '.png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf', 'aria-label': F.likeChoose });
        const lerr = h('div', { class: 'od-err', role: 'alert', hidden: true });
        input.addEventListener('change', () => {
          lerr.hidden = true;
          const picked = [...input.files]; input.value = '';
          for (const f of picked) {
            if (!LIKE_EXT.includes(ext(f))) { lerr.textContent = fill(E.likeType, V); lerr.hidden = false; continue; }
            if (f.size > LIMITS.like) { lerr.textContent = fill(E.likeSize, { support: COPY.support, file: f.name }); lerr.hidden = false; continue; }
            if (st.likes.length >= 2) { lerr.textContent = E.likeCount; lerr.hidden = false; break; }
            st.likes.push(f);
          }
          const msg = lerr.hidden ? null : lerr.textContent;
          renderLikes();
          if (msg) { const n = likeBox.querySelector('.od-err'); n.textContent = msg; n.hidden = false; }
        });
        const pick = h('label', { class: 'od-btn line sm' }, F.likeChoose, input);
        if (st.likes.length >= 2) pick.hidden = true;
        likeBox.append(h('div', { class: 'od-file' }, pick), h('p', { class: 'od-hint', text: F.likeHint }));
        st.likes.forEach((f, i) => likeBox.append(h('div', { class: 'od-prev', style: 'margin-top:6px' },
          h('span', { class: 'od-fname', text: f.name }),
          h('button', { type: 'button', class: 'od-link', text: F.logoRemove, onclick: () => { st.likes.splice(i, 1); renderLikes(); } }))));
        likeBox.append(lerr);
      }
      renderLikes();

      // --- submit ---
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        err.hidden = true;
        const name = needPerson ? nameI.value.trim() : person.name;
        const email = needPerson ? emailI.value.trim() : person.email;
        const brokerage = needPerson ? brokI.value.trim() : (person.brokerage || (org && org.name) || '');
        const preferred = needPerson ? (prefI.value.trim() || firstWord(name)) : (person.preferred || firstWord(name));
        if (!name) return showErr(E.needName);
        if (!email) return showErr(E.needEmail);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr(E.badEmail);
        if (needPerson && !brokerage) return showErr(E.needBrokerage);
        if (notes.value.length > LIMITS.notes) return showErr(E.notes);

        let logoFile = st.logo;
        if (!kit && !logoFile && st.logoOnFile && ctx.logo) {
          if (ctx.logo.svg) logoFile = new File([svgBlob(ctx.logo.svg)], 'logo-on-file.svg', { type: 'image/svg+xml' });
          else if (ctx.logo.url) { try { const b = await (await fetch(ctx.logo.url)).blob(); logoFile = new File([b], 'logo-on-file.' + (b.type.split('/')[1] || 'png').replace('svg+xml', 'svg'), { type: b.type }); } catch (e) { /* the server already has it */ } }
        }
        const total = (logoFile ? logoFile.size : 0) + st.likes.reduce((s, f) => s + f.size, 0);
        if (total > LIMITS.total) return showErr(E.totalSize);

        const colors = kit ? (org.colors || []).filter(Boolean) : st.colors.filter(Boolean);
        const fd = new FormData();
        fd.append('kind', kind);
        fd.append('name', name); fd.append('preferred', preferred); fd.append('email', email); fd.append('brokerage', brokerage);
        if (ctx.portal) fd.append('portal', ctx.portal);
        fd.append('colors', JSON.stringify(colors));
        fd.append('colorsConfirmed', kit || (st.confirmed && colors.length) ? '1' : '0');
        fd.append('brandKit', kit ? '1' : '0');
        fd.append('pieces', JSON.stringify([...st.pieces]));
        fd.append('notes', notes.value.trim());
        fd.append('website', hp.value);
        if (logoFile) fd.append('logo', logoFile, logoFile.name);
        st.likes.forEach((f, i) => fd.append('like' + (i + 1), f, f.name));

        const label = submit.textContent;
        submit.disabled = true; submit.textContent = F.sending;
        try {
          const r = await send(fd);
          if (r && r.ok) return renderSuccess(preferred, email, r.dueLabel);
          showErr(errorText(r && r.error));
        } catch (e) { showErr(errorText()); }
        submit.disabled = false; submit.textContent = label;
      });
    }

    function renderSuccess(preferred, email, dueLabel) {
      const F = COPY.form;
      formWrap.textContent = '';
      const box = h('div', { class: 'od-ok', role: 'status', tabindex: '-1' },
        h('h3', { text: fill(F.thanks, { preferred }) }));
      if (dueLabel) box.append(h('p', { text: fill(F.due, { due: dueLabel }) }));
      box.append(h('p', { text: fill(F.sentTo, { email }) }));
      formWrap.append(box);
      box.focus({ preventScroll: true });
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    return { destroy: () => { el.textContent = ''; } };
  }

  /* ctx: { mode:'public'|'agent'|'broker'|'portal', org:{name,kind,logoSvg,colors}, person:{name,preferred,email,brokerage},
            logo:{url|svg}, accessToken, portal (portal code), endpoint, apikey, mock } */
  window.OwnDesign = { mount: mount, COPY: COPY };
})();
