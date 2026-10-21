/* Open House flyer picker and updater (10/19/2026). Published as /designs/shared/openhouse.js.

   Every design set has its own Open House flyer, the recommended default. The agent can pick the Open House flyer of
   any other approved design instead, at the proof or on the update page; the rest of the package stays in its design.
   Everything here draws in the browser from the real templates and the package's own data: no AI, no server.

     await OpenHouse.init({base: '/designs/', test: false})   // reads openhouse.json (approved flyers only, unless test)
     OpenHouse.options(pkg)            // flyers this package may use, recommended first
     OpenHouse.current(pkg)            // the one it uses now (the agent's pick, else the recommended one)
     OpenHouse.proofCard(el, pkg, hooks)        // the flyer on the proof: badge, preview, "See other Open House designs"
     OpenHouse.openSheet(pkg, hooks)            // the selection sheet
     OpenHouse.mountUpdater(el, pkg, hooks)     // the Update open house flyer page

   pkg:   {id, design, team, data: {brand, agent, listing, photos, companion, plan, openHouse}, openHouseFlyer: {design, piece}}
   hooks: save(pkg)  the choice and event are stored with the package (the app's database)
          log(row)   {event: 'switch'|'reset'|'update'|'download', from, to, where}, for the switch counts
          download(pkg, flyer)  both files (print-at-home and email) from the renderer; printer(pkg, flyer) the upload panel
   Skin: the host page sets --oh-accent, --oh-ink, --oh-paper, --oh-line, --oh-font (a team page passes its team colors).
   Wording on buttons and headings is a draft; the owner's call. */
