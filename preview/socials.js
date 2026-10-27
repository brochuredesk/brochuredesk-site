/* Socials section for the unlisted test pages (/preview/just-listed/, /preview/just-sold/). Test pieces only.
   Draws the announce library's social posts and stories (designs/announce, every piece marked test) in a frame with the
   sample listing, plus whatever is typed in the page's own fields (name, phone, address, ...). Switches: headshot on/off,
   and on Just Sold the specialty "Show it / Leave it out" and JS-S16's seller / buyer side. Click any text to change its
   wording, font, color or size; the checks run on the change. PNG download at 1080 x 1350 (posts) or 1080 x 1920 (stories). */
(function(){
  const box = document.getElementById('socials'); if(!box) return;
  const SET = box.dataset.set, ROOT = (document.querySelector('meta[name=bd-root]') || {content: '/'}).content;
  const LIB = ROOT + 'designs/announce/', HEADSHOT = ROOT + 'designs/js-library/sample-headshot.jpg';
  const SLOT = '<script id="brochure-data" type="application/json">{}</' + 'script>';
  const $ = s => box.querySelector(s);
  const WORDS = {
    'text-overlap': c => `"${c.text}" runs into "${c.other}".`, 'too-close-to-edge': c => `"${c.slot}" is within 30 px of the edge.`,
    'outside-grid-crop': () => 'The name or address runs outside the middle of the post (it would be cropped in the grid).',
    'story-safe-zone': c => `${c.detail || 'Something sits in the top or bottom 250 px'} (covered by Instagram's buttons).`,
    'house-cut-off': () => 'Part of the house is cut off in a photo.', 'house-covered': () => 'Something covers the house in a photo.',
    'photos-not-aligned': () => 'Photos in a row don’t line up top and bottom.', 'logo-under-70px': () => 'The logo is under 70 px tall.',
    'logo-not-centered': () => 'The logo isn’t centered with the contact lines.', 'banned-phrase': c => `Wording we never use: "${c.text}".`,
    'sold-home-features': c => `Just Sold pieces don’t list the home’s features ("${c.text}").`, 'low-contrast': c => `"${c.slot}" is hard to read on its background.`,
    'overflow': c => `A line runs past its space: "${c.text || c.slot}".`, 'off-page': c => `"${c.slot}" runs off the page.`,
    'empty-photo-slot': () => 'A photo spot is empty.', 'photo-repeated': () => 'The same photo is used twice.', 'photo-missing': () => 'A photo didn’t load.',
    'text-runs-into-box': c => `"${c.text}" runs into a box, photo or the logo.`, 'missing-copy': c => `Missing wording: ${c.slot}.`, 'logo-version-missing': c => c.detail || 'A logo version is missing.', 'logo-missing': () => 'The logo is missing.'
  };
  box.innerHTML = `
    <h2 class="s-h">Socials <span>test</span></h2>
    <p class="note">Every ${SET === 'sold' ? 'Just Sold' : 'Just Listed'} social design, drawn from the details on the left. Click any text to change it. Not shown to customers.</p>
    <div class="grp"><div class="list s-list" data-g="main"></div></div>
    ${SET === 'sold' ? '<div class="grp"><h2>Specialty</h2><div class="list s-list" data-g="specialty"></div></div>' : ''}
    <div class="s-ctl">
      <div><label>Agent photo</label><div class="seg s-hs"><button type="button" data-v="0" aria-pressed="true">No headshot</button><button type="button" data-v="1">Headshot</button></div></div>
      <div class="s-plainbox" style="display:none"><label>Sale detail</label><div class="seg s-plain"><button type="button" data-v="0" aria-pressed="true">Show it</button><button type="button" data-v="1">Leave it out</button></div></div>
      <div class="s-sidebox" style="display:none"><label>Side</label><div class="seg s-side"><button type="button" data-v="seller" aria-pressed="true">Represented the Seller</button><button type="button" data-v="buyer">Represented the Buyer</button></div></div>
    </div>
    <div class="vtitle"><h2 class="s-name"></h2><span class="s-sub"></span></div>
    <div class="s-wrap"><div class="s-sheet"><iframe title="Social preview" scrolling="no" tabindex="-1"></iframe></div>
      <div class="s-side-col"><div class="checks s-checks"></div><div class="act"><button type="button" class="s-png">Download PNG</button></div><p class="note s-msg"></p></div></div>
    <div class="s-editor" role="dialog" aria-label="Edit text"><h4>Edit this text</h4><textarea class="s-text"></textarea>
      <label>Font</label><select class="s-font"></select>
      <div class="row2"><div><label>Color</label><input type="color" class="s-color"></div><div><label>Size <span class="s-sizev">100%</span></label><input type="range" class="s-size" min="80" max="130" step="5" value="100"></div></div>
      <div class="act"><button type="button" class="s-apply">Apply</button><button type="button" class="s-undo">Undo my changes here</button><button type="button" class="s-close">Close</button></div></div>`;
  const st = document.createElement('style');
  st.textContent = `#socials{margin-top:34px;border-top:1px solid var(--line);padding-top:18px;max-width:1000px}
    #socials .s-h{font-size:22px;margin:0 0 4px}#socials .s-h span{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-left:6px}
    #socials .s-list{grid-template-columns:repeat(auto-fill,minmax(64px,1fr))}#socials .s-list button{font-size:12px}
    #socials .s-ctl{display:flex;flex-wrap:wrap;gap:12px 18px;margin:4px 0 14px}#socials .s-ctl>div{min-width:220px}
    #socials .s-wrap{display:grid;grid-template-columns:minmax(0,480px) minmax(0,1fr);gap:20px;align-items:start}
    #socials .s-sheet{position:relative;width:100%;overflow:hidden;border-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.12);background:#ddd}
    #socials iframe{position:absolute;left:0;top:0;border:0;transform-origin:0 0;width:1080px;height:1350px}
    #socials .s-editor{position:fixed;right:16px;top:16px;width:300px;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:14px;display:none;z-index:30;font-size:13px}
    #socials .s-editor h4{margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
    #socials .s-editor textarea{width:100%;min-height:70px;font:14px Figtree,sans-serif;padding:6px}#socials .s-editor select,#socials .s-editor input[type=range]{width:100%}
    @media (max-width:820px){#socials .s-wrap{grid-template-columns:1fr}}`;
  document.head.appendChild(st);

  let pieces = [], sample = null, card = '', cur = null, seq = 0, editing = null;
  const edits = {};
  const on = sel => $(sel).querySelector('[aria-pressed="true"]').dataset.v;
  const plain = () => cur && cur.group === 'specialty' && on('.s-plain') === '1';
  const key = () => cur.design + '|' + (on('.s-hs') === '1' ? 'hs' : 'no') + (plain() ? '|plain' : '');
  const mine = () => edits[key()] || (edits[key()] = {});
  const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
  function data(){
    const d = JSON.parse(JSON.stringify(sample)), a = d.agent, L = d.listing, js = d.companion.justSold = d.companion.justSold || {};
    const set = (o, k, v, num) => { if(v !== '') o[k] = num ? +v : v; };
    set(a, 'name', val('f-name')); set(a, 'mailerName', val('f-mailer')); set(a, 'phone', val('f-phone')); set(a, 'email', val('f-email'));
    if(document.getElementById('f-web')) a.web = val('f-web');
    set(L, 'address', val('f-street')); set(L, 'city', val('f-city')); set(L, 'state', val('f-state'));
    set(L, 'beds', val('f-beds'), 1); set(L, 'baths', val('f-baths'), 1); set(L, 'sqft', val('f-sqft'), 1); set(L, 'yearBuilt', val('f-year'), 1);
    set(js, 'days', val('f-dom'), 1);
    if(val('f-offers')){ js.offers = +val('f-offers'); js.offersOk = true; }
    a.headshot = on('.s-hs') === '1' ? HEADSHOT : null;
    js.specialty = plain() ? 'hide' : 'show';
    js.side = on('.s-side');
    d.textEdits = JSON.parse(JSON.stringify(mine()));
    d.mode = 'email'; d.piece = cur;
    return d;
  }
  function srcdoc(d){
    return card.replace('<head>', `<head><base href="${LIB}">`)
      .replace(SLOT, SLOT.replace('{}', JSON.stringify(d).replace(/<\//g, '<\\/')))
      .replace('</head>', '<style>html,body{margin:0!important;overflow:hidden;background:transparent!important}</style></head>');
  }
  const frame = () => $('iframe');
  function scale(){
    if(!cur) return; const H = cur.px[1], s = $('.s-sheet'), k = s.clientWidth / 1080;
    frame().style.height = H + 'px'; frame().style.transform = `scale(${k})`; s.style.height = (H * k) + 'px';
  }
  window.addEventListener('resize', scale);
  function showChecks(list){
    const c = $('.s-checks'), bad = list.filter(x => WORDS[x.kind]);
    const seen = new Set(), lines = bad.map(x => WORDS[x.kind](x)).filter(t => !seen.has(t) && seen.add(t));
    c.className = 'checks s-checks ' + (lines.length ? 'bad' : 'ok');
    c.innerHTML = lines.length ? '<b>Needs attention:</b><ul>' + lines.map(t => '<li>' + t.replace(/</g, '&lt;') + '</li>').join('') + '</ul>' : 'Every check passes.';
  }
  function render(){
    if(!cur || !sample) return; const my = ++seq;
    $('.s-plainbox').style.display = cur.group === 'specialty' ? '' : 'none';
    $('.s-sidebox').style.display = cur.design === 'JS-S16' ? '' : 'none';
    const fr = frame(); scale();
    fr.onload = () => {
      const w = fr.contentWindow;
      Promise.resolve(w.brochureReady).then(() => w.document.fonts.ready).then(() => new Promise(r => setTimeout(r, 120))).then(() => {
        if(my !== seq) return;
        showChecks(w.brochureCheck ? w.brochureCheck() : []);
        w.document.querySelectorAll('.pg [data-e]').forEach(el => { el.style.cursor = 'text'; });
        w.document.addEventListener('click', e => { const el = e.target.closest('[data-e]'); if(el) openEditor(el.dataset.e); });
        const css = w.document.createElement('style');
        css.textContent = '.pg [data-e]:hover{outline:2px dashed rgba(30,110,220,.85);outline-offset:3px}';
        w.document.head.appendChild(css);
      });
    };
    fr.srcdoc = srcdoc(data());
  }
  function pick(p){
    cur = p;
    box.querySelectorAll('.s-list button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === p.id)));
    $('.s-name').textContent = p.design + ' · ' + p.title;
    $('.s-sub').textContent = (p.size === 'story' ? 'Story 1080 x 1920' : 'Post 1080 x 1350') + (p.group === 'specialty' ? ' · specialty' : '');
    $('.s-msg').textContent = ''; closeEditor(); render();
  }
  // ---- text editor ----
  const hex = c => { const m = (c || '').match(/\d+/g); return m ? '#' + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('') : '#000000'; };
  function openEditor(id){
    const w = frame().contentWindow, info = w.socialSpots && w.socialSpots(); if(!info) return;
    const sp = info.spots.find(s => s.id === id); if(!sp) return;
    const ed = mine()[id] || {}; editing = sp;
    $('.s-text').value = ed.text != null ? ed.text : sp.text;
    $('.s-font').innerHTML = '<option value="">Design’s font (' + sp.font + ')</option>' + info.fonts.map(f => `<option${ed.font === f ? ' selected' : ''}>${f}</option>`).join('');
    $('.s-color').value = ed.color || hex(sp.color); $('.s-size').value = Math.round((ed.size || 1) * 100); $('.s-sizev').textContent = $('.s-size').value + '%';
    $('.s-editor').style.display = 'block';
  }
  function closeEditor(){ $('.s-editor').style.display = 'none'; editing = null; }
  $('.s-size').oninput = () => { $('.s-sizev').textContent = $('.s-size').value + '%'; };
  $('.s-apply').onclick = () => {
    if(!editing) return; const id = editing.id, prev = mine()[id] || {}, ed = {};
    const t = $('.s-text').value; if(t !== editing.text || prev.text != null) ed.text = t;
    if($('.s-font').value) ed.font = $('.s-font').value;
    if($('.s-color').value !== hex(editing.color) || prev.color) ed.color = $('.s-color').value;
    if(+$('.s-size').value !== 100) ed.size = +$('.s-size').value / 100;
    if(Object.keys(ed).length) mine()[id] = ed; else delete mine()[id];
    closeEditor(); render();
  };
  $('.s-undo').onclick = () => { if(editing) delete mine()[editing.id]; closeEditor(); render(); };
  $('.s-close').onclick = closeEditor;
  // ---- switches, page fields ----
  box.querySelectorAll('.seg').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return;
    g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); closeEditor(); render(); }));
  let t; document.querySelectorAll('aside input, aside textarea').forEach(i => i.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 600); }));
  document.querySelectorAll('aside button').forEach(b => b.addEventListener('click', () => { clearTimeout(t); t = setTimeout(render, 600); }));
  // ---- PNG: the page as drawn, at full size, in the browser ----
  $('.s-png').onclick = async () => {
    const w = frame().contentWindow, doc = w.document, msg = $('.s-msg');
    msg.textContent = 'Making the PNG…';
    try{
      if(!w.htmlToImage) await new Promise((res, rej) => { const s = doc.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js'; s.onload = res; s.onerror = rej; doc.head.appendChild(s); });
      const pg = doc.querySelector('.page'), H = cur.px[1];
      const url = await w.htmlToImage.toPng(pg, {width: 1080, height: H, pixelRatio: 1, cacheBust: false});
      const a = document.createElement('a'); a.href = url; a.download = `${cur.id}${on('.s-hs') === '1' ? '-headshot' : ''}${plain() ? '-plain' : ''}.png`; a.click();
      msg.textContent = '';
    }catch(e){ msg.textContent = 'The PNG couldn’t be made in this browser: ' + (e && e.message || e); }
  };
  Promise.all([fetch(LIB + 'pieces.json').then(r => r.json()), fetch(LIB + 'sample-socials.json').then(r => r.json()), fetch(LIB + 'card.html').then(r => r.text())])
    .then(([spec, smp, html]) => {
      sample = smp; card = html;
      pieces = spec.pieces.filter(p => p.kind === 'social' && p.test && p.card === SET);
      for(const p of pieces){
        const b = document.createElement('button'); b.type = 'button'; b.dataset.id = p.id; b.textContent = p.design.replace(/^J[LS]-/, '') + (p.size === 'story' ? ' ▯' : '');
        b.title = `${p.design} · ${p.title}${p.size === 'story' ? ' (story)' : ''}`; b.onclick = () => pick(p);
        $(`.s-list[data-g="${p.group === 'specialty' ? 'specialty' : 'main'}"]`).appendChild(b);
      }
      if(pieces.length) pick(pieces[0]);
    });
})();
