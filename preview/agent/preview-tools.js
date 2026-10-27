// Rough-draft preview helpers (brief preview-and-lookup-10-24, 10/25/2026). No model calls here.
//   PreviewTools.roomKey(text)              a caption, MLS room or photo label -> one room type ('kitchen', 'primary bath', ...)
//   PreviewTools.load() / heading / line    room headings and the "what you'll get" lines (/designs/shared/preview-lines.json)
//   PreviewTools.isPreview(text)            true when a text holds a preview line (exports refuse it)
//   PreviewTools.cleanPlan(blob)            the agent's own floor plan as simple line art, one image per floor
//   PreviewTools.planPages(blobs) / artPages(art)   the plan pages as JPEGs for the redraw at Finalize
//   PreviewTools.picker(root, opts)         the two-box photo picker (upper: in the package, lower: the rest)
(function(){
  const PT = window.PreviewTools = {};

  // ---------- room types ----------
  const ROOMS = [[/floor ?plan/, 'floor plan'], [/primary (bath|en-?suite)|master bath/, 'primary bath'], [/primary (bed|suite)|master (bed|suite)/, 'primary bedroom'],
    [/kitchen/, 'kitchen'], [/breakfast|nook/, 'breakfast area'], [/dining/, 'dining room'], [/living|great room/, 'living room'], [/family room|\bden\b/, 'family room'],
    [/game ?room|media|bonus/, 'game room'], [/study|office/, 'study'], [/bed ?room/, 'bedroom'], [/bath/, 'bathroom'], [/laundry|utility/, 'laundry room'],
    [/entry|foyer/, 'entry'], [/stair/, 'stairs'], [/pool/, 'pool'], [/patio|deck|porch/, 'patio'], [/back ?yard|yard/, 'backyard'], [/garage/, 'garage'],
    [/aerial|drone/, 'aerial'], [/back of the house|rear/, 'back exterior'], [/side (view|angle|exterior)/, 'side exterior'],
    [/front|exterior|curb|street/, 'front exterior'], [/\bview\b/, 'view'], [/community|amenit/, 'community']];
  PT.roomKey = s => { s = String(s || '').toLowerCase(); const m = ROOMS.find(([rx]) => rx.test(s)); return m ? m[1] : ''; };
  // package-ai tag-photos roles -> room types
  PT.ROLE_ROOM = {front: 'front exterior', side: 'side exterior', back: 'back exterior', street: 'front exterior', aerial: 'aerial', living: 'living room',
    family: 'family room', kitchen: 'kitchen', dining: 'dining room', nook: 'breakfast area', primary: 'primary bedroom', bedroom: 'bedroom', bath: 'bathroom',
    office: 'study', entry: 'entry', stairs: 'stairs', laundry: 'laundry room', garage: 'garage', patio: 'patio', pool: 'pool', yard: 'backyard',
    view: 'view', amenity: 'community', floorplan: 'floor plan', other: ''};

  // ---------- headings and preview lines ----------
  let LIB = null;
  let loading = null;
  PT.load = () => loading || (loading = fetch('/designs/shared/preview-lines.json').then(r => r.json()).then(j => (LIB = j)));
  PT.load().catch(() => { loading = null; });
  PT.heading = key => LIB ? (LIB.headings[key] || LIB.headings.room) : key;
  // whole lines from the room's own pool (a different start for each slot, so two sections never read the same), joined
  // until they reach the real copy's length, then trimmed at a word so the line count matches what the final copy fills
  PT.line = (key, len, seed) => {
    const pool = LIB.rooms[key] || LIB.sections[key] || LIB.rooms.room, more = key === 'headline' ? [] : key in LIB.sections ? LIB.sections.feature : LIB.rooms.room;
    const order = pool.map((_, i) => pool[(i + (seed || 0)) % pool.length]).concat(more.filter(s => !pool.includes(s)));
    // whole sentences only: add each one that still fits the slot (about the real copy's length), skipping the ones too long
    const got = [], room = () => len * 1.08 - (got.join(' ').length + (got.length ? 1 : 0));
    for(const s of order){ if(got.join(' ').length >= len * 0.92) break; if(s.length <= room()) got.push(s); }
    let out = got.join(' ');
    if(!out){   // a very short slot: the shortest line, cut at a word
      out = order.slice().sort((x, y) => x.length - y.length)[0].slice(0, Math.max(12, len)).replace(/\s+\S*$/, '').replace(/[,;:]$/, '');
      if(!/[.!?]$/.test(out)) out += '.';
    }
    return out;
  };
  // after the design lays out: each preview line grows a sentence at a time to the lines its slot fills (data-fill), then
  // drops words until it fits its box, so the line count matches what the final copy will fill
  const pools = () => [...Object.entries(LIB.rooms), ...Object.entries(LIB.sections)];
  const keyOf = t => (pools().find(([, a]) => a.some(x => t.includes(x.slice(0, 28)))) || ['room'])[0];
  const more = (t, key) => { const a = (LIB.rooms[key] || LIB.sections[key] || []).concat(LIB.rooms.room, LIB.sections.feature);
    const next = a.find(x => !t.includes(x.slice(0, 28))); return next ? t + ' ' + next : t; };
  PT.fitPreview = doc => {
    if(!LIB || !doc) return;
    const fillers = (LIB.fillers || []).slice().sort((x, y) => y.length - x.length);
    for(const el of doc.querySelectorAll('[data-slot]')){
      if(el.children.length || !el.getClientRects().length || !PT.isPreview(el.textContent)) continue;   // hidden panels wait for their own frame
      const want = +el.dataset.fill || 0, max = +el.dataset.lines || 99, key = keyOf(el.textContent);
      const lines = () => { const r = doc.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].filter(q => q.width > 1).map(q => Math.round(q.top))).size; };
      // the template's own overflow rule: one-line slots by width, wrapping slots by height
      const one = doc.defaultView.getComputedStyle(el).whiteSpace === 'nowrap';
      const over = () => (one ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1) || lines() > max;
      let parts = el.textContent.split(/(?<=[.!?])\s+/);
      const set = a => { el.textContent = a.join(' '); };
      for(let i = 0; want && i < 8 && lines() < want && !over(); i++){ const t = more(parts.join(' '), key); if(t === parts.join(' ')) break; parts = t.split(/(?<=[.!?])\s+/); set(parts); }
      while(over() && parts.length > 1){ parts.pop(); set(parts); }
      for(let round = 0; want && round < 3 && lines() < want; round++){   // top up the last line with the longest closing line that fits
        const f = fillers.find(x => !parts.includes(x) && (set(parts.concat(x)), !over()));
        if(!f){ set(parts); break; }
        parts.push(f);
      }
      set(parts);
      if(over()){   // one long sentence in a small box: cut at a word
        while(over() && el.textContent.length > 12) el.textContent = el.textContent.replace(/\s+\S+$/, '');
        el.textContent = el.textContent.replace(/[\s,;:]+$/, '').replace(/([^.!?])$/, '$1.');
      }
    }
  };
  PT.isPreview = text => {
    if(!LIB || !text) return false;
    const t = String(text), all = [...Object.values(LIB.rooms), ...Object.values(LIB.sections)].flat();
    return all.some(s => t.includes(s.slice(0, 28)));
  };

  // ---------- simple floor plan (code only) ----------
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  PT.pdfjs = () => window.pdfjsLib ? Promise.resolve(window.pdfjsLib) : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); }; s.onerror = rej; document.head.appendChild(s);
  });
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  // a PDF (each page up to 4: one per floor) or an image -> white-backed canvases about 1800 px on the long side
  async function pages(blob){
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if(blob.type === 'application/pdf' || String.fromCharCode(...head) === '%PDF-'){
      const lib = await PT.pdfjs(), doc = await lib.getDocument({data: await blob.arrayBuffer()}).promise, out = [];
      for(let i = 1; i <= Math.min(doc.numPages, 4); i++){
        const pg = await doc.getPage(i), v = pg.getViewport({scale: 1}), vp = pg.getViewport({scale: Math.min(4, 1800 / Math.max(v.width, v.height))});
        const c = canvas(vp.width, vp.height), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        // pdf.js paces drawing on screen refreshes, which a background tab doesn't get: a plain timer stands in meanwhile
        const raf = window.requestAnimationFrame;
        window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0);
        try { await pg.render({canvasContext: g, viewport: vp}).promise; } finally { window.requestAnimationFrame = raf; } out.push(c);
      }
      return out;
    }
    const bmp = await createImageBitmap(blob), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)), c = canvas(bmp.width * k, bmp.height * k), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    return [c];
  }
  // threshold to dark lines (gray fills and the paper drop out), drop small specks, trim the margins; lines become a mask
  // the design tints with its own plan color. Too poor to clean (tiny, or a photo of a paper plan): trimmed as it is.
  function lineArt(c, small){
    const w = c.width, h = c.height, d = c.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, w, h).data, N = w * h;
    const ink = new Uint8Array(N); let n = 0, mid = 0;
    for(let i = 0; i < N; i++){ const L = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; if(L < 115){ ink[i] = 1; n++; } else if(L < 215) mid++; }
    const poor = small || Math.max(w, h) < 500 || n / N > 0.22 || n / N < 0.0015 || mid / N > 0.55;
    if(!poor){   // specks: pieces of ink smaller than about 0.004% of the page
      const seen = new Uint8Array(N), stack = new Int32Array(N), min = Math.max(14, Math.round(N * 0.00004));
      for(let s = 0; s < N; s++){
        if(!ink[s] || seen[s]) continue;
        let top = 0, size = 0; stack[top++] = s; seen[s] = 1; const comp = [];
        while(top){ const p = stack[--top]; comp.push(p); size++; const x = p % w;
          for(const q of [p - 1, p + 1, p - w, p + w]){ if(q < 0 || q >= N || (q === p - 1 && x === 0) || (q === p + 1 && x === w - 1) || !ink[q] || seen[q]) continue; seen[q] = 1; stack[top++] = q; } }
        if(size < min) for(const p of comp) ink[p] = 0;
      }
    }
    // the bounding box of what's left (for a poor source: of anything not white)
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const i = y * w + x, on = poor ? (.299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]) < 235 : ink[i];
      if(on){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
    }
    if(x1 < 0) return null;
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02); x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(1, 1400 / Math.max(cw, ch)), out = canvas(cw * k, ch * k), g = out.getContext('2d');
    if(poor){ g.drawImage(c, x0, y0, cw, ch, 0, 0, out.width, out.height); return {src: out.toDataURL('image/jpeg', .85), tinted: false, w: out.width, h: out.height}; }
    const full = canvas(cw, ch), fg = full.getContext('2d'), id = fg.createImageData(cw, ch);
    for(let y = 0; y < ch; y++) for(let x = 0; x < cw; x++){ if(ink[(y + y0) * w + x + x0]){ const o = (y * cw + x) * 4; id.data[o + 3] = 255; } }
    fg.putImageData(id, 0, 0); g.imageSmoothingQuality = 'high'; g.drawImage(full, 0, 0, out.width, out.height);
    return {src: out.toDataURL('image/png'), tinted: true, w: out.width, h: out.height};
  }
  const FLOORS = ['First floor', 'Second floor', 'Third floor', 'Fourth floor'];
  // blobs: one file (a PDF of every floor, or one image) or one image per floor -> [{src, tinted, label}]
  // pdf.js's worker sometimes never starts on its first use in a page: a 20 s limit, then one fresh try
  const withRetry = async b => {
    const once = () => Promise.race([pages(b), new Promise((_, rej) => setTimeout(() => rej(new Error('plan-timeout')), 20000))]);
    try { return await once(); } catch(e){ if(e.message !== 'plan-timeout') throw e; return once(); }
  };
  PT.cleanPlan = async (blobs, labels) => {
    const out = [];
    for(const b of [].concat(blobs)) for(const c of await withRetry(b)){ if(out.length >= 4) break; const a = lineArt(c); if(a) out.push(a); }
    return out.map((a, i) => Object.assign(a, {label: (labels && labels[i]) || (out.length > 1 ? FLOORS[i] : '')}));
  };
  // the plan pages as the redraw at Finalize reads them: the page as printed (room names and sizes stay sharp, no line
  // cleanup), JPEG at most 1568 px on the long side (what the model reads at full detail). -> [{data (base64), w, h}]
  const forRead = c => {
    const k = Math.min(1, 1568 / Math.max(c.width, c.height)), o = canvas(c.width * k, c.height * k), g = o.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, o.width, o.height); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, o.width, o.height);
    return {data: o.toDataURL('image/jpeg', .88).split(',')[1], w: o.width, h: o.height};
  };
  PT.planPages = async blobs => {
    const out = [];
    for(const b of [].concat(blobs)) for(const c of await withRetry(b)){ if(out.length >= 4) break; out.push(forRead(c)); }
    return out;
  };
  // no file to read again (an upload from an earlier visit): the cleaned line art, on white
  PT.artPages = art => Promise.all([].concat(art).slice(0, 4).map(a => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { const c = canvas(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); res(forRead(c)); };
    im.onerror = rej; im.src = a.src;
  })));

  // ---------- photo picker ----------
  // opts: photos [{key, src, room}], upper [keys in the package], cap, full (the message when the upper box is full),
  // labels {upper, lower}, onChange(upper, lower, move). Drag between the boxes (mouse or touch), or tap a photo to move it.
  // No swapping: a photo dragged into a full upper box bounces back with the message. Nothing is ever removed for good.
  PT.picker = (root, o) => {
    let up = o.upper.slice(), down = o.photos.map(p => p.key).filter(k => !up.includes(k)), drag = null;
    const by = Object.fromEntries(o.photos.map(p => [p.key, p])), esc = s => String(s || '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
    root.innerHTML = `<div class="pk-box" data-box="up"><h3>${esc(o.labels.upper)} <span class="pk-n"></span></h3><div class="pk-grid"></div></div>
      <p class="pk-msg" role="status" aria-live="polite"></p>
      <div class="pk-box" data-box="down"><h3>${esc(o.labels.lower)}</h3><div class="pk-grid"></div></div>`;
    const msg = root.querySelector('.pk-msg');
    const tile = k => `<button type="button" class="pk-ph" draggable="true" data-k="${esc(k)}" aria-label="${esc((by[k].room || 'Listing photo') + ', tap to move')}"><img src="${esc(by[k].src)}" alt=""><span>${esc(by[k].room || '')}</span></button>`;
    function draw(){
      root.querySelector('[data-box=up] .pk-grid').innerHTML = up.map(tile).join('') || '<p class="fine">Drag photos up here.</p>';
      root.querySelector('[data-box=down] .pk-grid').innerHTML = down.map(tile).join('') || '<p class="fine">Every photo is in your package.</p>';
      root.querySelector('.pk-n').textContent = `${up.length} of ${o.cap}`;
      root.querySelectorAll('.pk-ph').forEach(b => {
        b.onclick = () => move(b.dataset.k);
        b.ondragstart = e => { drag = b.dataset.k; e.dataTransfer.setData('text/plain', 'bd-pick'); e.dataTransfer.effectAllowed = 'move'; };
        b.onpointerdown = e => { if(e.pointerType === 'mouse') return; touchDrag(e, b); };
      });
    }
    function move(k, to){
      const inUp = up.includes(k); to = to || (inUp ? 'down' : 'up');
      if((to === 'up') === inUp) return;
      if(to === 'up' && up.length >= o.cap){
        msg.textContent = o.full;
        const el = root.querySelector(`.pk-ph[data-k="${CSS.escape(k)}"]`); if(el){ el.classList.remove('pk-bounce'); void el.offsetWidth; el.classList.add('pk-bounce'); }
        return;
      }
      msg.textContent = '';
      if(to === 'up'){ down = down.filter(x => x !== k); up.push(k); } else { up = up.filter(x => x !== k); down.unshift(k); }
      draw(); o.onChange(up.slice(), down.slice(), {key: k, to});
    }
    root.querySelectorAll('.pk-box').forEach(box => {
      box.addEventListener('dragover', e => { if(drag){ e.preventDefault(); box.classList.add('over'); } });
      box.addEventListener('dragleave', () => box.classList.remove('over'));
      box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('over'); if(drag) move(drag, box.dataset.box); drag = null; });
    });
    // touch: press and drag a copy of the photo; let go over the other box. A short tap is a click (moves it).
    function touchDrag(e, b){
      const k = b.dataset.k, x0 = e.clientX, y0 = e.clientY; let ghost = null;
      const mv = ev => {
        if(!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 12) return;
        if(!ghost){ ghost = b.cloneNode(true); ghost.className = 'pk-ph pk-ghost'; document.body.appendChild(ghost); b.style.opacity = .35; }
        ghost.style.left = (ev.clientX - 40) + 'px'; ghost.style.top = (ev.clientY - 30) + 'px'; ev.preventDefault();
      };
      const end = ev => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
        if(!ghost) return;
        ghost.remove(); b.style.opacity = '';
        const box = document.elementFromPoint(ev.clientX, ev.clientY); const t = box && box.closest('.pk-box');
        b.addEventListener('click', ce => { ce.stopImmediatePropagation(); ce.preventDefault(); }, {once: true, capture: true});
        if(t) move(k, t.dataset.box);
      };
      addEventListener('pointermove', mv, {passive: false}); addEventListener('pointerup', end); addEventListener('pointercancel', end);
    }
    draw();
    return {get: () => ({upper: up.slice(), lower: down.slice()})};
  };
})();