(function(){
  const LIMITS = {refreshments: 50, note: 70};   // same as pipeline/openhouse.py
  const KINDS = {public: 'Public', broker: 'Broker', realtor: 'REALTOR®'};
  let CFG = {base: '/designs/', test: false}, LIST = [], SPEC = {};
  const tplCache = {}, fontCache = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const key = e => e.design + '/' + e.piece;
  const clone = o => JSON.parse(JSON.stringify(o));

  async function init(cfg){
    CFG = Object.assign(CFG, cfg || {});
    SPEC = await fetch(CFG.base + 'openhouse.json').then(r => r.json());
    LIST = SPEC.approved.map(e => Object.assign({}, e, {test: false}))
      .concat(CFG.test ? SPEC.candidates.map(e => Object.assign({}, e, {test: true})) : []);
    injectStyle();
  }

  // a complete floor plan: every level of the home (Room Proportions' rule)
  function completePlan(d){
    const p = d.plan || {}, lv = (p.levels || []).filter(l => !l.inset);
    return lv.length > 0 && lv.length >= ((d.listing || {}).stories || 1) && !p.partial;
  }
  function options(pkg){
    const d = pkg.data || {};
    return LIST.filter(e => !e.needsFloorPlan || completePlan(d))
      .map(e => Object.assign({}, e, {recommended: e.own && e.design === pkg.design}))
      .sort((a, b) => (b.recommended - a.recommended) || (a.test - b.test) || ((a.design !== pkg.design) - (b.design !== pkg.design)) || a.name.localeCompare(b.name));
  }
  function current(pkg){
    const opts = options(pkg), pick = pkg.openHouseFlyer;
    return (pick && opts.find(e => e.design === pick.design && e.piece === pick.piece)) || opts.find(e => e.recommended) || opts[0] || null;
  }

  // fonts carry into another design's flyer only if that design approves them
  async function fontsFor(pkg, e){
    const want = Object.fromEntries(Object.entries(((pkg.data || {}).brand || {}).fonts || {}).filter(([, v]) => v));
    if(!Object.keys(want).length) return {fonts: null, note: ''};
    let ok = {};
    if(e.fonts){
      fontCache[e.design] = fontCache[e.design] || fetch(`${CFG.base}${e.design}/fonts.json`).then(r => r.json());
      const spec = await fontCache[e.design];
      ok = Object.fromEntries(Object.entries(want).filter(([role, id]) => ((spec.originals[role] || {}).approved || []).includes(id)));
    }
    const all = Object.keys(ok).length === Object.keys(want).length;
    return {fonts: Object.keys(ok).length ? ok : null,
            note: all ? '' : "This design uses its own fonts, so your font choice doesn't carry over to this flyer. The rest of your package keeps your fonts."};
  }

  async function dataFor(pkg, e){
    const d = clone(pkg.data || {}), f = await fontsFor(pkg, e);
    d.brand = d.brand || {}; delete d.brand.fonts;
    if(f.fonts) d.brand.fonts = f.fonts;
    d.mode = 'email';
    d.piece = {id: e.piece, file: e.file, variant: 'openhouse', trim: e.trim, print: e.print, margin: e.margin};
    return {data: d, fontNote: f.note};
  }

  // ---------- drawing: one iframe per flyer, the real template, scaled to its box ----------
  const SLOT = '<script id="brochure-data" type="application/json">{}</' + 'script>';
  function tpl(e){
    const k = e.design + '/' + e.file;
    return tplCache[k] = tplCache[k] || fetch(CFG.base + k).then(r => r.text());
  }
  function srcdoc(html, e, data){
    const base = `${CFG.base}${e.design}/`;
    return html.replace('<head>', `<head><base href="${base}">`)
      .replace(/(href|src)="(?!https?:|\/|data:|blob:|#)([^"]+\.(?:css|js))"/g, `$1="${base}$2"`)
      .replace(SLOT, SLOT.replace('{}', JSON.stringify(data).replace(/<\//g, '<\\/')))
      .replace('</head>', `<script src="${CFG.base}shared/ohstandard.js"></` + `script><style>html,body{background:transparent!important;margin:0!important;overflow:hidden}.page{margin:0!important;box-shadow:none!important}</style></head>`);
  }
  // problems that would stop this flyer for this listing (photo resolution is fixed by the renderer's enlargement)
  const BLOCKING = c => !/photo-under-300ppi|roof/.test(c.kind);

  // draw(box, pkg, e) -> {ready: Promise<{issues}>}; calling it again on the same box redraws with new data
  function draw(box, pkg, e){
    let fr = box.querySelector('iframe');
    if(!fr){
      fr = document.createElement('iframe'); fr.setAttribute('scrolling', 'no'); fr.tabIndex = -1; fr.setAttribute('aria-hidden', 'true');
      box.appendChild(fr);
      new ResizeObserver(() => fit(box)).observe(box);
    }
    fr.title = e.name;
    const token = (box._t = (box._t || 0) + 1);
    const ready = Promise.all([tpl(e), dataFor(pkg, e)]).then(([html, {data, fontNote}]) => new Promise(res => {
      if(token !== box._t) return res(null);
      fr.onload = () => {
        const w = fr.contentWindow, doc = fr.contentDocument;
        // check only once the fonts and every photo and logo have loaded (slow connections draw images late)
        const imgs = () => Promise.all([...doc.images].map(i => i.complete ? 0 : new Promise(r => { i.addEventListener('load', r, {once: true}); i.addEventListener('error', r, {once: true}); })));
        Promise.resolve(w.brochureReady).then(() => doc.fonts && doc.fonts.ready).then(imgs).then(() => new Promise(r => setTimeout(r, 60))).then(() => {
          fit(box);
          let issues = [];
          try { issues = (w.brochureCheck ? w.brochureCheck() : []).concat(w.OHStandard ? w.OHStandard.check(data) : []).filter(BLOCKING); } catch(err) { issues = [{kind: 'error', detail: String(err)}]; }
          box.classList.toggle('oh-bad', issues.length > 0);
          box.dataset.issues = issues.map(i => i.slot + ':' + i.kind).join(' ');
          res({issues, fontNote});
        });
      };
      fr.srcdoc = srcdoc(html, e, data);
    }));
    return {ready};
  }
  function fit(box){
    const fr = box.querySelector('iframe'), doc = fr && fr.contentDocument, pg = doc && doc.querySelector('.page');
    if(!pg || !pg.offsetWidth) return;
    const k = box.clientWidth / pg.offsetWidth;
    fr.style.width = pg.offsetWidth + 'px'; fr.style.height = pg.offsetHeight + 'px'; fr.style.transform = `scale(${k})`;
    box.style.height = (pg.offsetHeight * k) + 'px';
  }

  // ---------- choosing ----------
  function choose(pkg, e, where, hooks){
    const before = current(pkg);
    if(e.recommended) delete pkg.openHouseFlyer;
    else pkg.openHouseFlyer = {design: e.design, piece: e.piece};
    if(!before || key(before) !== key(e)){
      hooks.log && hooks.log({event: e.recommended ? 'reset' : 'switch', where, package: pkg.id, set_design: pkg.design, from: before && key(before), to: key(e)});
      hooks.save && hooks.save(pkg);
    }
  }

  // ---------- the proof: the Open House flyer card ----------
  function proofCard(el, pkg, hooks){
    hooks = hooks || {};
    const cur = current(pkg);
    if(!cur){ el.innerHTML = '<p class="oh-note">No Open House design is ready for this listing yet.</p>'; return; }
    const rec = cur.recommended, more = options(pkg).length > 1;
    el.innerHTML = `<div class="oh-card">
        <p class="oh-badge${rec ? '' : ' alt'}">${rec ? 'Recommended with your design' : `You picked the ${esc(cur.name)} flyer`}${cur.test ? ' <span class="oh-test">test</span>' : ''}</p>
        <div class="oh-box oh-proofbox"></div>
        <p class="oh-fontnote" hidden></p>
        <p class="oh-links">${more ? '<button type="button" class="oh-link" data-a="sheet">See other Open House designs</button>' : ''}
          ${rec ? '' : '<button type="button" class="oh-link" data-a="reset">Go back to the recommended flyer</button>'}</p></div>`;
    draw(el.querySelector('.oh-box'), pkg, cur).ready.then(r => { const n = el.querySelector('.oh-fontnote'); if(r && r.fontNote){ n.textContent = r.fontNote; n.hidden = false; } });
    el.querySelector('.oh-links').onclick = ev => {
      const a = ev.target.dataset.a;
      if(a === 'sheet') openSheet(pkg, Object.assign({}, hooks, {onChoose: () => proofCard(el, pkg, hooks)}));
      if(a === 'reset'){ choose(pkg, options(pkg).find(x => x.recommended), 'proof', hooks); proofCard(el, pkg, hooks); }
    };
  }

  // ---------- the selection sheet ----------
  function openSheet(pkg, hooks){
    hooks = hooks || {};
    const cur = current(pkg), dlg = document.createElement('dialog');
    dlg.className = 'oh-sheet';
    dlg.innerHTML = `<div class="oh-sheet-head"><h2>Open House designs</h2><button type="button" class="oh-x" aria-label="Close">×</button></div>
      <p class="oh-sub">Each one is drawn with your photos, address and contact card. Pick one and it goes with this listing. The rest of your package stays the same.</p>
      <div class="oh-grid">${options(pkg).map(e => `<button type="button" class="oh-opt${cur && key(cur) === key(e) ? ' on' : ''}" data-k="${esc(key(e))}">
          <div class="oh-box"></div><span class="oh-name">${esc(e.name)}${e.test ? ' <span class="oh-test">test</span>' : ''}</span>
          ${e.recommended ? '<span class="oh-rec">Recommended with your design</span>' : ''}${cur && key(cur) === key(e) ? '<span class="oh-cur">Your flyer now</span>' : ''}
          <span class="oh-why" hidden></span></button>`).join('')}</div>`;
    document.body.appendChild(dlg);
    const opts = Object.fromEntries(options(pkg).map(e => [key(e), e]));
    dlg.querySelectorAll('.oh-opt').forEach(b => draw(b.querySelector('.oh-box'), pkg, opts[b.dataset.k]).ready.then(r => {
      if(r && r.issues.length){ b.disabled = true; const w = b.querySelector('.oh-why'); w.textContent = "This design doesn't fit this listing's details."; w.hidden = false; }
    }));
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector('.oh-x').onclick = close;
    dlg.addEventListener('cancel', close);
    dlg.querySelector('.oh-grid').onclick = ev => {
      const b = ev.target.closest('.oh-opt'); if(!b || b.disabled) return;
      choose(pkg, opts[b.dataset.k], 'proof', hooks); close(); hooks.onChoose && hooks.onChoose(current(pkg));
    };
    dlg.showModal();
  }

  // ---------- the Update open house flyer page ----------
  function mountUpdater(el, pkg, hooks){
    hooks = hooks || {};
    const A = (pkg.data || {}).agent || {}, O = Object.assign({kind: 'public'}, (pkg.data || {}).openHouse || {});
    if(O.kind === 'realtor' && !A.nar) O.kind = 'broker';
    let shown = current(pkg);   // the main preview; saved as the package's flyer on download
    const kinds = Object.keys(KINDS).filter(k => k !== 'realtor' || A.nar);
    el.innerHTML = `<div class="oh-upd">
      <form class="oh-form" novalidate>
        <fieldset><legend>What kind of open house?</legend>
          <div class="oh-kinds">${kinds.map(k => `<label><input type="radio" name="kind" value="${k}"${O.kind === k ? ' checked' : ''}> ${KINDS[k]}</label>`).join('')}</div></fieldset>
        <div class="oh-row"><label>Date<input type="date" name="date" value="${esc(O.date || '')}" required></label></div>
        <div class="oh-row two"><label>Starts<input type="time" name="start" value="${esc(O.start || '')}" step="900"></label>
          <label>Ends<input type="time" name="end" value="${esc(O.end || '')}" step="900"></label></div>
        <div class="oh-extra">
          <label>Refreshments <span class="oh-opt-l">optional</span><input type="text" name="refreshments" maxlength="${LIMITS.refreshments}" value="${esc(O.refreshments || '')}" placeholder="Lunch and iced tea"></label>
          <label>Special notes <span class="oh-opt-l">optional</span><input type="text" name="note" maxlength="${LIMITS.note}" value="${esc(O.note || '')}" placeholder="RSVP, door prize, co-op terms"></label>
          <p class="oh-hint">Left blank, a line simply doesn't appear on the flyer.</p></div>
        <div class="oh-actions"><button type="submit" class="oh-btn">Download flyer</button>
          ${hooks.printer ? '<button type="button" class="oh-btn line" data-a="printer">Send to my printer</button>' : ''}</div>
        <p class="oh-status" role="status" aria-live="polite"></p>
      </form>
      <div class="oh-main"><p class="oh-badge"></p><div class="oh-box oh-big"></div><p class="oh-fontnote" hidden></p></div>
      <section class="oh-alts" hidden><h2>Or pick an alternate design here</h2><div class="oh-grid small"></div></section></div>`;
    const form = el.querySelector('form'), main = el.querySelector('.oh-big'), status = el.querySelector('.oh-status');

    const read = () => {
      const f = form.elements, kind = f.kind.value || 'public', ev = {kind, date: f.date.value};
      if(f.start.value) ev.start = f.start.value;
      if(f.end.value) ev.end = f.end.value;
      if(kind !== 'public'){
        const r = f.refreshments.value.replace(/\s+/g, ' ').trim(), n = f.note.value.replace(/\s+/g, ' ').trim();
        if(r) ev.refreshments = r.slice(0, LIMITS.refreshments);
        if(n) ev.note = n.slice(0, LIMITS.note);
      }
      return ev;
    };
    const live = () => Object.assign({}, pkg, {data: Object.assign({}, pkg.data, {openHouse: read()})});
    let timer = 0;
    function redraw(){
      const p = live();
      el.querySelector('.oh-extra').hidden = form.elements.kind.value === 'public';
      const badge = el.querySelector('.oh-main .oh-badge');
      badge.innerHTML = shown.recommended ? 'Recommended with your design' : `${esc(shown.name)}${shown.test ? ' <span class="oh-test">test</span>' : ''}`;
      draw(main, p, shown).ready.then(r => {
        if(!r) return;
        const n = el.querySelector('.oh-main .oh-fontnote'); n.textContent = r.fontNote; n.hidden = !r.fontNote;
        status.textContent = r.issues.length ? "Something doesn't fit on this design. Try a shorter line, or pick another design below." : '';
      });
      const alts = options(p).filter(e => key(e) !== key(shown)), grid = el.querySelector('.oh-alts .oh-grid');
      el.querySelector('.oh-alts').hidden = !alts.length;
      if(grid.dataset.k !== alts.map(key).join()){
        grid.dataset.k = alts.map(key).join();
        grid.innerHTML = alts.map(e => `<button type="button" class="oh-opt" data-k="${esc(key(e))}"><div class="oh-box"></div>
          <span class="oh-name">${esc(e.name)}${e.test ? ' <span class="oh-test">test</span>' : ''}</span>${e.recommended ? '<span class="oh-rec">Recommended with your design</span>' : ''}<span class="oh-why" hidden></span></button>`).join('');
      }
      const by = Object.fromEntries(alts.map(e => [key(e), e]));
      grid.querySelectorAll('.oh-opt').forEach(b => draw(b.querySelector('.oh-box'), p, by[b.dataset.k]).ready.then(r => {
        if(!r) return; b.disabled = r.issues.length > 0; const w = b.querySelector('.oh-why'); w.textContent = "Doesn't fit these details"; w.hidden = !b.disabled; }));
    }
    form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(redraw, 180); });
    form.addEventListener('change', () => { clearTimeout(timer); redraw(); });
    el.querySelector('.oh-alts').onclick = ev => {
      const b = ev.target.closest('.oh-opt'); if(!b || b.disabled) return;
      shown = options(live()).find(e => key(e) === b.dataset.k);
      redraw(); el.querySelector('.oh-main').scrollIntoView({behavior: 'smooth', block: 'start'});
    };
    const commit = async (what) => {
      const f = form.elements;
      if(!f.date.value){ status.textContent = 'Pick the date first.'; f.date.focus(); return false; }
      if(!f.start.value || !f.end.value){ status.textContent = 'Add the start and end times.'; (f.start.value ? f.end : f.start).focus(); return false; }
      if(main.classList.contains('oh-bad')){ status.textContent = "Something doesn't fit on this design. Shorten a line or pick another design."; return false; }
      pkg.data = Object.assign({}, pkg.data, {openHouse: read()});
      choose(pkg, shown, 'update', hooks);   // the flyer on screen becomes the package's flyer and carries forward
      hooks.log && hooks.log({event: what, where: 'update', package: pkg.id, set_design: pkg.design, to: key(shown), kind: pkg.data.openHouse.kind});
      hooks.save && hooks.save(pkg);
      return true;
    };
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      if(!await commit('download')) return;
      status.textContent = 'Making your two files: one to print at home, one to email…';
      try { await (hooks.download ? hooks.download(pkg, shown) : Promise.resolve()); status.textContent = 'Your flyer is saved. Both files are downloading.'; }
      catch(err) { status.textContent = "We couldn't make the files just now. Your changes are saved; try Download again."; }
    });
    const pb = el.querySelector('[data-a="printer"]');
    if(pb) pb.onclick = async () => { if(await commit('printer')) hooks.printer(pkg, shown); };
    redraw();
  }

  function injectStyle(){
    if(document.getElementById('oh-style')) return;
    const s = document.createElement('style'); s.id = 'oh-style';
    s.textContent = `
.oh-card,.oh-upd,.oh-sheet{--a:var(--oh-accent,#1F4D3F);--i:var(--oh-ink,#1E2226);--p:var(--oh-paper,#FBFBF9);--l:var(--oh-line,#D5D6D1);font-family:var(--oh-font,inherit);color:var(--i)}
.oh-box{position:relative;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18)}
.oh-box iframe{position:absolute;left:0;top:0;border:0;transform-origin:0 0;pointer-events:none}
.oh-badge{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--a);margin:0 0 10px}
.oh-badge.alt{color:var(--i)}
.oh-test{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:#f3e3b8;color:#5b4310;border-radius:3px;padding:1px 5px;vertical-align:middle}
.oh-links{display:flex;flex-wrap:wrap;gap:6px 18px;margin:12px 0 0}
.oh-link{background:none;border:0;padding:0;font:inherit;font-weight:700;color:var(--a);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.oh-fontnote,.oh-hint{font-size:13px;color:#5a5f63;margin:8px 0 0;line-height:1.45}
.oh-sheet{width:min(1080px,calc(100vw - 32px));max-height:calc(100vh - 48px);border:0;border-radius:10px;padding:24px;background:var(--p)}
.oh-sheet::backdrop{background:rgba(20,22,24,.55)}
.oh-sheet-head{display:flex;justify-content:space-between;align-items:center}
.oh-sheet h2,.oh-alts h2{font-size:22px;margin:0}
.oh-x{border:0;background:none;font-size:30px;line-height:1;cursor:pointer;color:var(--i);padding:0 4px}
.oh-sub{margin:6px 0 18px;color:#5a5f63;font-size:15px;line-height:1.45}
.oh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:22px}
.oh-grid.small{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:18px}
.oh-opt{display:flex;flex-direction:column;gap:6px;text-align:left;background:none;border:2px solid transparent;border-radius:8px;padding:8px;font:inherit;color:inherit;cursor:pointer}
.oh-opt:hover:not(:disabled),.oh-opt:focus-visible{border-color:var(--l)}
.oh-opt.on{border-color:var(--a)}
.oh-opt:disabled{cursor:not-allowed;opacity:.55}
.oh-name{font-weight:700;font-size:15px}
.oh-rec,.oh-cur{font-size:12.5px;font-weight:700;color:var(--a)}
.oh-cur{color:#5a5f63}
.oh-why{font-size:12.5px;color:#8a3b2a}
.oh-upd{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:28px 36px;align-items:start}
.oh-alts{grid-column:1 / -1;border-top:1px solid var(--l);padding-top:22px}
.oh-alts h2{margin-bottom:14px}
.oh-form fieldset{border:0;padding:0;margin:0 0 16px}
.oh-form legend{font-weight:700;margin-bottom:8px}
.oh-kinds{display:flex;flex-wrap:wrap;gap:8px}
.oh-kinds label{display:flex;align-items:center;gap:6px;border:1px solid var(--l);border-radius:6px;padding:9px 12px;cursor:pointer;background:#fff}
.oh-kinds label:has(input:checked){border-color:var(--a);box-shadow:inset 0 0 0 1px var(--a)}
.oh-form label{display:block;font-weight:700;font-size:15px;margin-bottom:14px}
.oh-row.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.oh-form input[type=date],.oh-form input[type=time],.oh-form input[type=text]{display:block;width:100%;box-sizing:border-box;margin-top:6px;font:inherit;font-weight:400;font-size:16px;padding:11px 12px;border:1px solid var(--l);border-radius:6px;background:#fff;color:var(--i)}
.oh-opt-l{font-weight:400;color:#5a5f63;font-size:13px}
.oh-extra[hidden]{display:none}
.oh-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.oh-btn{font:inherit;font-weight:700;font-size:16px;padding:12px 20px;border-radius:6px;border:0;background:var(--a);color:#fff;cursor:pointer}
.oh-btn.line{background:transparent;color:var(--i);border:1px solid var(--i)}
.oh-status{min-height:1.4em;font-size:14px;margin:12px 0 0}
.oh-main{max-width:620px}
@media (max-width:760px){.oh-upd{grid-template-columns:1fr}.oh-sheet{padding:16px}.oh-grid,.oh-grid.small{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}`;
    document.head.appendChild(s);
  }

  window.OpenHouse = {init, options, current, proofCard, openSheet, mountUpdater, draw, LIMITS};
})();
