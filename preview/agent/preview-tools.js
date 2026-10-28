// Rough-draft preview helpers (brief preview-and-lookup-10-24, 10/25/2026). No model calls here.
//   PreviewTools.roomKey(text)              a caption, MLS room or photo label -> one room type ('kitchen', 'primary bath', ...)
//   PreviewTools.load() / heading / line    room headings and the "what you'll get" lines (/designs/shared/preview-lines.json)
//   PreviewTools.isPreview(text)            true when a text holds a preview line (exports refuse it)
//   PreviewTools.cleanPlan(blob)            the agent's own floor plan as simple line art, one image per floor
//   PreviewTools.planPages(blobs) / artPages(art)   the plan pages as JPEGs for the plan read at Finalize, cropped to the drawing
//   PreviewTools.planCanvases(blobs) / colorPlan(canvases, plan)   the listing's own plan, colored from that read (pkg.plan)
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
  // a PDF (each page up to 4: one per floor) or an image -> white-backed canvases about `long` px on the long side
  async function pages(blob, long = 1800){
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if(blob.type === 'application/pdf' || String.fromCharCode(...head) === '%PDF-'){
      const lib = await PT.pdfjs(), doc = await lib.getDocument({data: await blob.arrayBuffer()}).promise, out = [];
      for(let i = 1; i <= Math.min(doc.numPages, 4); i++){
        const pg = await doc.getPage(i), v = pg.getViewport({scale: 1}), vp = pg.getViewport({scale: Math.min(8, long / Math.max(v.width, v.height))});
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
  const withRetry = async (b, long) => {
    const once = () => Promise.race([pages(b, long), new Promise((_, rej) => setTimeout(() => rej(new Error('plan-timeout')), 20000))]);
    try { return await once(); } catch(e){ if(e.message !== 'plan-timeout') throw e; return once(); }
  };
  PT.cleanPlan = async (blobs, labels) => {
    const out = [];
    for(const b of [].concat(blobs)) for(const c of await withRetry(b)){ if(out.length >= 4) break; const a = lineArt(c); if(a) out.push(a); }
    return out.map((a, i) => Object.assign(a, {label: (labels && labels[i]) || (out.length > 1 ? FLOORS[i] : '')}));
  };
  // the plan pages as the redraw at Finalize reads them: the page as printed (room names and sizes stay sharp, no line
  // cleanup), cropped to the drawing, JPEG at most 1568 px on the long side (what the model reads at full detail).
  // A PDF is drawn large first (4200 px), so a floor that fills a third of its page still reaches the model sharp.
  // -> [{data (base64), w, h}]
  const forRead = c => {
    const b = drawingBox(c), k = Math.min(1, 1568 / Math.max(b.w, b.h)), o = canvas(b.w * k, b.h * k), g = o.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, o.width, o.height); g.imageSmoothingQuality = 'high'; g.drawImage(c, b.x, b.y, b.w, b.h, 0, 0, o.width, o.height);
    return {data: o.toDataURL('image/jpeg', .88).split(',')[1], w: o.width, h: o.height};
  };
  // where the drawing is on the page: anything not paper, in a coarse grid, joined across small gaps; the largest piece and
  // any piece at least a fifth its size (two floors side by side) are kept, so the fine print, logo and page number drop out
  PT.drawingBox = drawingBox;
  function drawingBox(c){
    const W = c.width, H = c.height, cell = Math.max(2, Math.round(Math.max(W, H) / 200)), gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
    const d = c.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, W, H).data, on = new Uint8Array(gw * gh);
    for(let y = 0; y < H; y += 2) for(let x = 0; x < W; x += 2){ const i = (y * W + x) * 4; if(.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2] < 235) on[Math.floor(y / cell) * gw + Math.floor(x / cell)] = 1; }
    const R = 2, grow = new Uint8Array(gw * gh);   // join pieces less than 2 cells apart (a door gap, a label beside a wall)
    for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++) if(on[y * gw + x])
      for(let v = Math.max(0, y - R); v <= Math.min(gh - 1, y + R); v++) for(let u = Math.max(0, x - R); u <= Math.min(gw - 1, x + R); u++) grow[v * gw + u] = 1;
    const id = new Int32Array(gw * gh).fill(-1), parts = [];
    for(let s = 0; s < gw * gh; s++){
      if(!grow[s] || id[s] >= 0) continue;
      const P = {n: 0, x0: gw, y0: gh, x1: -1, y1: -1}, st = [s]; id[s] = parts.length;
      while(st.length){ const p = st.pop(), x = p % gw, y = (p - x) / gw; if(on[p]){ P.n++; P.x0 = Math.min(P.x0, x); P.y0 = Math.min(P.y0, y); P.x1 = Math.max(P.x1, x); P.y1 = Math.max(P.y1, y); }
        for(const q of [x > 0 ? p - 1 : -1, x < gw - 1 ? p + 1 : -1, p - gw, p + gw]) if(q >= 0 && q < gw * gh && grow[q] && id[q] < 0){ id[q] = parts.length; st.push(q); } }
      parts.push(P);
    }
    const big = Math.max(0, ...parts.map(P => P.n)), keep = parts.filter(P => P.n && P.n >= big / 5);
    if(!keep.length) return {x: 0, y: 0, w: W, h: H};
    const x0 = Math.min(...keep.map(P => P.x0)) * cell, y0 = Math.min(...keep.map(P => P.y0)) * cell;
    const x1 = Math.min(W, (Math.max(...keep.map(P => P.x1)) + 1) * cell), y1 = Math.min(H, (Math.max(...keep.map(P => P.y1)) + 1) * cell);
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03), x = Math.max(0, x0 - pad), y = Math.max(0, y0 - pad);
    return {x, y, w: Math.min(W, x1 + pad) - x, h: Math.min(H, y1 + pad) - y};
  }
  // the plan pages drawn large (4200 px), once: the read gets forRead of each, and the coloring the canvases themselves
  PT.planCanvases = async blobs => {
    const out = [];
    for(const b of [].concat(blobs)) for(const c of await withRetry(b, 4200)){ if(out.length >= 4) break; out.push(c); }
    return out;
  };
  PT.forRead = forRead;
  PT.planPages = async blobs => (await PT.planCanvases(blobs)).map(forRead);
  // no file to read again (an upload from an earlier visit): the cleaned line art, on white
  PT.artCanvases = art => Promise.all([].concat(art).slice(0, 4).map(a => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { const c = canvas(im.naturalWidth, im.naturalHeight), g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0); res(c); };
    im.onerror = rej; im.src = a.src;
  })));
  PT.artPages = async art => (await PT.artCanvases(art)).map(forRead);

  // ---------- the listing's own plan, colored (the owner 10/27: dress up the listing's plan, don't redraw it) ----------
  // canvases: the pages planCanvases drew (the read's fractions are of each page's drawingBox, as forRead sent it);
  // plan: package-ai's {kind: 'color', levels}. Each floor is cut from its page at its outer walls (plus its porch, patio and
  // garage), so a builder sheet's photo, logo and dimension strings drop out; the listing's text is taken out; each room
  // is filled out to its walls. Saved as masks the design tints in its own colors: ink (the walls) and one per room kind.
  // The labels are ours, set by the template in the design's font at a print-legible size.
  const ZONE = (name, kind) => {
    if(kind === 'outdoor' || kind === 'garage' || kind === 'open') return kind;
    if(kind === 'wet') return 'bath';
    if(kind === 'closet') return 'service';
    const n = String(name || '').toLowerCase();
    if(/bed|primary|suite|guest/.test(n)) return 'sleep';
    if(/bath|powder/.test(n)) return 'bath';
    if(/closet|pantry|laundry|utility|storage|mech|linen/.test(n)) return 'service';
    if(/hall|entry|foyer|landing|gallery|stair/.test(n)) return 'open';
    return 'living';
  };
  const ZONES = ['living', 'sleep', 'bath', 'service', 'garage', 'outdoor'];
  // square dilation by r (separable running max), on a 0/1 mask
  function dilate(m, W, H, r){
    if(r < 1) return m.slice();
    const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
    for(let y = 0; y < H; y++){ const row = y * W; let last = -1e9;
      for(let x = 0; x < W; x++){ if(m[row + x]) last = x; if(x - last <= r) t[row + x] = 1; }
      last = 1e9; for(let x = W - 1; x >= 0; x--){ if(m[row + x]) last = x; if(last - x <= r) t[row + x] = 1; } }
    for(let x = 0; x < W; x++){ let last = -1e9;
      for(let y = 0; y < H; y++){ if(t[y * W + x]) last = y; if(y - last <= r) o[y * W + x] = 1; }
      last = 1e9; for(let y = H - 1; y >= 0; y--){ if(t[y * W + x]) last = y; if(last - y <= r) o[y * W + x] = 1; } }
    return o;
  }
  const maskURL = (m, W, H) => {
    const c = canvas(W, H), g = c.getContext('2d'), id = g.createImageData(W, H);
    for(let i = 0; i < W * H; i++) if(m[i]) id.data[i * 4 + 3] = 255;
    g.putImageData(id, 0, 0); return c.toDataURL('image/png');
  };
  function colorFloor(page, L){
    const b = drawingBox(page), P = f => ({x: b.x + f.left * b.w, y: b.y + f.top * b.h, r: b.x + f.right * b.w, z: b.y + f.bottom * b.h});
    const o = P(L.outline), side = Math.max(o.r - o.x, o.z - o.y);
    const outside = L.rooms.filter(r => r.kind === 'outdoor' || r.kind === 'garage').map(r => P(r.box));
    const pad = 0.03 * side, ext = [o].concat(outside);
    const x0 = Math.max(0, Math.min(...ext.map(e => e.x)) - pad), y0 = Math.max(0, Math.min(...ext.map(e => e.y)) - pad);
    const x1 = Math.min(page.width, Math.max(...ext.map(e => e.r)) + pad), y1 = Math.min(page.height, Math.max(...ext.map(e => e.z)) + pad);
    // 3000 px on the long side: 300 ppi up to 10 in, wider than any floor prints on a back panel
    const k = Math.min(4, 3000 / Math.max(x1 - x0, y1 - y0)), W = Math.round((x1 - x0) * k), H = Math.round((y1 - y0) * k), N = W * H;
    const c = canvas(W, H), g = c.getContext('2d', {willReadFrequently: true});
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.imageSmoothingQuality = 'high'; g.drawImage(page, x0, y0, x1 - x0, y1 - y0, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const T = e => ({x: (e.x - x0) * k, y: (e.y - y0) * k, r: (e.r - x0) * k, z: (e.z - y0) * k});
    const O = T(o);
    // pixels per foot here: from the floor's size in feet (package-ai), else a house about 45 ft across
    const ppf = L.feet && L.feet.w > 0 ? (O.r - O.x) / L.feet.w : Math.max(O.r - O.x, O.z - O.y) / 45;
    // what belongs to this floor: the outer walls a little out, and each porch, patio and garage box
    const keep = new Uint8Array(N), mark = (e, p) => { const a = Math.max(0, Math.floor(e.x - p)), bb = Math.min(W, Math.ceil(e.r + p)), t = Math.max(0, Math.floor(e.y - p)), z = Math.min(H, Math.ceil(e.z + p));
      for(let y = t; y < z; y++) keep.fill(1, y * W + a, y * W + bb); };
    mark(O, 1.2 * ppf); outside.forEach(e => mark(T(e), 0.8 * ppf));
    const dark = new Uint8Array(N);
    for(let i = 0; i < N; i++) if(keep[i] && .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2] < 170) dark[i] = 1;
    // the listing's text out: a letter is under about a foot tall and wide; near a room's label, pieces up to 2.6 ft
    // (letters run together in bold type). Walls, door swings and fixtures are larger and stay.
    const wins = L.rooms.map(r => { const B = T(P(r.box)), lx = (b.x + r.label.x * b.w - x0) * k, ly = (b.y + r.label.y * b.h - y0) * k,
      hw = Math.max(2.5 * ppf, (B.r - B.x) / 2), hh = 2.5 * ppf; return {x: lx - hw, r: lx + hw, y: ly - hh, z: ly + hh}; });
    const seen = new Uint8Array(N), stack = new Int32Array(N), comp = [];
    for(let s = 0; s < N; s++){
      if(!dark[s] || seen[s]) continue;
      let top = 0, ax = W, ay = H, bx = -1, by = -1; stack[top++] = s; seen[s] = 1; comp.length = 0;
      while(top){ const p = stack[--top], x = p % W, y = (p - x) / W; comp.push(p);
        if(x < ax) ax = x; if(x > bx) bx = x; if(y < ay) ay = y; if(y > by) by = y;
        for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const X = x + dx, Y = y + dy; if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const q = Y * W + X; if(dark[q] && !seen[q]){ seen[q] = 1; stack[top++] = q; } } }
      const big = Math.max(bx - ax, by - ay) + 1;
      const text = big < 1.1 * ppf || (big < 2.6 * ppf && wins.some(w => ax >= w.x && bx <= w.r && ay >= w.y && by <= w.z));
      if(text) for(const p of comp) dark[p] = 0;
    }
    const walls = dark, rD = Math.max(1, Math.round(0.15 * ppf)), blocked = dilate(walls, W, H, rD);
    // open floor, split by the walls (4-connected; a door opening joins rooms, the room boxes keep each color in its room)
    const free = new Int32Array(N); let nid = 0;
    for(let s = 0; s < N; s++){
      if(blocked[s] || free[s] || !keep[s]) continue;
      nid++; let top = 0; stack[top++] = s; free[s] = nid;
      while(top){ const p = stack[--top], x = p % W;
        for(const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if(q >= 0 && q < N && !blocked[q] && !free[q] && keep[q]){ free[q] = nid; stack[top++] = q; } }
    }
    // inside the house: the marked outline runs a little past the walls in places (a bay, a jog), so in each row and
    // column the color stops at the outermost wall near the box edge (an opening takes its neighbors' position)
    const R = 3 * ppf, bx0 = Math.max(0, Math.floor(O.x - ppf)), bx1 = Math.min(W, Math.ceil(O.r + ppf)), by0 = Math.max(0, Math.floor(O.y - ppf)), by1 = Math.min(H, Math.ceil(O.z + ppf));
    const edges = (n, lo, hi, at) => {   // at(i, j) -> wall at line i, position j (lo..hi)
      const a = new Float64Array(n).fill(NaN), z = new Float64Array(n).fill(NaN);
      for(let i = 0; i < n; i++){
        for(let j = lo; j < Math.min(hi, lo + R); j++) if(at(i, j)){ a[i] = j; break; }
        for(let j = hi - 1; j >= Math.max(lo, hi - R); j--) if(at(i, j)){ z[i] = j; break; }
      }
      for(const [v, dflt] of [[a, lo], [z, hi - 1]]){
        const ok = []; for(let i = 0; i < n; i++) if(!isNaN(v[i])) ok.push(i);
        if(!ok.length){ v.fill(dflt); continue; }
        let m = 0; for(let i = 0; i < n; i++){ while(m < ok.length - 1 && Math.abs(ok[m + 1] - i) <= Math.abs(ok[m] - i)) m++; if(isNaN(v[i])) v[i] = v[ok[m]]; }
      }
      return [a, z];
    };
    const [xl, xr] = edges(by1 - by0, bx0, bx1, (i, j) => walls[(i + by0) * W + j]);
    const [yt, yb] = edges(bx1 - bx0, by0, by1, (i, j) => walls[j * W + i + bx0]);
    const inside = new Uint8Array(N);
    for(let y = by0; y < by1; y++) for(let x = bx0; x < bx1; x++)
      if(x >= xl[y - by0] && x <= xr[y - by0] && y >= yt[x - bx0] && y <= yb[x - bx0]) inside[y * W + x] = 1;
    // marks outside the walls that aren't a porch, patio or garage: the listing's floor title ("2nd Floor"), a north arrow
    const outs = outside.map(T), held = (x, y) => outs.some(e => x >= e.x && x <= e.r && y >= e.y && y <= e.z);
    seen.fill(0);
    for(let s = 0; s < N; s++){
      if(!walls[s] || seen[s]) continue;
      let top = 0, ax = W, ay = H, bx = -1, by = -1, inn = 0; stack[top++] = s; seen[s] = 1; comp.length = 0;
      while(top){ const p = stack[--top], x = p % W, y = (p - x) / W; comp.push(p); if(inside[p] || held(x, y)) inn = 1;
        if(x < ax) ax = x; if(x > bx) bx = x; if(y < ay) ay = y; if(y > by) by = y;
        for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const X = x + dx, Y = y + dy; if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const q = Y * W + X; if(walls[q] && !seen[q]){ seen[q] = 1; stack[top++] = q; } } }
      if(!inn && Math.max(bx - ax, by - ay) < 6 * ppf) for(const p of comp) walls[p] = 0;
    }
    // each room: the open floor its label sits in, inside its box, grown back to the walls; larger rooms first, so a room
    // inside another's box keeps its own color
    const zone = new Uint8Array(N), labels = [];
    const rooms = L.rooms.map(r => Object.assign({}, r, {B: T(P(r.box)), zone: ZONE(r.name, r.kind)}));
    rooms.slice().sort((p, q) => (q.B.r - q.B.x) * (q.B.z - q.B.y) - (p.B.r - p.B.x) * (p.B.z - p.B.y)).forEach(r => {
      if(r.zone === 'open') return;
      const zi = ZONES.indexOf(r.zone) + 1, pd = 0.4 * ppf, B = r.B;
      const a = Math.max(0, Math.floor(B.x - pd)), bb = Math.min(W, Math.ceil(B.r + pd)), t = Math.max(0, Math.floor(B.y - pd)), z = Math.min(H, Math.ceil(B.z + pd));
      if(bb <= a || z <= t) return;
      const at = (x, y) => free[Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))];
      const lx = (b.x + r.label.x * b.w - x0) * k, ly = (b.y + r.label.y * b.h - y0) * k;
      const seed = at(lx, ly) || at((B.x + B.r) / 2, (B.y + B.z) / 2);
      if(!seed) return;
      const out = r.zone === 'outdoor' || r.zone === 'garage', w = bb - a, h = z - t, m = new Uint8Array(w * h);
      for(let y = t; y < z; y++) for(let x = a; x < bb; x++){ const i = y * W + x; if(free[i] === seed && (out || inside[i])) m[(y - t) * w + x - a] = 1; }
      const g2 = dilate(m, w, h, rD + 1);
      for(let y = t; y < z; y++) for(let x = a; x < bb; x++){ const i = y * W + x; if(g2[(y - t) * w + x - a] && !walls[i] && (out || inside[i])) zone[i] = zi; }
    });
    rooms.forEach(r => {
      if(r.minor && rooms.some(q => q !== r && !q.minor && q.name === r.name)) return;   // the small piece of an L
      const lx = (b.x + r.label.x * b.w - x0) * k, ly = (b.y + r.label.y * b.h - y0) * k;
      labels.push({name: r.name, short: r.short, dims: r.dims, kind: r.kind, minor: r.minor, zone: r.zone,
        x: +(lx / W).toFixed(4), y: +(ly / H).toFixed(4), bx: +(r.B.x / W).toFixed(4), by: +(r.B.y / H).toFixed(4), w: +((r.B.r - r.B.x) / W).toFixed(4), h: +((r.B.z - r.B.y) / H).toFixed(4)});
    });
    const layers = {ink: maskURL(dilate(walls, W, H, 1), W, H)};
    ZONES.forEach((zn, i) => { const m = new Uint8Array(N); let any = 0; for(let p = 0; p < N; p++) if(zone[p] === i + 1){ m[p] = 1; any = 1; } if(any) layers[zn] = maskURL(m, W, H); });
    return {name: L.name, floor: L.floor, roof: !!L.roof, w: W, h: H, pageScale: +(1 / k).toFixed(4), feet: L.feet ? {w: +(W / ppf).toFixed(1), d: +(H / ppf).toFixed(1)} : null, layers, labels};
  }
  PT.colorPlan = (canvases, plan) => {
    const levels = [];
    for(const L of plan.levels || []){ const c = canvases[L.page - 1]; if(c) levels.push(colorFloor(c, L)); }
    return {kind: 'color', source: plan.source || 'Floor plan from the listing, colored for this brochure.', levels};
  };

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
