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
  // the owner's 10/27 review rules (product.md "Floor plans"): three colors only (living areas, bedrooms, baths; foyers, halls
  // and landings take the living color); shading follows the real walls, angles and bays included, and stops at a door;
  // closets, pantries and showers take the color of the room they open into; nothing inside is white but "Open to below";
  // one label per room, centered and clear of every line, fixture, island and stair; every door swing, a fireplace's full
  // hatching and the stair treads carry over; no stray line pieces. A listing plan that is already colored and labeled is
  // placed as it is (cropped to the house, turned), never redrawn.
  const VOID = /open to (below|above)|^open( area)? below|^open$/i;
  const SMALL = 5.5;                                                    // ft: a closet or laundry this narrow is a hall or linen closet, a W/D spot
  const ZONE = (name, kind, ft) => {
    const n = String(name || '').toLowerCase(), big = ft && Math.min(ft.w, ft.d) >= SMALL;
    if(VOID.test(n) || /stair/.test(n)) return 'void';   // open to below, and a stairwell (white, the owner 10/28)
    if(kind === 'outdoor' || kind === 'garage') return kind;
    if(kind === 'wet' || /bath|powder|shower|toilet|\bw\.?c\.?\b/.test(n)) return 'bath';
    if(/\bchase\b/.test(n)) return 'chase';                               // a chase: hatched (the owner 10/28)
    if(/storage|\bshop\b|workshop/.test(n)) return 'paper';
    if(/closet|wardrobe|linen|pantry|\bw\.?i\.?c\b/.test(n)) return 'inherit';
    if(/bed|primary|suite|guest|nursery/.test(n)) return 'sleep';
    // a laundry, utility or mud room big enough to stand in is a room; a W/D spot takes the room it opens into
    if(kind === 'closet') return big ? 'living' : 'inherit';
    return 'living';                                                    // rooms, and the foyer, halls and landings
  };
  // 'paper': storage, a shop, a room off the garage (the owner 10/28: paper like the garage and porches); stairwells take 'void'
  const ZONES = ['living', 'sleep', 'bath', 'garage', 'outdoor', 'void', 'paper', 'chase'];
  const TINTED = ['living', 'sleep', 'bath'];
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
  // running max (or min) over a square of radius r, on gray values (monotone queue, rows then columns)
  function rank(v, W, H, r, max){
    const better = max ? (a, b) => a >= b : (a, b) => a <= b;
    const pass = (src, dst, n, len, at) => { const q = new Int32Array(len);
      for(let i = 0; i < n; i++){ let h = 0, t = 0;
        for(let j = 0; j < len + r; j++){
          if(j < len){ const val = src[at(i, j)]; while(t > h && better(val, src[at(i, q[t - 1])])) t--; q[t++] = j; }
          const c = j - r; if(c < 0) continue;
          while(q[h] < c - r) h++;
          dst[at(i, c)] = src[at(i, q[h])];
        } } };
    const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
    pass(v, t, H, W, (y, x) => y * W + x); pass(t, o, W, H, (x, y) => y * W + x);
    return o;
  }
  const maskURL = (m, W, H) => {
    const c = canvas(W, H), g = c.getContext('2d'), id = g.createImageData(W, H);
    for(let i = 0; i < W * H; i++) if(m[i]) id.data[i * 4 + 3] = 255;
    g.putImageData(id, 0, 0); return c.toDataURL('image/png');
  };
  // 8-connected pieces of a mask: calls f(pixels, x0, y0, x1, y1) for each
  // why a rule took a listing line out (kept per pixel, sent with the floor for the before-and-after check)
  const WHY = {ceiling: 1, fixture: 2, drop: 3, openLine: 4, rods: 5, stairs: 6, outside: 7, door: 8, voidLine: 9};
  function pieces(m, W, H, f){
    const seen = new Uint8Array(W * H), stack = new Int32Array(W * H), comp = [];
    for(let s = 0; s < W * H; s++){
      if(!m[s] || seen[s]) continue;
      let top = 0, ax = W, ay = H, bx = -1, by = -1; stack[top++] = s; seen[s] = 1; comp.length = 0;
      while(top){ const p = stack[--top], x = p % W, y = (p - x) / W; comp.push(p);
        if(x < ax) ax = x; if(x > bx) bx = x; if(y < ay) ay = y; if(y > by) by = y;
        for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const X = x + dx, Y = y + dy; if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const q = Y * W + X; if(m[q] && !seen[q]){ seen[q] = 1; stack[top++] = q; } } }
      f(comp, ax, ay, bx, by);
    }
  }
  // a floor cut from its page: the box around its outer walls, plus each porch, patio and garage that touches it (a
  // detached garage set apart on the page is left off), at 3000 px on the long side (300 ppi up to 10 in)
  function floorCrop(page, L, house){
    const b = drawingBox(page), P = f => ({x: b.x + f.left * b.w, y: b.y + f.top * b.h, r: b.x + f.right * b.w, z: b.y + f.bottom * b.h});
    const o = P(L.outline), side = Math.max(o.r - o.x, o.z - o.y), near = 0.04 * side;
    const touches = e => e.x <= o.r + near && e.r >= o.x - near && e.y <= o.z + near && e.z >= o.y - near;
    const outside = L.rooms.filter(r => (r.kind === 'outdoor' || r.kind === 'garage') && !/yard|lawn|drive|pool/i.test(r.name)).map(r => P(r.box)).filter(e => !house || touches(e));
    const pad = 0.03 * side, ext = [o].concat(outside);
    const x0 = Math.max(0, Math.min(...ext.map(e => e.x)) - pad), y0 = Math.max(0, Math.min(...ext.map(e => e.y)) - pad);
    const x1 = Math.min(page.width, Math.max(...ext.map(e => e.r)) + pad), y1 = Math.min(page.height, Math.max(...ext.map(e => e.z)) + pad);
    const k = Math.min(4, 3000 / Math.max(x1 - x0, y1 - y0)), W = Math.round((x1 - x0) * k), H = Math.round((y1 - y0) * k);
    const c = canvas(W, H), g = c.getContext('2d', {willReadFrequently: true});
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.imageSmoothingQuality = 'high'; g.drawImage(page, x0, y0, x1 - x0, y1 - y0, 0, 0, W, H);
    const T = e => ({x: (e.x - x0) * k, y: (e.y - y0) * k, r: (e.r - x0) * k, z: (e.z - y0) * k});
    return {b, P, T, o, outside, c, g, W, H, k, x0, y0};
  }
  // already colored by the listing (rooms tinted by kind, more than a tenth of the floor in color) and no watermark: the
  // listing's own finished plan is placed as it is. A watermark (another company's name across the plan) shows as faint
  // texture inside the flat tints, measured at the read's size (about 1568 px across the drawing).
  PT.planFinished = (canvases, plan) => {
    let colored = 0, marks = 0;
    for(const L of plan.levels || []){
      const page = canvases[L.page - 1]; if(!page) continue;
      const b = drawingBox(page), k = Math.min(1, 1568 / Math.max(b.w, b.h)), o = L.outline;
      const sx = b.x + o.left * b.w, sy = b.y + o.top * b.h, sw = (o.right - o.left) * b.w, sh = (o.bottom - o.top) * b.h;
      const W = Math.max(8, Math.round(sw * k)), H = Math.max(8, Math.round(sh * k)), c = canvas(W, H), g = c.getContext('2d', {willReadFrequently: true});
      g.drawImage(page, sx, sy, sw, sh, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data, N = W * H, lum = new Uint8Array(N), col = new Uint8Array(N);
      let n = 0;
      for(let i = 0; i < N; i++){ const r = d[i * 4], gg = d[i * 4 + 1], bb = d[i * 4 + 2], l = (r + gg + bb) / 3; lum[i] = l;
        if(Math.max(r, gg, bb) - Math.min(r, gg, bb) > 25 && l > 60){ col[i] = 1; n++; } }
      const hi = rank(lum, W, H, 2, true), lo = rank(lum, W, H, 2, false); let tex = 0;
      for(let i = 0; i < N; i++) if(col[i]){ const v = hi[i] - lo[i]; if(v > 4 && v < 30) tex++; }
      colored = Math.max(colored, n / N); if(n) marks = Math.max(marks, tex / n);
    }
    return {finished: colored > 0.1 && marks < 0.08, colored: +colored.toFixed(3), watermark: marks >= 0.08, texture: +marks.toFixed(3)};
  };
  // a listing's own drawing keeps its own labels; a walk-in closet it left unnamed gets ours (the owner 10/28: label Eubanks'
  // primary closet WIC), at its center, in the room's own space
  const unnamed = (F, L) => L.rooms.filter(r => r.printed === false && /walk-?in closet|\bw\.?i\.?c\b/i.test(r.name)).map(r => { const B = F.T(F.P(r.box)), W = F.W, H = F.H;
    const cx = (B.x + B.r) / 2, cy = (B.y + B.z) / 2, hw = 0.4 * (B.r - B.x), hh = 0.4 * (B.z - B.y);
    return {name: 'Walk-In Closet', short: 'WIC', dims: '', kind: 'closet', zone: 'inherit', x: +(cx / W).toFixed(4), y: +(cy / H).toFixed(4),
      bx: +(B.x / W).toFixed(4), by: +(B.y / H).toFixed(4), w: +((B.r - B.x) / W).toFixed(4), h: +((B.z - B.y) / H).toFixed(4),
      c: [{x: +(cx / W).toFixed(4), y: +(cy / H).toFixed(4), p: [[+(hh / H).toFixed(4), +(hw / W).toFixed(4)]]}]}; });
  function finishedFloor(page, L){
    const F = floorCrop(page, L, true);
    // the listing's white paper goes clear, so the plan sits on the design's own paper (no white box on a tinted panel)
    // and only this floor: what lies in its rooms (a floor drawn in two blocks spans part of another floor's drawing)
    const id = F.g.getImageData(0, 0, F.W, F.H), d = id.data, pad = 0.03 * Math.max(F.W, F.H);
    const bx = L.rooms.filter(r => !/yard|lawn|drive|pool/i.test(r.name)).map(r => F.T(F.P(r.box))).concat([F.T(F.o)].filter(() => !L.rooms.length));
    // the paper: the commonest light color along the crop's edge (a listing's paper is often a little off white)
    const hist = new Map(); for(let x = 0; x < F.W; x += 3) for(const y of [0, F.H - 1]){ const i = (y * F.W + x) * 4, kk = (d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3); hist.set(kk, (hist.get(kk) || 0) + 1); }
    const top = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0], pr = (top >> 10) * 8 + 4, pg = ((top >> 5) & 31) * 8 + 4, pbl = (top & 31) * 8 + 4;
    const paper = Math.min(pr, pg, pbl) > 200 ? [pr, pg, pbl] : [255, 255, 255];
    for(let i = 0; i < d.length; i += 4){ const p = i / 4, x = p % F.W, y = (p - x) / F.W;
      const isPaper = Math.min(d[i], d[i + 1], d[i + 2]) > 242 || (Math.abs(d[i] - paper[0]) < 10 && Math.abs(d[i + 1] - paper[1]) < 10 && Math.abs(d[i + 2] - paper[2]) < 10);
      if(isPaper || !bx.some(e => x >= e.x - pad && x <= e.r + pad && y >= e.y - pad && y <= e.z + pad)) d[i + 3] = 0; }
    F.g.putImageData(id, 0, 0);
    // which way the listing's text runs (it can't be redrawn, so the plan is turned to keep it readable): around each
    // room's label, each letter's nearest neighbor letter sits beside it ('h') or above or below it ('v'). Gray type
    // counts (W 9th's); a split block keeps its page's feet.
    let hz = 0, vt = 0;
    { const ppf = L.ppfPage ? L.ppfPage * F.k : L.feet && L.feet.w > 0 ? (F.T(F.o).r - F.T(F.o).x) / L.feet.w : Math.max(F.W, F.H) / 45, r = 2 * ppf;
      for(const rm of L.rooms){ const lx = (F.b.x + rm.label.x * F.b.w - F.x0) * F.k, ly = (F.b.y + rm.label.y * F.b.h - F.y0) * F.k;
        const x0 = Math.max(0, Math.round(lx - r)), y0 = Math.max(0, Math.round(ly - r)), x1 = Math.min(F.W, Math.round(lx + r)), y1 = Math.min(F.H, Math.round(ly + r)), w = x1 - x0, h = y1 - y0;
        if(w < 4 || h < 4) continue;
        const m = new Uint8Array(w * h); for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = ((y + y0) * F.W + x + x0) * 4; if(d[i + 3] && d[i] + d[i + 1] + d[i + 2] < 480) m[y * w + x] = 1; }
        const c = [];
        pieces(m, w, h, (comp, a0, b0, a1, b1) => { const big = Math.max(a1 - a0, b1 - b0) + 1; if(big < 0.6 * ppf && big > 0.08 * ppf) c.push([(a0 + a1) / 2, (b0 + b1) / 2]); });
        for(const [px, py] of c){ let best = null, bd = 1e9; for(const [qx, qy] of c){ const dd = Math.hypot(qx - px, qy - py); if(dd > 0 && dd < bd){ bd = dd; best = [qx - px, qy - py]; } }
          if(best && bd < 0.5 * ppf){ if(Math.abs(best[0]) > Math.abs(best[1])) hz++; else vt++; } } } }
    return {kind: 'image', textDir: vt > hz ? 'v' : 'h', name: L.name, floor: L.floor, roof: !!L.roof, front: L.front || 'bottom', w: F.W, h: F.H, pageScale: +(1 / F.k).toFixed(4),
      feet: L.feet ? {w: +(F.W / ((F.T(F.o).r - F.T(F.o).x) / L.feet.w)).toFixed(1), d: +(F.H / ((F.T(F.o).r - F.T(F.o).x) / L.feet.w)).toFixed(1)} : null,
      src: F.c.toDataURL('image/png'), labels: unnamed(F, L), issues: []};
  }
  function colorFloor(page, L){
    const F = floorCrop(page, L, false), {b, P, T, c, W, H, k, x0, y0} = F, o = F.o, outside = F.outside, N = W * H, issues = [];
    const d = F.g.getImageData(0, 0, W, H).data;
    const O = T(o);
    // pixels per foot here: from the floor's size in feet (package-ai), else a house about 45 ft across
    const ppf = L.feet && L.feet.w > 0 ? (O.r - O.x) / L.feet.w : Math.max(O.r - O.x, O.z - O.y) / 45;
    // what belongs to this floor: the outer walls a little out, and each porch, patio and garage box
    const keep = new Uint8Array(N), mark = (e, p) => { const a = Math.max(0, Math.floor(e.x - p)), bb = Math.min(W, Math.ceil(e.r + p)), t = Math.max(0, Math.floor(e.y - p)), z = Math.min(H, Math.ceil(e.z + p));
      for(let y = t; y < z; y++) keep.fill(1, y * W + a, y * W + bb); };
    mark(O, 1.2 * ppf); outside.forEach(e => mark(T(e), 0.8 * ppf));
    // ink by contrast, not by darkness: a pixel well darker than the paper or tint around it is a line, so a thin gray
    // line stays whole (Beulah's counters, door swings and shower X broke into dashes at a fixed darkness cut, and the
    // dashes went out as text) while a gray-filled or tinted room is not ink. Thick walls are simply dark.
    const lum = new Uint8Array(N);
    for(let i = 0; i < N; i++) lum[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
    const rT = Math.max(2, Math.round(0.3 * ppf)), closed = rank(rank(lum, W, H, rT, true), W, H, rT, false);
    const dark = new Uint8Array(N);
    for(let i = 0; i < N; i++) if(keep[i] && (lum[i] < 170 || closed[i] - lum[i] > 45)) dark[i] = 1;
    const stairsB = L.stairs ? T(P(L.stairs)) : null, inBox = (e, x, y, p) => e && x >= e.x - p && x <= e.r + p && y >= e.y - p && y <= e.z + p;
    // straight runs of ink, across and down, at each dark pixel: walls are long runs, letters and hatching short ones
    // (measured on the ink grown a pixel, so a faint 1 px line that wobbles between rows, an island's edge, is one run)
    const runs = thick => { const dk = thick ? dilate(dark, W, H, 1) : dark, hr = new Uint16Array(N), vr = new Uint16Array(N);
      for(let y = 0; y < H; y++){ let x = 0; while(x < W){ if(!dk[y * W + x]){ x++; continue; } let e = x; while(e < W && dk[y * W + e]) e++; hr.fill(Math.min(65535, e - x), y * W + x, y * W + e); x = e; } }
      for(let x = 0; x < W; x++){ let y = 0; while(y < H){ if(!dk[y * W + x]){ y++; continue; } let e = y; while(e < H && dk[e * W + x]) e++; for(let q = y; q < e; q++) vr[q * W + x] = Math.min(65535, e - y); y = e; } }
      return [hr, vr]; };
    // hatching: thin diagonal lines packed close. A small patch (a fireplace, a hearth) is kept whole and protected from the
    // text pass (Stoney Brook's fireplace lost half its hatching); a large one (Marshall's ceiling bands) is shading, not a
    // wall, and goes. A lone stroke (a door swing, a shower's X) is not packed close, so it stays.
    const protect = new Uint8Array(N), shading = new Uint8Array(N), ceilGone = new Uint8Array(N), soft = new Uint8Array(N);
    { const [hr, vr] = runs(), thin = new Uint8Array(N), lim = 0.3 * ppf;
      for(let i = 0; i < N; i++) if(dark[i] && hr[i] < lim && vr[i] < lim) thin[i] = 1;
      // a hatching stroke runs a foot or more; the strokes of small type are shorter (Marshall's turned names packed
      // close looked like hatching and were kept as a fireplace)
      const longS = new Uint8Array(N);
      // and it runs on a slant: its own direction 25 to 65 degrees off square (a letter's strokes joined into a squarish
      // piece are square to the page: Beulah's "TH" passed for hatching by its box alone, 10/28)
      pieces(thin, W, H, (comp, ax, ay, bx, by) => { const a = bx - ax + 1, c = by - ay + 1;
        if(Math.max(a, c) < 0.8 * ppf || Math.min(a, c) < 0.4 * Math.max(a, c)) return;
        let mx = 0, my = 0; for(const p of comp){ mx += p % W; my += (p - p % W) / W; } mx /= comp.length; my /= comp.length;
        let sxx = 0, syy = 0, sxy = 0; for(const p of comp){ const x = p % W - mx, y = (p - p % W) / W - my; sxx += x * x; syy += y * y; sxy += x * y; }
        const ang = Math.abs(0.5 * Math.atan2(2 * sxy, sxx - syy)) * 180 / Math.PI, el = Math.sqrt((sxx - syy) ** 2 + 4 * sxy * sxy) / (sxx + syy + 1e-9);
        if(ang >= 25 && ang <= 65 && el >= 0.5) for(const p of comp) longS[p] = 1; });
      const I = new Float64Array((W + 1) * (H + 1));   // summed area of thin strokes
      for(let y = 0; y < H; y++){ let row = 0; for(let x = 0; x < W; x++){ row += thin[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
      const r = Math.max(2, Math.round(0.6 * ppf)), hatch = new Uint8Array(N);
      for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const i = y * W + x; if(!thin[i]) continue;
        const a0 = Math.max(0, x - r), a1 = Math.min(W, x + r + 1), b0 = Math.max(0, y - r), b1 = Math.min(H, y + r + 1);
        const n = I[b1 * (W + 1) + a1] - I[b0 * (W + 1) + a1] - I[b1 * (W + 1) + a0] + I[b0 * (W + 1) + a0];
        if(n > 0.2 * (a1 - a0) * (b1 - b0)) hatch[i] = 1; }
      const zone = dilate(hatch, W, H, Math.round(0.5 * ppf));
      pieces(zone, W, H, (comp, ax, ay, bx, by) => {
        let hs = 0, ls = 0; for(const p of comp) if(hatch[p]){ hs++; if(longS[p]) ls++; }
        // (a fireplace's hatch is a foot or more each way; a pair of bold letters is smaller: Beulah's "TH", 10/28)
        const w = (bx - ax + 1) / ppf, h = (by - ay + 1) / ppf, small = Math.max(w, h) <= 9 && w * h <= 45 && ls >= 0.5 * hs && Math.min(w, h) >= 1;
        if(Math.max(w, h) <= 9 && w * h <= 45 && !small) return;   // type: the text pass takes it
        // (a small patch protects its own slanted strokes only, never type beside them)
        for(const p of comp) if(dark[p] && !protect[p]){ if(small){ if(longS[p]) protect[p] = 1; } else if(hatch[p]){ dark[p] = 0; shading[p] = 1; } }
      });
    }
    // the lines as drawn, for the check that no long line lost a large part of itself (a half-drawn room)
    const before = dark.slice();
    // closes a shape: some paper inside its box can't reach the box edge (an island, a tub, a toilet's bowl; a letter's
    // counter is smaller than 0.3 ft across)
    const closes = (comp, ax, ay, bx, by, m0) => {
      const bw = bx - ax + 1, bh = by - ay + 1, w2 = bw + 2, m = new Uint8Array(w2 * (bh + 2));
      for(const p of comp){ const x = p % W, y = (p - x) / W; m[(y - ay + 1) * w2 + x - ax + 1] = 1; }
      const st = [0]; m[0] = 2; while(st.length){ const p = st.pop(), x = p % w2; for(const q of [x > 0 ? p - 1 : -1, x < w2 - 1 ? p + 1 : -1, p - w2, p + w2]) if(q >= 0 && q < m.length && !m[q]){ m[q] = 2; st.push(q); } }
      let hole = 0; for(let i = 0; i < m.length; i++) if(!m[i]) hole++;
      return hole >= (m0 || (0.3 * ppf) ** 2);
    };
    // furniture and fixtures, never type: a solid block (a column, a post) or a drawn box (a console, a bench, a vanity:
    // nearly all its ink on the edges of its own box). Westheimer's dining area lost the column and console beside its
    // table to the text pass (10/27).
    // (solid: ink all the way through a 0.2 ft square, a wall's thickness: a short support wall stays (Stoney Brook's
    // dining room, 10/28); a bold letter's strokes are thinner)
    const core = (() => { const paper = new Uint8Array(N); for(let i = 0; i < N; i++) paper[i] = dark[i] ? 0 : 1; const g = dilate(paper, W, H, Math.max(1, Math.round(0.1 * ppf))); for(let i = 0; i < N; i++) g[i] = g[i] ? 0 : 1; return g; })();
    // (a post or support wall is ink about 0.3 ft through; a bold letter's stroke is thinner: Beulah's bedroom names stayed
    // as bars when the post test used 0.2 ft, 10/28)
    // A post or a short support wall is one solid straight bar, at any angle: its ink fills its own turned box (Stoney Brook's
    // diagonal dining-room post); bold letters ("TH", "87", Beulah's bedroom names) have gaps and branches and don't
    const postLike = comp => { const n = comp.length; if(n < 4) return false; let mx = 0, my = 0; for(const p of comp){ mx += p % W; my += (p - p % W) / W; } mx /= n; my /= n;
      let sxx = 0, syy = 0, sxy = 0; for(const p of comp){ const x = p % W - mx, y = (p - p % W) / W - my; sxx += x * x; syy += y * y; sxy += x * y; }
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), c = Math.cos(th), sn = Math.sin(th); let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for(const p of comp){ const x = p % W - mx, y = (p - p % W) / W - my, u = x * c + y * sn, v = -x * sn + y * c; a0 = Math.min(a0, u); a1 = Math.max(a1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
      const l1 = Math.max(a1 - a0, b1 - b0) + 1, l2 = Math.min(a1 - a0, b1 - b0) + 1;
      return l1 >= 0.8 * ppf && l2 >= 0.25 * ppf && n >= 0.75 * l1 * l2; };
    const furniture = (comp, ax, ay, bx, by) => {
      let edge = 0;
      const long = Math.max(bx - ax, by - ay) + 1 >= 0.8 * ppf;   // a support wall runs a foot or so; a bold letter's blob is shorter
      if(long && postLike(comp)) return true;
      for(const p of comp){ const x = p % W, y = (p - x) / W; if(x - ax < 3 || bx - x < 3 || y - ay < 3 || by - y < 3) edge++; }
      return Math.min(bx - ax, by - ay) + 1 >= 0.5 * ppf && edge >= 0.85 * comp.length && closes(comp, ax, ay, bx, by);
    };
    // the listing's text out: a letter is under about a foot tall and wide; near a room's label, pieces up to 2.6 ft
    // (letters run together in bold type). Walls, door swings and fixtures are larger and stay.
    const stB = L.stairs ? T(P(L.stairs)) : null;
    const rbs = L.rooms.map(r => T(P(r.box))).concat(stB ? [stB] : []), inRoomBox = (ax, ay, bx, by) => rbs.some(e => ax >= e.x && bx <= e.r && ay >= e.y && by <= e.z);
    // (a name printed across, and one printed turned up the page: Beulah's "PRIMARY BATH" ran past the across window, 10/28)
    // (which way a room's printed name runs: around its label, each letter's nearest letter sits beside it or above it)
    const turned = (lx, ly) => { const r = Math.round(2 * ppf), x0_ = Math.max(0, Math.round(lx - r)), y0_ = Math.max(0, Math.round(ly - r)), w = Math.min(W, Math.round(lx + r)) - x0_, h = Math.min(H, Math.round(ly + r)) - y0_;
      if(w < 4 || h < 4) return false; const m = new Uint8Array(w * h); for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) if(dark[(y + y0_) * W + x + x0_]) m[y * w + x] = 1;
      const c = []; pieces(m, w, h, (comp, a0, b0, a1, b1) => { const big = Math.max(a1 - a0, b1 - b0) + 1; if(big < 0.8 * ppf && big > 0.1 * ppf) c.push([(a0 + a1) / 2, (b0 + b1) / 2]); });
      let hz = 0, vt = 0; for(const [px, py] of c){ let best = null, bd = 1e9; for(const [qx, qy] of c){ const dd = Math.hypot(qx - px, qy - py); if(dd > 0 && dd < bd){ bd = dd; best = [qx - px, qy - py]; } }
        if(best && bd < 0.6 * ppf){ if(Math.abs(best[0]) > Math.abs(best[1])) hz++; else vt++; } }
      return vt > hz && vt >= 3; };
    const wins = L.rooms.flatMap(r => { const B = T(P(r.box)), lx = (b.x + r.label.x * b.w - x0) * k, ly = (b.y + r.label.y * b.h - y0) * k,
      hw = Math.max(2.5 * ppf, (B.r - B.x) / 2), hh = Math.max(2.5 * ppf, (B.z - B.y) / 2), s2 = 2.5 * ppf;
      return [{x: lx - hw, r: lx + hw, y: ly - s2, z: ly + s2}].concat(turned(lx, ly) ? [{x: lx - s2, r: lx + s2, y: ly - hh, z: ly + hh, v: 1}] : []); });
    // ink the read places a fixture on (a toilet drawn as an open box against the wall, a tub's edge) is never type
    const fxBoxes = (L.fixtures || []).filter(q => q.box && q.type !== 'drop' && q.type !== 'door').map(q => T(P(q.box)));
    const onFixture = (ax, ay, bx, by) => fxBoxes.some(B => inBox(B, (ax + bx) / 2, (ay + by) / 2, 0.2 * ppf));
    pieces(dark, W, H, (comp, ax, ay, bx, by) => {
      const big = Math.max(bx - ax, by - ay) + 1;
      if(comp.some(p => protect[p]) || (big >= 0.5 * ppf && onFixture(ax, ay, bx, by))) return;
      // (the stairs' own marks are not type: the break line stays; step numbers go by the read's drop list)
      if(stairsB && big >= 1.2 * ppf && inBox(stairsB, (ax + bx) / 2, (ay + by) / 2, 2.5 * ppf)) return;
      // (the up-the-page window runs the room's length: a fixture in it (a toilet, a tub) closes a real shape and stays)
      const inWin = wins.some(w => ax >= w.x && bx <= w.r && ay >= w.y && by <= w.z && (!w.v || !closes(comp, ax, ay, bx, by, (0.45 * ppf) ** 2)));
      // anywhere in a room, a piece up to 2.6 ft that closes no shape and is mostly air is type too (a listing that
      // prints its names turned, Marshall's: "RA", the lift's "STOR/FUTURE LIFT", a ceiling height; a bold letter's
      // counter is under half a foot, a toilet's bowl is more)
      if(big < 2.6 * ppf && comp.length < 0.55 * (bx - ax + 1) * (by - ay + 1) && inRoomBox(ax, ay, bx, by) && !closes(comp, ax, ay, bx, by, (0.5 * ppf) ** 2) && !furniture(comp, ax, ay, bx, by)){ for(const p of comp) dark[p] = 0; return; }
      // a whole printed name run together (bold capitals on a gray-filled room touch, Beulah's "PRIMARY BEDROOM"): one line
      // of type tall, at the room's label, standing apart from the walls
      const text = !furniture(comp, ax, ay, bx, by) && (big < 1.1 * ppf || (big < 2.6 * ppf && inWin) || (inWin && Math.min(bx - ax, by - ay) + 1 < 0.9 * ppf && big < 7 * ppf));
      if(text) for(const p of comp) dark[p] = 0;
    });
    // text that touches a line (a size printed against a wall, a name across a counter): in each room, the ink off the
    // long straight runs (walls, counters, a tub) falls into pieces. A piece no taller than a line of type is a word, and
    // goes; a curve or a diagonal (a door swing, a shower's X, an angled wall) is taller, and stays.
    { const [hr, vr] = runs(true), keepRun = 1.2 * ppf, short = new Uint8Array(N), inRooms = new Uint8Array(N);
      // a piece standing free that closes a shape with half a foot of paper or more inside (a console, a table, a bench)
      // is furniture, kept whole (Westheimer's dining area lost a console's short sides here, 10/27); a letter's counter
      // is smaller
      const shape = new Uint8Array(N);
      pieces(dark, W, H, (comp, ax, ay, bx, by) => { const big = Math.max(bx - ax, by - ay) + 1;
        if(big >= 1 * ppf && big < 6 * ppf && closes(comp, ax, ay, bx, by, (0.5 * ppf) ** 2)) for(const p of comp) shape[p] = 1; });
      for(let i = 0; i < N; i++) if(dark[i] && !protect[i] && !shape[i] && hr[i] < keepRun && vr[i] < keepRun) short[i] = 1;
      // in every room (a listing's label is often printed away from where the read puts it, and turned)
      rbs.forEach(B => {
        const xa = Math.max(0, Math.ceil(B.x)), xb = Math.min(W, Math.floor(B.r)), ya = Math.max(0, Math.ceil(B.y)), yb = Math.min(H, Math.floor(B.z));
        for(let y = ya; y < yb; y++) inRooms.fill(1, y * W + xa, y * W + Math.max(xa, xb)); });
      pieces(short, W, H, (comp, ax, ay, bx, by) => {
        if(Math.min(bx - ax, by - ay) + 1 >= 0.9 * ppf || (Math.max(bx - ax, by - ay) + 1 >= 0.5 * ppf && onFixture(ax, ay, bx, by))) return;
        if(stairsB && Math.max(bx - ax, by - ay) + 1 >= 0.9 * ppf && inBox(stairsB, (ax + bx) / 2, (ay + by) / 2, 2.5 * ppf) && comp.length < 0.25 * (bx - ax + 1) * (by - ay + 1)) return;   // (a stair's break line: a thin slant, never a word's dense block)
        for(const p of comp) if(inRooms[p]) dark[p] = 0;
      });
    }
    // a wall a printed label covered: the listing knocked the wall out under its text, and a gap under a label is not a
    // doorway (the owner 10/28, Stoney Brook's walk-in closet). Where text was taken out between the ends of one straight wall
    // (each end a run of a foot or more pointing at the gap), the wall is drawn through.
    { const gone = new Uint8Array(N); for(let i = 0; i < N; i++) if(before[i] && !dark[i]) gone[i] = 1;
      const [hr, vr] = runs(), ft1 = ppf, max = 3.5 * ppf; let bridged = 0;
      const fill = [];
      for(let y = 0; y < H; y++){ let last = -1;
        for(let x = 0; x < W; x++){ const i = y * W + x; if(!dark[i]) continue;
          if(last >= 0 && x - last > 1 && x - last <= max && hr[y * W + last] >= ft1 && hr[i] >= ft1){
            let g = 0; for(let u = last + 1; u < x; u++) g += gone[y * W + u];
            if(g >= 0.3 * (x - last - 1)) fill.push([last + 1, x, y, 0]); }
          last = x; } }
      for(let x = 0; x < W; x++){ let last = -1;
        for(let y = 0; y < H; y++){ const i = y * W + x; if(!dark[i]) continue;
          if(last >= 0 && y - last > 1 && y - last <= max && vr[last * W + x] >= ft1 && vr[i] >= ft1){
            let g = 0; for(let v = last + 1; v < y; v++) g += gone[v * W + x];
            if(g >= 0.3 * (y - last - 1)) fill.push([last + 1, y, x, 1]); }
          last = y; } }
      for(const [a, z, c, vert] of fill){ for(let u = a; u < z; u++) dark[vert ? u * W + c : c * W + u] = 1; bridged++; }
      if(bridged) issues.push({kind: 'plan-wall-under-label-closed', lines: bridged});
    }
    const walls = dark;
    // ceiling detail: the lines a shaded ceiling band framed (Marshall's kitchen coffers, the X over the primary suite)
    // are left standing alone in the room when the band goes. A piece that touched the band and touches no wall: out.
    if(shading.some(v => v)){
      const sh = dilate(shading, W, H, Math.max(2, Math.round(0.3 * ppf))); let main = 0, net2 = new Uint8Array(N);
      pieces(walls, W, H, comp => { main = Math.max(main, comp.length); });
      pieces(walls, W, H, comp => { if(comp.length >= main * 0.999) for(const p of comp) net2[p] = 1; });
      net2 = dilate(net2, W, H, Math.max(1, Math.round(0.3 * ppf)));
      let ceil = 0;
      // all of it goes, straight lines and the X alike (the owner 10/28: no ceiling details); an island drawn on the same lines
      // comes back as our own fixture from the read
      // (a fireplace's hatching is part of the walls, never a piece standing alone; the X's crossings look like hatching)
      pieces(walls, W, H, comp => {
        if(comp.length >= main * 0.999 || !comp.some(p => sh[p]) || comp.some(p => net2[p])) return;
        for(const p of comp){ walls[p] = 0; ceilGone[p] = WHY.ceiling; } ceil++; });
      if(ceil) issues.push({kind: 'plan-ceiling-detail-removed', pieces: ceil});
    }
    // our own fixtures (the owner 10/28): the read lists the kitchen's counters, range, sink and island and each bath's
    // toilet, tub, shower and vanity (and a curved stair) at their real size and place; the builder's linework under each
    // goes, and the template draws the standard symbols. Its wall side keeps the wall. The read's drop list (a builder line
    // through open space, a stub, a bad door swing, roof outlines, closet rods, stair numbers) goes too.
    const fx = (L.fixtures || []).map(q => Object.assign({}, q, q.box ? {B: T(P(q.box))} : {}));
    // (a wall is never erased: ink a wall's thickness through, and the outer walls' line, stay; a shower box drawn to the
    // outside wall took Beulah's primary bath outdoors, 10/28)
    // (a box from the read is only roughly where the fixture is: only ink pieces that lie inside the box go, whole; a piece
    // that runs on out of it (a wall, the stairs' treads and stringers, a door's swing, a counter run on to a wall) is the
    // listing's and stays. the owner 10/28: the first version cleared everything in each box, and boxes read a little off took
    // Aston Pine's stairs and garage door and part of Second Suite's wall.) Our symbol is drawn only where the listing's
    // own drawing of it went (or where the listing drew none), so a fixture is never drawn twice.
    { const pid = new Int32Array(N), psz = [0]; let np = 0;
      pieces(walls, W, H, comp => { np++; psz.push(comp.length); for(const p of comp) pid[p] = np; });
      const take = (B, g, why, wallsToo) => { const a = Math.max(0, Math.floor(B.x - g)), bb = Math.min(W, Math.ceil(B.r + g)), t = Math.max(0, Math.floor(B.y - g)), z = Math.min(H, Math.ceil(B.z + g));
        const cnt = new Map(), hasCore = new Set(); let ink = 0;
        for(let y = t; y < z; y++) for(let x = a; x < bb; x++){ const i = y * W + x; if(!walls[i]) continue; cnt.set(pid[i], (cnt.get(pid[i]) || 0) + 1); if(core[i]) hasCore.add(pid[i]);
          if(x >= B.x && x <= B.r && y >= B.y && y <= B.z) ink++; }
        const go = new Set([...cnt].filter(([id, c]) => c >= 0.9 * psz[id] && (wallsToo || !hasCore.has(id) || psz[id] < 0.5 * ppf * ppf)).map(([id]) => id));
        let gone = 0;
        for(let y = Math.ceil(B.y); y < B.z; y++) for(let x = Math.ceil(B.x); x < B.r; x++){ const i = y * W + x; if(walls[i] && go.has(pid[i])) gone++; }
        const cut = () => { if(go.size) for(let y = t; y < z; y++) for(let x = a; x < bb; x++){ const i = y * W + x; if(walls[i] && go.has(pid[i])){ walls[i] = 0; ceilGone[i] = why; } } };
        return {ink, gone, cut}; };
      const pad = 0.25 * ppf;
      for(const q of fx){
        if(q.type === 'stairs-curved' && q.center){
          const c = T(P({left: q.center.x, right: q.center.x, top: q.center.y, bottom: q.center.y})), r0 = q.r0 * b.w * k, r1 = q.r1 * b.w * k;
          q.cx_ = c.x; q.cy_ = c.y; q.r0_ = r0; q.r1_ = r1;
          const a0 = q.a0 * Math.PI / 180, a1 = q.a1 * Math.PI / 180, lo = Math.min(a0, a1) - 0.1, hi = Math.max(a0, a1) + 0.1;
          for(let y = Math.max(0, Math.floor(c.y - r1)); y < Math.min(H, c.y + r1); y++) for(let x = Math.max(0, Math.floor(c.x - r1)); x < Math.min(W, c.x + r1); x++){
            const dx = x - c.x, dy = y - c.y, rr = Math.hypot(dx, dy); let an = Math.atan2(dy, dx); while(an < lo) an += 2 * Math.PI; while(an > hi + 2 * Math.PI) an -= 2 * Math.PI;
            if(rr > r0 - 0.3 * ppf && rr < r1 - 0.2 * ppf && an >= lo && an <= hi){ const i = y * W + x; if(walls[i]){ walls[i] = 0; ceilGone[i] = WHY.stairs; } } }
          continue; }
        if(!q.B) continue;
        if(q.type === 'door') continue;   // (doors below)
        if(q.type === 'drop'){ take(q.B, 0.25 * ppf, WHY.drop, true).cut(); continue; }
        const r = take(q.B, pad, WHY.fixture, false);
        // drawn when the listing's own drawing of it went, or it drew almost nothing there
        q.draw = r.gone >= 0.5 * r.ink || r.ink < 0.02 * (q.B.r - q.B.x) * (q.B.z - q.B.y);
        if(q.draw) r.cut();
      }
    }
    // doors (the owner 10/28: every door a clean, proper swing; a door opening takes the color of the room it opens into). The
    // read gives each hinged door's hinge, the other jamb and a point on its swing. Each end snaps to the wall ink within
    // half a foot; a door 1 to 4 ft wide (a leaf of a double door is narrow) is redrawn: the listing's swing (the thin ink in its quarter circle) goes and
    // the template draws ours. Anything else keeps the listing's drawing.
    const doors = [];
    { const snap = (x, y) => { const R = Math.round(0.5 * ppf); let best = null, bd = 1e9;
        for(let v = -R; v <= R; v++) for(let u = -R; u <= R; u++){ const X = Math.round(x + u), Y = Math.round(y + v); if(X < 0 || Y < 0 || X >= W || Y >= H || !walls[Y * W + X]) continue;
          const d2 = u * u + v * v; if(d2 < bd){ bd = d2; best = [X, Y]; } }
        return best; };
      const pt = q => { const e = T(P({left: q.x, right: q.x, top: q.y, bottom: q.y})); return [e.x, e.y]; };
      for(const q of fx){ if(q.type !== 'door' || !q.hinge || !q.latch || !q.into) continue;
        const h0 = pt(q.hinge), l0 = pt(q.latch), i0 = pt(q.into), h = snap(...h0) || h0, l = snap(...l0) || l0;
        const w = Math.hypot(l[0] - h[0], l[1] - h[1]);
        if(w < 1 * ppf || w > 4 * ppf){ issues.push({kind: 'plan-door-kept', why: 'width', ft: +(w / ppf).toFixed(1)}); continue; }
        const ux = (l[0] - h[0]) / w, uy = (l[1] - h[1]) / w, side = Math.sign((i0[0] - h[0]) * uy - (i0[1] - h[1]) * ux) || 1;
        const nx = -uy * -side, ny = ux * -side;   // the leaf, open: from the hinge into the room
        // (the swing side: the into point's side of the opening)
        const sx = (i0[0] - h[0]) * nx + (i0[1] - h[1]) * ny >= 0 ? 1 : -1, px = nx * sx, py = ny * sx;
        const R = w * 1.12 + 2, eps = 0.06 * ppf;
        for(let y = Math.max(0, Math.floor(h[1] - R)); y < Math.min(H, h[1] + R); y++) for(let x = Math.max(0, Math.floor(h[0] - R)); x < Math.min(W, h[0] + R); x++){
          const i = y * W + x; if(!walls[i] || core[i]) continue;
          const dx = x - h[0], dy = y - h[1], a = dx * ux + dy * uy, b2 = dx * px + dy * py;
          if(Math.hypot(dx, dy) <= R && a >= -eps && b2 >= eps){ walls[i] = 0; ceilGone[i] = WHY.door; } }
        doors.push({h, l, p: [px, py], w, into: i0});
      }
      // bits the old swing held together (a door stop, letters that touched its arc: Beulah's "TH"), now loose: out. Pieces
      // under 1.2 ft within the door's reach that touch no wall.
      if(doors.length){ let big = new Uint8Array(N); pieces(walls, W, H, (comp, ax, ay, bx, by) => { if(Math.max(bx - ax, by - ay) + 1 >= 3 * ppf) for(const p of comp) big[p] = 1; });
        big = dilate(big, W, H, Math.max(1, Math.round(0.15 * ppf)));
        pieces(walls, W, H, (comp, ax, ay, bx, by) => { if(Math.max(bx - ax, by - ay) + 1 >= 1.2 * ppf || comp.some(p => big[p] || protect[p])) return;
          const cx2 = (ax + bx) / 2, cy2 = (ay + by) / 2;
          if(!doors.some(dr => Math.hypot(cx2 - dr.h[0], cy2 - dr.h[1]) <= dr.w * 1.25 + 0.5 * ppf)) return;
          if(closes(comp, ax, ay, bx, by) || fx.some(q => q.B && q.type !== 'drop' && q.type !== 'door' && inBox(q.B, (ax + bx) / 2, (ay + by) / 2, 0.3 * ppf))) return;   // (a fixture, never: Beulah's toilet)
          for(const p of comp){ walls[p] = 0; ceilGone[p] = WHY.door; } }); }
    }
    // no wall between open living spaces unless it's a real wall (the owner 10/28): a hairline along the shared edge of two
    // open living rooms the read marked open (Aston Pine's kitchen and breakfast) is a builder's line, and goes
    { const [hr, vr] = runs(), thin = 0.22 * ppf, op = L.rooms.filter(r => r.open && ZONE(r.name, r.kind) === 'living').map(r => T(P(r.box)));
      // (never a fixture's own edge: a counter run along the line between kitchen and dining stays)
      const fxIn = (x, y) => fx.some(q => q.B && q.type !== 'drop' && q.type !== 'door' && x >= q.B.x - 0.3 * ppf && x <= q.B.r + 0.3 * ppf && y >= q.B.y - 0.3 * ppf && y <= q.B.z + 0.3 * ppf);
      for(let i = 0; i < op.length; i++) for(let j = i + 1; j < op.length; j++){
        const p = op[i], q = op[j], g = 1 * ppf;
        const ovY = [Math.max(p.y, q.y) + ppf, Math.min(p.z, q.z) - ppf], ovX = [Math.max(p.x, q.x) + ppf, Math.min(p.r, q.r) - ppf];
        const edges = [];
        if(Math.abs(p.r - q.x) < g || Math.abs(q.r - p.x) < g){ const xm = Math.abs(p.r - q.x) < g ? (p.r + q.x) / 2 : (q.r + p.x) / 2; if(ovY[1] - ovY[0] > 2 * ppf) edges.push([xm, 1]); }
        if(Math.abs(p.z - q.y) < g || Math.abs(q.z - p.y) < g){ const ym = Math.abs(p.z - q.y) < g ? (p.z + q.y) / 2 : (q.z + p.y) / 2; if(ovX[1] - ovX[0] > 2 * ppf) edges.push([ym, 0]); }
        for(const [m, vert] of edges){
          const [lo, hi] = vert ? ovY : ovX, w0 = Math.round(m - 0.6 * ppf), w1 = Math.round(m + 0.6 * ppf);
          for(let u = Math.ceil(lo); u < hi; u++) for(let v = w0; v <= w1; v++){
            const x = vert ? v : u, y = vert ? u : v; if(x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x;
            if(walls[i] && (vert ? hr[i] <= thin && vr[i] >= 2 * ppf : vr[i] <= thin && hr[i] >= 2 * ppf) && !fxIn(x, y)){ walls[i] = 0; ceilGone[i] = WHY.openLine; } } }
      }
    }
    // closet rods: straight hairlines inside a closet, off its walls (the owner 10/28: rooms, door swings, fixtures, labels only)
    { const [hr, vr] = runs(), thin = 0.15 * ppf, off = 0.45 * ppf;
      for(const r of L.rooms){ if(!/closet|wardrobe|\bw\.?i\.?c\b|pantry/i.test(r.name)) continue; const B = T(P(r.box));
        for(let y = Math.ceil(B.y + off); y < B.z - off; y++) for(let x = Math.ceil(B.x + off); x < B.r - off; x++){ const i = y * W + x;
          if(walls[i] && ((hr[i] >= ppf && vr[i] <= thin) || (vr[i] >= ppf && hr[i] <= thin))){ walls[i] = 0; ceilGone[i] = WHY.rods; } } }
    }
    // stray pieces: a line piece standing alone in a room, touching no wall, closing no shape (an island, a tub and a table
    // close a shape; a column is solid): the leftover of a table or a label's underline (Westheimer's dining area). Out.
    { let net = new Uint8Array(N);
      pieces(walls, W, H, (comp, ax, ay, bx, by) => { if(Math.max(bx - ax, by - ay) + 1 >= 6 * ppf) for(const p of comp) net[p] = 1; });
      net = dilate(net, W, H, Math.max(1, Math.round(0.4 * ppf)));
      let gone = 0;
      pieces(walls, W, H, (comp, ax, ay, bx, by) => {
        const bw = bx - ax + 1, bh = by - ay + 1;
        if(Math.max(bw, bh) >= 6 * ppf || comp.some(p => net[p] || protect[p])) return;
        // (the stairs' own marks stay, the break line among them, even when taking out the step numbers left it standing
        // alone: Aston Pine, 10/28)
        if(inBox(stairsB, (ax + bx) / 2, (ay + by) / 2, 2.5 * ppf) && Math.max(bw, bh) >= 1.2 * ppf) return;
        // solid: a column, a post, a short support wall, at any angle: ink a wall's thickness through and a foot or more
        // long (Stoney Brook's diagonal dining-room post fills under half its box and was dropped here, 10/28); a letter's
        // bar is thinner
        // a thin straight bar standing alone in a room, under 2.6 ft, square to the page, is what's left of the listing's bold
        // type (Beulah's bedrooms, 10/28); a post or a support wall is thicker, or at an angle (Stoney Brook's), and stays
        if(Math.min(bw, bh) < 0.4 * ppf && Math.max(bw, bh) < 2.6 * ppf && inRoomBox(ax, ay, bx, by)){ for(const p of comp) walls[p] = 0; gone++; return; }
        if(postLike(comp)) return;
        if(closes(comp, ax, ay, bx, by)) return;
        for(const p of comp) walls[p] = 0; gone++;
      });
      if(gone) issues.push({kind: 'plan-stray-ink-removed', pieces: gone});
    }
    // a fixture the passes took out whole: a shape in the listing closing half a foot or more of paper (a table, a
    // console, an island, a tub) with less than half of it left (the check Westheimer's dining area would have failed, 10/27)
    pieces(before, W, H, (comp, ax, ay, bx, by) => {
      const big = Math.max(bx - ax, by - ay) + 1;
      if(big < 1.2 * ppf || big >= 6 * ppf || !closes(comp, ax, ay, bx, by, (0.5 * ppf) ** 2)) return;   // (type is smaller, its counters too)
      let kept = 0; for(const p of comp) if(walls[p] || ceilGone[p]) kept++;
      if(kept < 0.5 * comp.length) issues.push({kind: 'plan-fixture-lost', at: [+((ax + bx) / 2 / W).toFixed(3), +((ay + by) / 2 / H).toFixed(3)], ft: +(big / ppf).toFixed(1)});
    });
    // a long line that lost much of itself to the text passes: a half-drawn room (Beulah's kitchen, 10/27)
    pieces(before, W, H, (comp, ax, ay, bx, by) => {
      if(Math.max(bx - ax, by - ay) + 1 < 3 * ppf) return;
      let kept = 0; for(const p of comp) if(walls[p] || ceilGone[p]) kept++;   // (ceiling detail went on purpose)
      // a printed name taken out whole is not a lost line
      if(!kept && Math.min(bx - ax, by - ay) + 1 < 0.9 * ppf && wins.some(w => ax >= w.x && bx <= w.r && ay >= w.y && by <= w.z)) return;
      if(kept < 0.6 * comp.length) issues.push({kind: 'plan-line-lost', at: [+((ax + bx) / 2 / W).toFixed(3), +((ay + by) / 2 / H).toFixed(3)], kept: +(kept / comp.length).toFixed(2)});
    });
    // last sweep: what the passes above cut loose (the ends of a removed X, a letter split off a line): a dot under half
    // a foot, or a mostly-air bit under a foot. A post or column is a solid foot or more.
    pieces(walls, W, H, (comp, ax, ay, bx, by) => { const big = Math.max(bx - ax, by - ay) + 1;
      if(big < 0.5 * ppf || (big < 1.1 * ppf && comp.length < 0.6 * (bx - ax + 1) * (by - ay + 1) && !comp.some(p => protect[p]))) { for(const p of comp) walls[p] = 0; return; }
      // a solid scrap under 1.2 ft standing alone in a room is what's left of bold type (Beulah's primary bedroom); a post,
      // a support wall is larger (Stoney Brook's dining room, about 1.7 ft)
      if(big < 1.2 * ppf && inRoomBox(ax, ay, bx, by) && !comp.some(p => protect[p])) for(const p of comp) walls[p] = 0; });
    // rooms are split by walls, not by a ceiling grid's lines
    const solid = walls.map((v, i) => v && !soft[i] ? 1 : 0), rD = Math.max(1, Math.round(0.15 * ppf));
    // color stops at a door (the owner 10/27): each redrawn door's threshold, hinge to the other jamb, closes the doorway for the
    // fill (not drawn; the opening takes the color of the room the door swings into, below). The listing's own swing used to
    // do this; taking it out let a hall's color into Westheimer's primary-suite entry, 10/28.
    for(const dr of doors){ const [hx, hy] = dr.h, ux = (dr.l[0] - hx) / dr.w, uy = (dr.l[1] - hy) / dr.w;
      for(let t2 = -1; t2 <= dr.w + 1; t2 += 0.5){ const X = Math.round(hx + ux * t2), Y = Math.round(hy + uy * t2); if(X >= 0 && Y >= 0 && X < W && Y < H) solid[Y * W + X] = 1; } }
    const blocked = dilate(solid, W, H, rD);
    // inside the house: everything the outdoors can't reach with the door and window gaps closed (up to 6 ft: a double
    // front door, a wide slider; Stoney Brook's front door let the outdoors in at 3 ft), so the
    // color follows angled walls and bays to the wall itself. If the walls leak (a plan drawn with open corners), the
    // older test: per row and column, the outermost wall near the outline's edge.
    const insideOf = () => { let inside = new Uint8Array(N);
      const rc = Math.max(2, Math.round(3.2 * ppf)), pw = rc + 2, WP = W + 2 * pw, HP = H + 2 * pw, NP = WP * HP;
      // on a copy with paper added around it, so the outdoors starts beyond the gap closing everywhere
      // a door swing drawn outside every room (French doors opening onto a balcony) is not a wall to the outdoors: its
      // curve would close off a pocket of yard that then takes the room's color (Westheimer's bedrooms)
      const [hr, vr] = runs(), cv = 0.3 * ppf, rbx = L.rooms.filter(r => r.kind !== 'outdoor').map(r => T(P(r.box)));
      const wp = new Uint8Array(NP); for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const i = y * W + x;
        if(!walls[i] || !keep[i]) continue;
        if(hr[i] < cv && vr[i] < cv && !rbx.some(e => x >= e.x && x <= e.r && y >= e.y && y <= e.z)) continue;
        wp[(y + pw) * WP + x + pw] = 1; }
      const shut = dilate(wp, WP, HP, rc), op = new Uint8Array(NP), st = [];
      for(let i = 0; i < NP; i++){ const x = i % WP, y = (i - x) / WP; if(!shut[i] && (x === 0 || y === 0 || x === WP - 1 || y === HP - 1)){ op[i] = 1; st.push(i); } }
      while(st.length){ const p = st.pop(), x = p % WP; for(const q of [x > 0 ? p - 1 : -1, x < WP - 1 ? p + 1 : -1, p - WP, p + WP]) if(q >= 0 && q < NP && !op[q] && !shut[q]){ op[q] = 1; st.push(q); } }
      const fp = dilate(op, WP, HP, rc), out = new Uint8Array(N), far = new Uint8Array(N);
      for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const j = (y + pw) * WP + x + pw; out[y * W + x] = op[j]; far[y * W + x] = fp[j]; }
      let n = 0;
      // never past the outer walls' box (half a foot of give): a door swing drawn outside closes off a pocket of yard
      const ox0 = O.x - 0.5 * ppf, ox1 = O.r + 0.5 * ppf, oy0 = O.y - 0.5 * ppf, oy1 = O.z + 0.5 * ppf;
      for(let i = 0; i < N; i++){ const x = i % W, y = (i - x) / W; if(keep[i] && !far[i] && x >= ox0 && x <= ox1 && y >= oy0 && y <= oy1){ inside[i] = 1; n++; } }
      // a notch in the outer wall (a recess beside a bay, a jog wider than a door): the outdoors reaches it with only the
      // narrow gaps closed (windows, a window bay's corners), and it is small next to the house. A door the outdoors gets
      // through that way leaks into the whole house, which is not small, so the house stays inside.
      const r2 = Math.max(1, Math.round(0.9 * ppf)), shut2 = dilate(walls, W, H, r2), out2 = new Uint8Array(N); st.length = 0;
      for(let i = 0; i < N; i++){ const x = i % W, y = (i - x) / W; if(!shut2[i] && (out[i] || !keep[i] || x === 0 || y === 0 || x === W - 1 || y === H - 1)){ out2[i] = 1; st.push(i); } }
      while(st.length){ const p = st.pop(), x = p % W; for(const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if(q >= 0 && q < N && !out2[q] && !shut2[q]){ out2[q] = 1; st.push(q); } }
      const leak = new Uint8Array(N); for(let i = 0; i < N; i++) if(inside[i] && out2[i]) leak[i] = 1;
      // (a room with a wide window opening is reached too, but its label is in it: it stays)
      const labelAt = new Set(L.rooms.map(r => Math.round((b.y + r.label.y * b.h - y0) * k) * W + Math.round((b.x + r.label.x * b.w - x0) * k)));
      const notch = new Uint8Array(N); pieces(leak, W, H, comp => { if(comp.length < 0.1 * n && !comp.some(p => labelAt.has(p))) for(const p of comp) notch[p] = 1; });
      // out to its walls (the gap the closing left), never across a wall into a room
      const g = dilate(notch, W, H, r2); st.length = 0; for(let i = 0; i < N; i++) if(notch[i]){ inside[i] = 0; st.push(i); }
      while(st.length){ const p = st.pop(), x = p % W; for(const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if(q >= 0 && q < N && g[q] && inside[q] && !walls[q]){ inside[q] = 0; st.push(q); } }
      if(n < 0.5 * (O.r - O.x) * (O.z - O.y)) inside = edgeInside(walls, W, H, O, ppf);
      return inside;
    };
    let inside = insideOf();
    // a roof drawn against the house closes a pocket of its own: no room in it, and the rooms reach it only through the thick
    // outer wall, never across a thin line or through an opening. It's outside (Aston Pine's porch roof, 10/28).
    const roofPockets = () => { const fl = new Uint8Array(N); for(let i = 0; i < N; i++) if(inside[i] && !walls[i]) fl[i] = 1;
      const labelAt = new Set(L.rooms.map(r => Math.round((b.y + r.label.y * b.h - y0) * k) * W + Math.round((b.x + r.label.x * b.w - x0) * k)));
      const reachR = Math.round(0.6 * ppf); let n = 0;
      const rbm = new Uint8Array(N); L.rooms.forEach(r => { const B = T(P(r.box)); for(let y = Math.max(0, Math.floor(B.y)); y < Math.min(H, B.z); y++) rbm.fill(1, y * W + Math.max(0, Math.floor(B.x)), y * W + Math.min(W, Math.ceil(B.r))); });
      pieces(fl, W, H, (comp, ax, ay, bx, by) => {
        if(comp.length > 150 * ppf * ppf || comp.some(p => labelAt.has(p))) return;
        const cxp = (ax + bx) / 2, cyp = (ay + by) / 2;
        if(L.rooms.some(r => { const B = T(P(r.box)); return inBox(B, cxp, cyp, 0); }) || inBox(stairsB, cxp, cyp, 0)) return;
        // walk out from it through floor and thin ink only, up to 0.6 ft: does it meet other floor?
        const own = new Set(comp), seen = new Map(), q = []; for(const p of comp){ seen.set(p, 0); q.push(p); }
        let hit = false;
        for(let h = 0; h < q.length && !hit; h++){ const p = q[h], d = seen.get(p), x = p % W;
          for(const n2 of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]){ if(n2 < 0 || n2 >= N || seen.has(n2) || d + 1 > reachR) continue;
            if(walls[n2] && core[n2]) continue; seen.set(n2, d + 1); if(fl[n2] && !own.has(n2) && rbm[n2]){ hit = true; break; } q.push(n2); } }
        if(!hit){ for(const p of comp) inside[p] = 0; n++; } });
      return n; };
    if(roofPockets()) issues.push({kind: 'plan-roof-pocket-outside'});
    const outs = outside.map(T), held = (x, y) => outs.some(e => x >= e.x && x <= e.r && y >= e.y && y <= e.z);
    // marks outside the walls that aren't a porch, patio or garage, or in no room at all: the listing's floor title
    // ("2nd Floor", even in the notch of an L-shaped floor), a north arrow. Walls join into pieces far larger than 6 ft.
    const boxes = L.rooms.map(r => T(P(r.box))), pb = 0.5 * ppf, inRoom = (x, y) => boxes.some(e => x >= e.x - pb && x <= e.r + pb && y >= e.y - pb && y <= e.z + pb);
    let gone2 = 0;
    pieces(walls, W, H, (comp, ax, ay, bx, by) => {
      if(Math.max(bx - ax, by - ay) >= 6 * ppf) return;
      let inn = 0, room = 0;
      for(const p of comp){ const x = p % W, y = (p - x) / W; if(inside[p] || held(x, y)) inn = 1; if(!room && inRoom(x, y)) room = 1; if(inn && room) return; }
      for(const p of comp) walls[p] = 0; gone2 = 1;
    });
    if(gone2){ inside = insideOf(); roofPockets(); }   // a floor title's letters closed in a patch of paper outside the walls (Stoney Brook)
    // open floor, split by the walls (4-connected; a door opening joins rooms, the room boxes keep each color in its room)
    const region = new Uint8Array(N); for(let i = 0; i < N; i++){ const x = i % W; if(inside[i] || held(x, (i - x) / W)) region[i] = 1; }
    const free = new Int32Array(N), stack = new Int32Array(N); let nid = 0;
    for(let s = 0; s < N; s++){
      if(blocked[s] || free[s] || !region[s]) continue;
      nid++; let top = 0; stack[top++] = s; free[s] = nid;
      while(top){ const p = stack[--top], x = p % W;
        for(const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if(q >= 0 && q < N && !blocked[q] && !free[q] && region[q]){ free[q] = nid; stack[top++] = q; } }
    }
    // a small pocket closed off outside the rooms (between a door swing drawn outdoors and the wall, Westheimer's
    // bedrooms): under 20 sq ft and mostly in no room the read found. Outside.
    { const cnt = new Int32Array(nid + 1), inb = new Int32Array(nid + 1), rbx = L.rooms.map(r => T(P(r.box)));
      for(let i = 0; i < N; i++){ const f = free[i]; if(!f) continue; cnt[f]++; const x = i % W, y = (i - x) / W; if(rbx.some(e => x >= e.x && x <= e.r && y >= e.y && y <= e.z)) inb[f]++; }
      const gone = new Uint8Array(nid + 1); for(let f = 1; f <= nid; f++) if(cnt[f] < 20 * ppf * ppf && inb[f] < 0.3 * cnt[f]) gone[f] = 1;
      for(let i = 0; i < N; i++) if(gone[free[i]]){ free[i] = 0; inside[i] = 0; } }
    const at = (x, y) => free[Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))];
    // the open floor nearest a room's label inside its box (a label printed over a counter or a door swing)
    const seedOf = (r, lx, ly) => { const B = r.B; let s = at(lx, ly); if(s) return s;
      const st = Math.max(1, Math.round(0.2 * ppf));
      for(let rad = st; rad <= 2 * ppf; rad += st) for(let a = 0; a < 16; a++){ const x = lx + rad * Math.cos(a * Math.PI / 8), y = ly + rad * Math.sin(a * Math.PI / 8);
        if(x >= B.x && x <= B.r && y >= B.y && y <= B.z && (s = at(x, y))) return s; }
      return at((B.x + B.r) / 2, (B.y + B.z) / 2); };
    // each room: the open floor its label sits in, inside its box, grown back to the walls; larger rooms first, so a room
    // inside another's box keeps its own color. Closets, pantries and W/D spots aren't filled here: they take the color of
    // the room they open into below.
    const zone = new Uint8Array(N), owner = new Int16Array(N).fill(-1);
    const rooms = L.rooms.map((r, i) => { const B = T(P(r.box)), ft = {w: (B.r - B.x) / ppf, d: (B.z - B.y) / ppf};
      return Object.assign({}, r, {i, B, ft, zone: ZONE(r.name, r.kind, ft), lx: (b.x + r.label.x * b.w - x0) * k, ly: (b.y + r.label.y * b.h - y0) * k}); });
    const own = rooms.map(() => null);   // each room's own floor (its box, the open floor at its label), for its label
    // rooms that share open floor through a doorway split at the doorway, not at a box's edge (the owner 10/27: shading stops at
    // a door; 10/28, Stoney Brook's angled bath spilled into the foyer): each pixel goes to the room whose label it is
    // nearest walking through the open floor
    const near2 = new Int16Array(N).fill(-1); let cellOf = null;
    { const q = new Int32Array(N); let h = 0, t = 0;
      // (with the door gaps closed (up to about 3 ft) the floor falls into rooms: a piece holding one room's label is that
      // room's from the start; a piece holding several (an open plan) starts from each label; the rest is walked out to)
      const shutD = dilate(solid, W, H, Math.max(2, Math.round(1.5 * ppf))), cell = new Int32Array(N); let nc = 0; cellOf = cell;
      for(let s0 = 0; s0 < N; s0++){ if(shutD[s0] || cell[s0] || !free[s0]) continue; nc++; const st = [s0]; cell[s0] = nc;
        while(st.length){ const p = st.pop(), x = p % W; for(const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if(n >= 0 && n < N && !shutD[n] && !cell[n] && free[n]){ cell[n] = nc; st.push(n); } } }
      const at2 = (x, y) => { const X = Math.round(Math.min(W - 1, Math.max(0, x))), Y = Math.round(Math.min(H - 1, Math.max(0, y))); return Y * W + X; };
      const who = new Map(); rooms.forEach(r => { if(r.zone === 'void' || r.zone === 'inherit') return; const c = cell[at2(r.lx, r.ly)]; if(c) who.set(c, (who.get(c) || []).concat([r.i])); });
      // each room starts from the inner part of its own box, where that floor is in the same closed-off piece as its label
      // (a box's corner past an angled wall is the next room's); smaller rooms first, so a room inside another's box keeps its floor
      rooms.slice().sort((p, q2) => (p.B.r - p.B.x) * (p.B.z - p.B.y) - (q2.B.r - q2.B.x) * (q2.B.z - q2.B.y)).forEach(r => {
        if(r.zone === 'void' || r.zone === 'inherit') return; const sd = seedOf(r, r.lx, r.ly); if(!sd) return;
        const c0 = cell[at2(r.lx, r.ly)], B = r.B, m = Math.min(ppf, 0.25 * (B.r - B.x), 0.25 * (B.z - B.y));
        for(let y = Math.ceil(B.y + m); y < B.z - m; y++) for(let x = Math.ceil(B.x + m); x < B.r - m; x++){ const p = y * W + x;
          if(free[p] === sd && near2[p] < 0 && (!c0 || cell[p] === c0 || !cell[p])){ near2[p] = r.i; q[t++] = p; } } });
      while(h < t){ const p = q[h++], x = p % W; for(const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if(n >= 0 && n < N && free[n] && near2[n] < 0){ near2[n] = near2[p]; q[t++] = n; } } }
    rooms.slice().sort((p, q) => (q.B.r - q.B.x) * (q.B.z - q.B.y) - (p.B.r - p.B.x) * (p.B.z - p.B.y)).forEach(r => {
      const pd = 0.4 * ppf, B = r.B;
      const a = Math.max(0, Math.floor(B.x - pd)), bb = Math.min(W, Math.ceil(B.r + pd)), t = Math.max(0, Math.floor(B.y - pd)), z = Math.min(H, Math.ceil(B.z + pd));
      if(bb <= a || z <= t) return;
      const seed = seedOf(r, r.lx, r.ly);
      if(!seed) return;
      const out = r.zone === 'outdoor' || r.zone === 'garage', w = bb - a, h = z - t, m = new Uint8Array(w * h);
      for(let y = t; y < z; y++) for(let x = a; x < bb; x++){ const i = y * W + x; if(free[i] === seed && (out || inside[i]) && (r.zone === 'inherit' || r.zone === 'void' || near2[i] < 0 || near2[i] === r.i || rooms[near2[i]].zone === r.zone)) m[(y - t) * w + x - a] = 1; }
      own[r.i] = {m, a, t, w, h};
      if(r.zone === 'chase'){ const cz = ZONES.indexOf('chase') + 1, cap = 3 * (B.r - B.x + 2 * pd) * (B.z - B.y + 2 * pd), all = []; let ok = true;
        for(let i = 0; i < N && ok; i++) if(free[i] === seed){ all.push(i); if(all.length > cap) ok = false; }
        if(ok){ const mm = new Uint8Array(N); for(const i of all) mm[i] = 1; const g3 = dilate(mm, W, H, rD + 1); for(let i = 0; i < N; i++) if(g3[i] && !solid[i] && inside[i]){ zone[i] = cz; owner[i] = r.i; } }
        if(ok) return; }
      if(r.zone === 'inherit') return;
      const zi = ZONES.indexOf(r.zone) + 1, g2 = dilate(m, w, h, rD + 1);
      for(let y = t; y < z; y++) for(let x = a; x < bb; x++){ const i = y * W + x; if(g2[(y - t) * w + x - a] && !solid[i] && (out || inside[i])){ zone[i] = zi; owner[i] = r.i; } }
    });
    // every floor inside the house takes a color: what the rooms didn't reach (a closet, a pantry, a shower, the corner of
    // a bay past a room's box) takes the color of the room it opens into, walking out from each room through the openings
    // ("Open to below" is the one area left white, and color never walks into it)
    { const q = new Int32Array(N); let h = 0, t = 0;
      const vz = ZONES.indexOf('void') + 1;
      // (a chase's hatch stays in the chase)
      const cz = ZONES.indexOf('chase') + 1;
      for(let i = 0; i < N; i++) if(zone[i] && zone[i] !== vz && zone[i] !== cz) q[t++] = i;
      // a bath's or a bedroom's color walks only a little past its own room (into its closet, a bay), never down a hall
      // the read didn't box (Aston Pine's powder room colored the hall by the stairs, 10/28); the living color fills the rest
      // (a bath's color is no longer held to 2 ft past its box: that handed baths' back rooms to the hall, Aston Pine and
      // Westheimer, 10/28; door openings now set the line)
      const mayGo = () => true;
      while(h < t){ const p = q[h++], x = p % W;
        for(const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if(n >= 0 && n < N && !zone[n] && !solid[n] && inside[n] && mayGo(p, n)){ zone[n] = zone[p]; owner[n] = owner[p]; q[t++] = n; } }
      // a short hall that leads only to one bedroom (its suite's entry, with the suite's bath and closets off it) is part of
      // that bedroom up to its door (Stoney Brook's primary)
      const touching = ri => { const n = new Map();
        for(let i = 0; i < N; i++){ if(owner[i] !== ri) continue; const x = i % W;
          for(const q of [x > 1 ? i - 2 : -1, x < W - 2 ? i + 2 : -1, i - 2 * W, i + 2 * W]) if(q >= 0 && q < N && owner[q] >= 0 && owner[q] !== ri) n.set(owner[q], (n.get(owner[q]) || 0) + 1); }
        return [...n.keys()].map(j => rooms[j]); };
      rooms.forEach(r => {
        if(!/hall|corridor|vestibule/i.test(r.name) || r.zone !== 'living' || r.ft.w * r.ft.d > 40) return;
        const nb = touching(r.i), beds = nb.filter(q => q.zone === 'sleep'), other = nb.filter(q => q.zone === 'living' && !/hall|landing|stair/i.test(q.name));
        if(beds.length !== 1 || other.length) return;
        const zi = ZONES.indexOf('sleep') + 1;
        for(let i = 0; i < N; i++) if(owner[i] === r.i){ zone[i] = zi; owner[i] = beds[0].i; }
        r.suite = beds[0].name;
      });
      // floor closed in by lines (inside an island, a tub, a shower behind glass, between stair treads): the color around it
      const left = new Uint8Array(N), inWall = new Uint8Array(N); for(let i = 0; i < N; i++) if(!zone[i] && !solid[i] && inside[i]) left[i] = 1;
      const st = [Math.round(0.3 * ppf), Math.round(0.6 * ppf), Math.round(1.2 * ppf)];
      pieces(left, W, H, (comp, ax, ay, bx, by) => {
        // paper inside a wall or between a window's lines: a long thin sliver (a tiled floor's square cells take the color)
        const s1 = Math.min(bx - ax, by - ay) + 1, s2 = Math.max(bx - ax, by - ay) + 1;
        if(s1 < 0.7 * ppf && s2 >= 3 * s1 && comp.length < 2 * ppf * ppf){ for(const p of comp) inWall[p] = 1; return; }
        const votes = new Map();
        for(let j = 0; j < comp.length; j += Math.max(1, Math.floor(comp.length / 400))){ const p = comp[j], x = p % W, y = (p - x) / W;
          for(const dd of st) for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const X = x + dx * dd, Y = y + dy * dd; if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const z = zone[Y * W + X]; if(z && z !== vz){ votes.set(z, (votes.get(z) || 0) + 1); break; } } }
        // inside a room's box (the smallest room drawn around it that has a color of its own): that room's color, so a
        // room cut up by lines keeps its color in every piece; otherwise the color around it
        const cx = (ax + bx) / 2, cy = (ay + by) / 2, home = rooms.filter(r => r.zone !== 'inherit' && r.zone !== 'void' && inBox(r.B, cx, cy, 0))
          .sort((p, q) => (p.B.r - p.B.x) * (p.B.z - p.B.y) - (q.B.r - q.B.x) * (q.B.z - q.B.y))[0];
        const z = [...votes.entries()].sort((p, q) => q[1] - p[1])[0];
        const zi = home ? ZONES.indexOf(home.zone) + 1 : z ? z[0] : ZONES.indexOf('living') + 1;
        for(const p of comp) zone[p] = zi;
      });
      const vZ = ZONES.indexOf('void') + 1, pZ = ZONES.indexOf('paper') + 1, sZ = ZONES.indexOf('sleep') + 1, gZ = ZONES.indexOf('garage') + 1, oZ = ZONES.indexOf('outdoor') + 1;
      const nearBox2 = (p, q, g) => p.x <= q.r + g && q.x <= p.r + g && p.y <= q.z + g && q.y <= p.z + g;
      const regionOf = r => { const om = own[r.i]; if(!om) return []; const o = []; for(let y = 0; y < om.h; y++) for(let x = 0; x < om.w; x++) if(om.m[y * om.w + x]) o.push((y + om.t) * W + x + om.a); return o; };
      // what a room opens into: the colors just past its own floor, through its openings (never across a wall)
      const opensInto = px => { const set = new Set(px), c = new Map();
        for(const p of px){ const x = p % W; for(const q of [x > 2 ? p - 3 : -1, x < W - 3 ? p + 3 : -1, p - 3 * W, p + 3 * W]) if(q >= 0 && q < N && !set.has(q) && !solid[q] && zone[q]) c.set(zone[q], (c.get(zone[q]) || 0) + 1); }
        return c; };
      // closets take their room's color: a closet that opens into a bedroom is the bedroom's, even when it also opens on a
      // hall (Beulah's primary closet, 10/28)
      // (a closet whose own floor didn't come through takes its box; one that touches no color through an opening takes
      // the color around its box, a bedroom's first: Beulah's southeast walk-in closet stayed white, 10/28)
      // (a walk-in closet against exactly one bedroom is that bedroom's, even when its door opens on a hall: Beulah, 10/28)
      const bedNext = r => rooms.filter(q => q.zone === 'sleep' && nearBox2(q.B, r.B, 0.8 * ppf));
      rooms.filter(r => r.zone === 'inherit').forEach(r => { let px = regionOf(r); if(!px.length) px = boxOf(r); if(!px.length) return; const c = opensInto(px);
        if(!c.size){ const g = 1.2 * ppf, B = r.B; for(let y = Math.max(0, Math.floor(B.y - g)); y < Math.min(H, B.z + g); y += 2) for(let x = Math.max(0, Math.floor(B.x - g)); x < Math.min(W, B.r + g); x += 2){
          if(x >= B.x && x <= B.r && y >= B.y && y <= B.z) continue; const z = zone[y * W + x]; if(z) c.set(z, (c.get(z) || 0) + 1); } }
        const zi = c.get(sZ) ? sZ : [...c.entries()].filter(([z]) => z !== vZ && z !== gZ && z !== oZ).sort((a, b) => b[1] - a[1]).map(e => e[0])[0];
        if(zi) for(const p of px) zone[p] = zi; });
      // storage, a shop, any room that opens only to the garage or outdoors: paper, like the garage (Beulah's storage,
      // Marshall's shop, 10/28)
      // (a paper room takes its whole walled floor, not only what it won against its neighbors: the living color walked
      // into Marshall's shop, 10/28)
      const boxOf = r => { const sd = seedOf(r, r.lx, r.ly), o = []; if(!sd) return o; const B = r.B;
        for(let y = Math.max(0, Math.floor(B.y)); y < Math.min(H, B.z); y++) for(let x = Math.max(0, Math.floor(B.x)); x < Math.min(W, B.r); x++){ const p = y * W + x; if(free[p] === sd) o.push(p); } return o; };
      rooms.filter(r => r.zone !== 'garage' && r.zone !== 'outdoor' && r.zone !== 'void').forEach(r => { const px = r.zone === 'paper' ? boxOf(r) : regionOf(r); if(!px.length) return;
        const c = opensInto(px), only = [...c.keys()].every(z => z === gZ || z === oZ || z === pZ);
        if(r.zone === 'paper' || (c.size && only && r.ft.w * r.ft.d < 150)){ for(const p of px) zone[p] = pZ; r.zone = 'paper'; } });
      // a walk-in closet against a bedroom is that bedroom's, even when its door opens on a hall (Beulah's southeast closet,
      // the owner 10/28); last, so no other pass turns it paper or living
      rooms.filter(r => r.zone === 'inherit' && /walk|w\.?i\.?c|wardrobe/i.test(r.name) && bedNext(r).length).forEach(r => { let px = regionOf(r); if(!px.length) px = boxOf(r); for(const p of px) zone[p] = sZ; });
      // stairwells white: the stairs, their landing and return (the owner 10/28)
      // (a bedroom's or a bath's own floor stays its color where the read's stairs box runs over it: Aston Pine's Second Suite)
      if(stB) for(let y = Math.max(0, Math.floor(stB.y - 0.2 * ppf)); y < Math.min(H, stB.z + 0.2 * ppf); y++) for(let x = Math.max(0, Math.floor(stB.x - 0.2 * ppf)); x < Math.min(W, stB.r + 0.2 * ppf); x++){ const i = y * W + x; const ow = rooms[owner[i]];
        if(inside[i] && !(ow && (ow.zone === 'sleep' || ow.zone === 'bath'))) zone[i] = vZ; }
      // a stairwell room and a curved stair's whole circle: white too
      rooms.filter(r => r.zone === 'void').forEach(r => { for(const p of boxOf(r)) zone[p] = vZ; });
      for(const q of fx) if(q.type === 'stairs-curved' && q.cx_ != null) for(let y = Math.max(0, Math.floor(q.cy_ - q.r1_)); y < Math.min(H, q.cy_ + q.r1_); y++) for(let x = Math.max(0, Math.floor(q.cx_ - q.r1_)); x < Math.min(W, q.cx_ + q.r1_); x++){ const i = y * W + x; if(inside[i] && Math.hypot(x - q.cx_, y - q.cy_) < q.r1_) zone[i] = vZ; }
      // a scrap of floor in no room beside "Open to below" (Stoney Brook's little triangle) is white with it; beside the
      // stairs it is not (Aston Pine's Second Suite lost a strip along its stair wall to this, 10/28)
      { const ob = new Uint8Array(N); rooms.filter(r => r.zone === 'void' && VOID.test(r.name)).forEach(r => { for(const p of boxOf(r)) ob[p] = 1; });
        const boxed = new Uint8Array(N); rooms.forEach(r => { if(r.zone === 'void') return; const B = r.B; for(let y = Math.max(0, Math.floor(B.y)); y < Math.min(H, B.z); y++) boxed.fill(1, y * W + Math.max(0, Math.floor(B.x)), y * W + Math.min(W, Math.ceil(B.r))); });
        const u = new Uint8Array(N); for(let i = 0; i < N; i++) if(zone[i] && zone[i] !== vZ && !boxed[i] && inside[i]) u[i] = 1;
        pieces(u, W, H, comp => { if(comp.length > 40 * ppf * ppf) return; const set = new Set(comp); let v = 0;
          for(const p of comp){ const x = p % W; for(const q of [x > 2 ? p - 3 : -1, x < W - 3 ? p + 3 : -1, p - 3 * W, p + 3 * W]) if(q >= 0 && q < N && !set.has(q) && zone[q] === vZ && ob[q]){ v = 1; break; } if(v) break; }
          if(v) for(const p of comp) zone[p] = vZ; }); }
      // a bath's or a bedroom's own box keeps its color where the walk out handed its floor to a living room whose box doesn't
      // cover it (Aston Pine's Bath 3 vanity room, nearer the hall through its door, went hall-colored, 10/28)
      { const lZ3 = ZONES.indexOf('living') + 1, livB = rooms.filter(r => r.zone === 'living').map(r => r.B);
        rooms.filter(r => r.zone === 'bath' || r.zone === 'sleep').forEach(r => { const zi = ZONES.indexOf(r.zone) + 1, B = r.B, e = 0.3 * ppf;
          for(let y = Math.ceil(B.y + e); y < B.z - e; y++) for(let x = Math.ceil(B.x + e); x < B.r - e; x++){ const i = y * W + x;
            if(zone[i] === lZ3 && !solid[i] && !livB.some(L2 => inBox(L2, x, y, 0))) zone[i] = zi; } }); }
      // a door's opening, through the wall's thickness, takes the color of the room it swings into, never the hall's
      for(const dr of doors){ const [hx, hy] = dr.h, [px, py] = dr.p, ux = (dr.l[0] - hx) / dr.w, uy = (dr.l[1] - hy) / dr.w;
        const zi = zone[Math.round(hy + py * 0.5 * dr.w) * W + Math.round(hx + px * 0.5 * dr.w + ux * 0.5 * dr.w)]; if(!zi || zi === ZONES.indexOf('void') + 1) continue;
        // through the wall's own thickness at the hinge jamb, no further (never a lip of color out into the hall)
        let back = 1; while(back < ppf){ const X = Math.round(hx - px * back), Y = Math.round(hy - py * back); if(X < 0 || Y < 0 || X >= W || Y >= H || !walls[Y * W + X]) break; back++; }
        for(let t2 = 0.04 * dr.w; t2 <= 0.96 * dr.w; t2 += 0.5) for(let v = -back; v <= 0.15 * ppf; v += 0.5){ const X = Math.round(hx + ux * t2 + px * v), Y = Math.round(hy + uy * t2 + py * v);
          if(X < 0 || Y < 0 || X >= W || Y >= H) continue; const i = Y * W + X; if(!solid[i] && inside[i]) zone[i] = zi; } }
      // an opening with no swing drawn (a plain opening, a pocket or sliding door) between a hall and a room: the room's
      // color through the wall's thickness, never the hall's (the owner 10/28). An opening pixel is hall-colored floor with a
      // wall's cut end on each side within 4 ft (the jambs: ink a wall's thickness deep, running on the other way)
      { const hallish = r => r && /hall|corridor|landing|foyer|entry|gallery|vestibule/i.test(r.name);
        const [hr, vr] = runs(), lim = Math.round(4 * ppf), thick = 0.9 * ppf, hit = new Uint8Array(N), hitZ = new Uint8Array(N);
        const jamb = (i, vert) => walls[i] && (vert ? vr[i] <= thick && hr[i] >= 0.4 * ppf : hr[i] <= thick && vr[i] >= 0.4 * ppf);
        // (an opening left white, a sliver between the wall and a pocket door's line (Bayou Glen's bedroom), counts too)
        for(let i = 0; i < N; i++){ if(solid[i] || !inside[i] || (zone[i] && !hallish(rooms[owner[i]]))) continue; const x = i % W, y = (i - x) / W;
          for(const vert of [0, 1]){ let a2 = 0, b2 = 0;
            // along the wall: a horizontal wall's opening runs across (x), a vertical wall's down (y)
            if(!vert){ while(a2 < lim && x - a2 > 0 && !walls[i - a2]) a2++; while(b2 < lim && x + b2 < W - 1 && !walls[i + b2]) b2++;
              if(a2 + b2 <= lim && a2 < lim && b2 < lim && jamb(i - a2, 1) && jamb(i + b2, 1)){ hit[i] = 1; break; } }
            else { while(a2 < lim && y - a2 > 0 && !walls[i - a2 * W]) a2++; while(b2 < lim && y + b2 < H - 1 && !walls[i + b2 * W]) b2++;
              if(a2 + b2 <= lim && a2 < lim && b2 < lim && jamb(i - a2 * W, 0) && jamb(i + b2 * W, 0)){ hit[i] = 2; break; } } } }
        pieces(hit, W, H, (comp, ax, ay, bx, by) => {
          // the room on the far side: the most common non-hall color just past the opening, either way across it
          const c = new Map(), vert = hit[comp[0]] === 2, reach = Math.round(1.2 * ppf), sides = new Set();
          for(const p of comp){ const x = p % W, y = (p - x) / W;
            for(const sgn of [-1, 1]){ const X = vert ? x + sgn * reach : x, Y = vert ? y : y + sgn * reach; if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
              const q = Y * W + X, r = rooms[owner[q]]; if(zone[q]) sides.add(sgn);
              if(zone[q] && r && !hallish(r) && r.zone !== 'void' && r.zone !== 'garage' && r.zone !== 'outdoor') c.set(zone[q], (c.get(zone[q]) || 0) + 1); } }
          // (a white sliver with floor on one side only is a window, not an opening)
          if(sides.size < 2) return;
          const best = [...c.entries()].sort((p, q) => q[1] - p[1])[0];
          if(best && best[1] >= 0.3 * comp.length) for(const p of comp) zone[p] = best[0]; }); }
      // open to below takes in a pocket of floor beside it that the read put in no room (Aston Pine's strip beside the
      // stairs), across a thin line, and the line goes (the owner 10/28: open-to-below is white with no line through it)
      { const vZ2 = ZONES.indexOf('void') + 1, boxed = new Uint8Array(N);
        rooms.forEach(r => { if(r.zone === 'void') return; const B = r.B; for(let y = Math.max(0, Math.floor(B.y)); y < Math.min(H, B.z); y++) boxed.fill(1, y * W + Math.max(0, Math.floor(B.x)), y * W + Math.min(W, Math.ceil(B.r))); });
        if(stB) for(let y = Math.max(0, Math.floor(stB.y)); y < Math.min(H, stB.z); y++) boxed.fill(1, y * W + Math.max(0, Math.floor(stB.x)), y * W + Math.min(W, Math.ceil(stB.r)));
        const u = new Uint8Array(N); for(let i = 0; i < N; i++) if(zone[i] && zone[i] !== vZ2 && !boxed[i] && inside[i] && !solid[i]) u[i] = 1;
        // (only the open to below itself: never the stairs, whose treads stay)
        const isV = new Uint8Array(N); rooms.filter(r => r.zone === 'void' && VOID.test(r.name)).forEach(r => { for(const p of boxOf(r)) if(zone[p] === vZ2) isV[p] = 1; });
        const nearSt = new Uint8Array(N); if(stB) for(let y = Math.max(0, Math.floor(stB.y - 0.5 * ppf)); y < Math.min(H, stB.z + 0.5 * ppf); y++) for(let x = Math.max(0, Math.floor(stB.x - 0.5 * ppf)); x < Math.min(W, stB.r + 0.5 * ppf); x++) nearSt[y * W + x] = 1;
        const vNear = dilate(isV, W, H, Math.max(2, Math.round(0.6 * ppf)));
        pieces(u, W, H, (comp, ax, ay, bx, by) => { if(comp.length > 120 * ppf * ppf || comp.length < 2 * ppf * ppf || !comp.some(p => vNear[p])) return;
          const m = new Uint8Array(N); for(const p of comp) m[p] = 1; const mN = dilate(m, W, H, Math.max(2, Math.round(0.6 * ppf)));
          // (the outer wall runs past both ends of every such pocket: it doesn't count as a wall between)
          const ow = 0.6 * ppf, outer = i => { const x = i % W, y = (i - x) / W; return x < O.x + ow || x > O.r - ow || y < O.y + ow || y > O.z - ow; };
          const between = []; let hard = 0; for(let i = 0; i < N; i++) if(mN[i] && vNear[i] && walls[i] && !nearSt[i] && !outer(i)){ if(core[i]) hard++; else between.push(i); }
          if(hard > 0.2 * (hard + between.length)) return;   // a real wall between: a room of its own
          for(const p of comp) zone[p] = vZ2; for(const i of between){ walls[i] = 0; solid[i] = 0; ceilGone[i] = WHY.voidLine; zone[i] = vZ2; } }); }
      // a pocket of floor the read put in no room that lies along the garage with only a thin line between (storage at the
      // back of the garage, Aston Pine's water-heater strip) is the garage's: paper (the owner 10/28: garages, garage storage
      // and rooms off the garage stay paper), even when a door from the house opens into it
      { const gZ2 = ZONES.indexOf('garage') + 1, pZ2 = ZONES.indexOf('paper') + 1, boxed = new Uint8Array(N);
        rooms.forEach(r => { const B = r.B; for(let y = Math.max(0, Math.floor(B.y)); y < Math.min(H, B.z); y++) boxed.fill(1, y * W + Math.max(0, Math.floor(B.x)), y * W + Math.min(W, Math.ceil(B.r))); });
        if(stB) for(let y = Math.max(0, Math.floor(stB.y)); y < Math.min(H, stB.z); y++) boxed.fill(1, y * W + Math.max(0, Math.floor(stB.x)), y * W + Math.min(W, Math.ceil(stB.r)));
        const isG = new Uint8Array(N); for(let i = 0; i < N; i++) if(zone[i] === gZ2) isG[i] = 1;
        const gNear = dilate(isG, W, H, Math.max(2, Math.round(1 * ppf)));
        const u = new Uint8Array(N); for(let i = 0; i < N; i++) if(zone[i] && zone[i] !== gZ2 && zone[i] !== pZ2 && zone[i] !== ZONES.indexOf('void') + 1 && !boxed[i] && inside[i] && !solid[i]) u[i] = 1;
        pieces(u, W, H, comp => { if(comp.length > 150 * ppf * ppf || comp.length < 4 * ppf * ppf) return;
          let along = 0; for(const p of comp) if(gNear[p]) along++;
          if(along < 0.2 * comp.length) return;
          for(const p of comp) zone[p] = pZ2; }); }
      let white = 0; for(let i = 0; i < N; i++) if(inside[i] && !solid[i] && !zone[i] && !inWall[i]) white++;
      if(white > 0.5 * ppf * ppf) issues.push({kind: 'plan-white-inside', sqft: +(white / ppf / ppf).toFixed(1)});
    }
    // labels: one per room, never on a line, fixture, island or stair. Each room's clear spots (the largest clear boxes of
    // several heights, nearest the room's center first) go to the template, which sets the label at 8 pt, down to 6 pt,
    // in the first spot it fits, and leaves it off when it won't fit at 6 pt.
    const hard = new Uint8Array(N); for(let i = 0; i < N; i++) if(walls[i] && !soft[i]) hard[i] = 1;
    // our fixtures are drawn later, by the template: a label keeps off them too
    // (a drop is ink taken out: open floor for a label, the very spot a ceiling note or a name stood)
    for(const q of fx){ if(!q.B || q.type === 'door' || q.type === 'drop' || !q.draw) continue; for(let y = Math.max(0, Math.floor(q.B.y)); y < Math.min(H, q.B.z); y++) hard.fill(1, y * W + Math.max(0, Math.floor(q.B.x)), y * W + Math.min(W, Math.ceil(q.B.r))); }
    // a door's swing: its quarter circle (not the square around it), so a label never sits on a swing. A room with no clear
    // spot off its swings (a mudroom with three doors) may set its label inside a swing's open quarter, never on its lines.
    const hardOpen = hard.slice(), hardNoDoor = hard.slice();
    // (our door's leaf and arc, drawn later by the template, are lines too)
    for(const dr of doors){ const [hx, hy] = dr.h, [px, py] = dr.p, ux = (dr.l[0] - hx) / dr.w, uy = (dr.l[1] - hy) / dr.w, R = dr.w;
      const put = (x, y) => { const X = Math.round(x), Y = Math.round(y); if(X >= 0 && Y >= 0 && X < W && Y < H) hardOpen[Y * W + X] = 1; };
      for(let t = 0; t <= R; t += 0.5) put(hx + px * t, hy + py * t);
      for(let a = 0; a <= Math.PI / 2; a += 0.5 / R) put(hx + R * (Math.cos(a) * px + Math.sin(a) * ux), hy + R * (Math.cos(a) * py + Math.sin(a) * uy)); }
    for(const dr of doors){ const [hx, hy] = dr.h, [px, py] = dr.p, ux = (dr.l[0] - hx) / dr.w, uy = (dr.l[1] - hy) / dr.w, R = dr.w;
      for(let y = Math.max(0, Math.floor(hy - R)); y < Math.min(H, hy + R); y++) for(let x = Math.max(0, Math.floor(hx - R)); x < Math.min(W, hx + R); x++){
        const dx = x - hx, dy = y - hy; if(Math.hypot(dx, dy) <= R && dx * ux + dy * uy >= 0 && dx * px + dy * py >= 0) hard[y * W + x] = 1; } }
    if(stB) for(let y = Math.max(0, Math.floor(stB.y)); y < Math.min(H, stB.z); y++) hard.fill(1, y * W + Math.max(0, Math.floor(stB.x)), y * W + Math.min(W, Math.ceil(stB.r)));
    const near = dilate(hard, W, H, Math.max(1, Math.round(0.2 * ppf))), nearOpen = doors.length ? dilate(hardOpen, W, H, Math.max(1, Math.round(0.2 * ppf))) : near, labels = [];
    const HH = [0.45, 0.6, 0.75, 0.9, 1.1, 1.35, 1.65, 2, 2.5, 3].map(f => f * ppf);   // (to 3 ft: a two-line label on a plan printed small, Marshall)
    const named = rooms.filter(r => {
      if(r.minor && rooms.some(q => q !== r && !q.minor && q.name === r.name)) return false;   // the small piece of an L
      if(r.suite) return false;                                                                // a suite's hall: part of the bedroom
      const n = String(r.name).toLowerCase(), small = Math.min(r.ft.w, r.ft.d) < SMALL;
      // hall and linen closets go unlabeled; a walk-in closet, a wardrobe or storage is always labeled ("WIC", "STOR")
      if(r.zone === 'inherit' && /^closet|linen|chase/.test(n) && !/walk|w\.?i\.?c|wardrobe/.test(n) && small) return false;
      return true;
    });
    // one label for a bath inside a bath (a toilet room, a shower) and for two pantries side by side
    const nearBox = (p, q, g) => p.B.x <= q.B.r + g && q.B.x <= p.B.r + g && p.B.y <= q.B.z + g && q.B.y <= p.B.z + g;
    const area = r => r.ft.w * r.ft.d, dup = new Set();
    named.forEach(p => named.forEach(q => { if(p === q || dup.has(p) || dup.has(q) || !nearBox(p, q, 0.8 * ppf)) return;
      const same = p.zone === 'bath' && q.zone === 'bath' && (area(q) < 30 || q.minor) && area(p) >= area(q) ? q
        : /pantry/i.test(p.name) && /pantry/i.test(q.name) && area(p) >= area(q) ? q : null;
      if(same) dup.add(same); }));
    named.filter(r => !dup.has(r)).forEach(r => {
      const n = String(r.name).toLowerCase(), laundry = /laundry|washer|dryer|\bw\/?d\b/.test(n);
      let name = r.name, short = r.short, dims = r.dims;
      if(laundry && (Math.min(r.ft.w, r.ft.d) < 6 || /stack/.test(n))){ name = short = 'W/D'; dims = ''; }
      if(r.zone === 'void' && VOID.test(name)){ name = 'Open to below'; short = 'Open'; dims = ''; }
      // its floor: what it owns (grown out through the openings), or for a closet its own box
      let a, t, w, h, inR;
      const om = own[r.i];
      if(r.zone !== 'inherit'){
        let ax = W, ay = H, bx = -1, by = -1;
        for(let y = Math.max(0, Math.floor(r.B.y - 3 * ppf)); y < Math.min(H, r.B.z + 3 * ppf); y++) for(let x = Math.max(0, Math.floor(r.B.x - 3 * ppf)); x < Math.min(W, r.B.r + 3 * ppf); x++)
          if(owner[y * W + x] === r.i){ if(x < ax) ax = x; if(x > bx) bx = x; if(y < ay) ay = y; if(y > by) by = y; }
        if(bx < 0 && !om) return;
        if(bx < 0){ ({a, t, w, h} = om); inR = (x, y) => om.m[(y - t) * w + x - a]; }
        else { a = ax; t = ay; w = bx - ax + 1; h = by - ay + 1; inR = (x, y) => owner[y * W + x] === r.i; }
      } else { if(!om) return; ({a, t, w, h} = om); inR = (x, y) => om.m[(y - t) * w + x - a]; }
      // bad: not this room, near a line, on the stairs (near: the mask in use)
      const spotsWith = near => {
      const I = new Float64Array((w + 1) * (h + 1)); let cx = 0, cy = 0, cn = 0;
      for(let y = 0; y < h; y++){ let row = 0; for(let x = 0; x < w; x++){ const X = x + a, Y = y + t, ok = inR(X, Y) && !near[Y * W + X] && !inBox(stairsB, X, Y, 0.2 * ppf);
        if(inR(X, Y)){ cx += X; cy += Y; cn++; } row += ok ? 0 : 1; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
      if(!cn) return null;
      cx /= cn; cy /= cn;
      const bad = (x0_, y0_, x1_, y1_) => { const p0 = Math.floor(x0_ - a), q0 = Math.floor(y0_ - t), p1 = Math.ceil(x1_ - a), q1 = Math.ceil(y1_ - t);
        if(p0 < 0 || q0 < 0 || p1 > w || q1 > h) return 1;
        return I[q1 * (w + 1) + p1] - I[q0 * (w + 1) + p1] - I[q1 * (w + 1) + p0] + I[q0 * (w + 1) + p0]; };
      // clear boxes both ways: as wide as it goes at each label height, and as tall as it goes at each label height turned
      // (a floor printed on its side runs the text up the drawing)
      const reach = (cap, ok) => { let lo = 0, hi = cap; if(!ok(1)) return 0; while(hi - lo > 1){ const m = (lo + hi) / 2; if(ok(m)) lo = m; else hi = m; } return lo; };
      const prof = (x, y) => HH.map(hh => reach(w / 2, m => !bad(x - m, y - hh, x + m, y + hh)))
        .concat(HH.map(hw => reach(h / 2, m => !bad(x - hw, y - m, x + hw, y + m))));
      const step = Math.max(2, 0.25 * ppf), pts = [];
      for(let y = t + step / 2; y < t + h; y += step) for(let x = a + step / 2; x < a + w; x += step) if(inR(Math.round(x), Math.round(y)) && !bad(x - 1, y - 1, x + 1, y + 1)) pts.push([Math.hypot(x - cx, y - cy), x, y]);
      pts.sort((p, q) => p[0] - q[0]);
      // nearest the center first; a spot farther out only when it is clearly roomier at some height
      const best = HH.concat(HH).map(() => 0), cand = [];
      const n0 = HH.length, roomy = p => HH.some((hh, j) => (hh >= 0.35 * ppf && p[j] >= 0.8 * ppf) || (p[n0 + j] >= 0.35 * ppf && hh >= 0.8 * ppf));
      // (a spot too tight for a 6 pt word is skipped, so a busy kitchen's search reaches past the slivers by its island)
      for(const [, x, y] of pts){ const p = prof(x, y); if(!roomy(p) || !p.some((v, j) => v > best[j] * 1.3 + 2)) continue;
        p.forEach((v, j) => best[j] = Math.max(best[j], v));
        const n = HH.length;
        cand.push({x: +(x / W).toFixed(4), y: +(y / H).toFixed(4), p: HH.map((hh, j) => [+(hh / H).toFixed(4), +(p[j] / W).toFixed(4)]).filter(z => z[1] > 0)
          .concat(HH.map((hw, j) => [+(p[n + j] / H).toFixed(4), +(hw / W).toFixed(4)]).filter(z => z[0] > 0))});
        if(cand.length >= 30) break; }
      // and the roomiest spot in the room at each label height, wherever it is (Aston Pine's kitchen: thirty spots around
      // its island crowded out the open floor above it, so the label went in at 6 pt, the owner 10/28)
      { const top = HH.concat(HH).map(() => null);
        for(let k2 = 0; k2 < pts.length; k2 += Math.max(1, Math.floor(pts.length / 1500))){ const [, x, y] = pts[k2], pr = prof(x, y);
          pr.forEach((v, j) => { if(!top[j] || v > top[j].v) top[j] = {v, x, y, pr}; }); }
        const n = HH.length;
        for(const t of top){ if(!t || !roomy(t.pr) || cand.some(c => Math.abs(c.x - t.x / W) < 1e-4 && Math.abs(c.y - t.y / H) < 1e-4)) continue;
          cand.push({x: +(t.x / W).toFixed(4), y: +(t.y / H).toFixed(4), p: HH.map((hh, j) => [+(hh / H).toFixed(4), +(t.pr[j] / W).toFixed(4)]).filter(z => z[1] > 0)
            .concat(HH.map((hw, j) => [+(t.pr[n + j] / H).toFixed(4), +(hw / W).toFixed(4)]).filter(z => z[0] > 0))}); } }
      return {cand, cx, cy}; };
      const S1 = spotsWith(near); if(!S1) return;
      const {cand, cx, cy} = S1;
      // a door swing near the room's center (rule 4 keeps labels off it): the floor around the center, about a label's
      // size, is more blocked than it would be with no swings. Reported with the label, so the before-and-after check can
      // tell a label moved or set smaller for a swing from one that got worse.
      let swing = false;
      if(doors.length){ let a1 = 0, a2 = 0; for(let y = Math.max(0, Math.round(cy - 4 * ppf)); y < Math.min(H, cy + 4 * ppf); y++) for(let x = Math.max(0, Math.round(cx - 4 * ppf)); x < Math.min(W, cx + 4 * ppf); x++){ const i = y * W + x; if(hard[i]) a1++; if(hardNoDoor[i]) a2++; }
        swing = a1 > a2 + 0.5 * ppf * ppf; }
      // the same search with door swings open, for a room whose clear spots are cramped
      const room = c => Math.max(0, ...c.flatMap(q => q.p.filter(([hh]) => hh * H >= 0.6 * ppf).map(([, hw]) => hw * W)));
      const cand2 = doors.length && room(cand) < 2.5 * ppf ? spotsWith(nearOpen).cand : [];
      // no clear spot at all (a bath full of fixtures): the room's center, so the room is still labeled (at 6 pt, reported)
      if(!cand.length){ issues.push({kind: 'plan-label-no-clear-spot', room: r.name}); cand.push({x: +(cx / W).toFixed(4), y: +(cy / H).toFixed(4), p: [[+(0.3 * ppf / H).toFixed(4), +(0.6 * ppf / W).toFixed(4)]]}); }
      let knock = 0; for(let y = Math.max(0, Math.floor(r.B.y)); y < Math.min(H, r.B.z) && !knock; y++) for(let x = Math.max(0, Math.floor(r.B.x)); x < Math.min(W, r.B.r); x++) if(soft[y * W + x]){ knock = 1; break; }
      // a bath's size is optional and goes first; a bath under 80 sq ft (all but a primary bath) shows "Bath" alone
      if(r.zone === 'bath' && r.ft.w * r.ft.d < 80) dims = '';
      labels.push({name, short, dims, kind: r.kind, minor: r.minor, zone: r.zone, dimsOptional: r.zone === 'bath', knock: !!knock,
        x: +(cx / W).toFixed(4), y: +(cy / H).toFixed(4), bx: +(r.B.x / W).toFixed(4), by: +(r.B.y / H).toFixed(4), w: +((r.B.r - r.B.x) / W).toFixed(4), h: +((r.B.z - r.B.y) / H).toFixed(4), c: cand, c2: cand2, swing,
        // (the color its floor actually took, for the patch under a tight label: a closet's is its bedroom's)
        tint: ZONES[(zone[Math.round(cy) * W + Math.round(cx)] || 0) - 1] || r.zone});
    });
    // outside the house only its walls' own marks stay (a door swing, a window's sill): long straight lines out there are
    // roof outlines or site lines (Aston Pine's second floor, 10/28) and go
    { const near = dilate(inside, W, H, Math.max(1, Math.round(0.2 * ppf))), [hr, vr] = runs(), held2 = (x, y) => outs.some(e => x >= e.x && x <= e.r && y >= e.y && y <= e.z);
      let roof = 0;
      for(let i = 0; i < N; i++){ if(!walls[i] || near[i]) continue; const x = i % W, y = (i - x) / W; if(held2(x, y)) continue;
        if(hr[i] >= 3 * ppf || vr[i] >= 3 * ppf || (hr[i] < 0.3 * ppf && vr[i] < 0.3 * ppf && !inBox(O, x, y, 3.5 * ppf))){ walls[i] = 0; ceilGone[i] = WHY.outside; roof++; } }
      // and a dashed roof line: outside pieces that don't touch the house at all
      const band = dilate(inside, W, H, Math.max(2, Math.round(0.4 * ppf))), out3 = new Uint8Array(N);
      for(let i = 0; i < N; i++){ if(!walls[i] || near[i]) continue; const x = i % W; if(!held2(x, (i - x) / W)) out3[i] = 1; }
      pieces(out3, W, H, comp => { if(comp.some(p => band[p])) return; for(const p of comp){ walls[p] = 0; ceilGone[p] = WHY.outside; roof++; } });
      // and a roof outline drawn against the wall (Aston Pine's porch roof, a triangle off the second floor): outside
      // ink that reaches more than 3.5 ft out from the house, where no door swing or window goes
      const far = dilate(inside, W, H, Math.max(2, Math.round(3.5 * ppf))), out4 = new Uint8Array(N);
      for(let i = 0; i < N; i++){ if(!walls[i] || near[i]) continue; const x = i % W; if(!held2(x, (i - x) / W)) out4[i] = 1; }
      pieces(out4, W, H, comp => { if(!comp.some(p => !far[p])) return; for(const p of comp){ walls[p] = 0; ceilGone[p] = WHY.outside; roof++; } });
      if(roof) issues.push({kind: 'plan-outside-lines-removed', px: roof}); }
    // what each rule took out, as boxes (fractions of the floor), for the before-and-after check
    const removed = [];
    for(const [why, code] of Object.entries(WHY)){ const m = new Uint8Array(N); let any = 0; for(let i = 0; i < N; i++) if(ceilGone[i] === code){ m[i] = 1; any = 1; }
      if(any) pieces(dilate(m, W, H, Math.max(1, Math.round(0.3 * ppf))), W, H, (comp, ax, ay, bx, by) => removed.push({why, x: +(ax / W).toFixed(4), y: +(ay / H).toFixed(4), w: +((bx - ax + 1) / W).toFixed(4), h: +((by - ay + 1) / H).toFixed(4)})); }
    const layers = {ink: maskURL(dilate(walls, W, H, 1), W, H)};
    // (white and paper floor go along too, untinted, so the before-and-after check can tell a rule's white from a miss)
    ['chase', 'void', 'paper', 'garage'].concat(TINTED).forEach(zn => { const zi = ZONES.indexOf(zn) + 1, m = new Uint8Array(N); let any = 0; for(let p = 0; p < N; p++) if(zone[p] === zi){ m[p] = 1; any = 1; } if(any) layers[zn] = maskURL(m, W, H); });
        const fixtures = fx.map(q => q.type === 'stairs-curved' ? (q.cx_ == null ? null : {type: q.type, cx: +(q.cx_ / W).toFixed(4), cy: +(q.cy_ / H).toFixed(4), r0: +(q.r0_ / W).toFixed(4), r1: +(q.r1_ / W).toFixed(4), a0: q.a0, a1: q.a1, treads: q.treads})
      : q.B && q.type !== 'drop' && q.draw ? {type: q.type, x: +(q.B.x / W).toFixed(4), y: +(q.B.y / H).toFixed(4), w: +((q.B.r - q.B.x) / W).toFixed(4), h: +((q.B.z - q.B.y) / H).toFixed(4), back: q.back, n: q.n, inches: q.inches} : null).filter(Boolean);
    doors.forEach(dr => fixtures.push({type: 'door', hx: +(dr.h[0] / W).toFixed(4), hy: +(dr.h[1] / H).toFixed(4), lx: +(dr.l[0] / W).toFixed(4), ly: +(dr.l[1] / H).toFixed(4), px: +dr.p[0].toFixed(4), py: +dr.p[1].toFixed(4)}));
    return {name: L.name, floor: L.floor, roof: !!L.roof, front: L.front || 'bottom', w: W, h: H, fixtures, removed, pageScale: +(1 / k).toFixed(4),
      feet: L.feet ? {w: +(W / ppf).toFixed(1), d: +(H / ppf).toFixed(1)} : null, noSizes: !L.rooms.some(r => r.dims), layers, labels, issues};
  }
  // the older inside test, for walls that leak: in each row and column the color stops at the outermost wall near the
  // outline's edge (an opening takes its neighbors' position)
  function edgeInside(walls, W, H, O, ppf){
    const R = 3 * ppf, bx0 = Math.max(0, Math.floor(O.x - ppf)), bx1 = Math.min(W, Math.ceil(O.r + ppf)), by0 = Math.max(0, Math.floor(O.y - ppf)), by1 = Math.min(H, Math.ceil(O.z + ppf));
    const edges = (n, lo, hi, at) => {
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
    const inside = new Uint8Array(W * H);
    for(let y = by0; y < by1; y++) for(let x = bx0; x < bx1; x++)
      if(x >= xl[y - by0] && x <= xr[y - by0] && y >= yt[x - bx0] && y <= yb[x - bx0]) inside[y * W + x] = 1;
    return inside;
  }
  // -> {kind: 'color', source, levels, finished, noSizes}. A finished listing plan: levels of kind 'image' (the listing's
  // own drawing, cropped and turned by the template). noSizes: the listing prints no room sizes, so the agent is asked
  // whether to take them from the MLS room list (PT.mlsSizes).
  // a listing's own drawing that shows one "floor" as separate blocks shows separate levels (the owner 10/28, W 9th: three
  // levels, first, second, third): each block its own level, the larger block first, numbered in order
  const splitParts = levels => { const out = [];
    for(const L of levels){ const parts = [...new Set(L.rooms.map(r => r.part || 1))];
      if(parts.length < 2){ out.push(L); continue; }
      const area = p => L.rooms.filter(r => (r.part || 1) === p).reduce((a, r) => a + (r.box.right - r.box.left) * (r.box.bottom - r.box.top), 0);
      parts.sort((a, b) => area(b) - area(a)).forEach(p => { const rs = L.rooms.filter(r => (r.part || 1) === p), ins = rs.filter(r => r.kind !== 'outdoor');
        const box = {left: Math.min(...ins.map(r => r.box.left)), top: Math.min(...ins.map(r => r.box.top)), right: Math.max(...ins.map(r => r.box.right)), bottom: Math.max(...ins.map(r => r.box.bottom))};
        out.push(Object.assign({}, L, {rooms: rs, outline: box, feet: null, ppfPage: L.ppfPage})); }); }
    return out.map((L, i) => Object.assign({}, L, {floor: i + 1, name: L.roof ? L.name : FLOORS[i] || L.name})); };
  // a garage drawn apart from the house (off its outer walls, Eubanks): not cut off (10/27 left it off the crop) but kept
  // as its own small drawing, which the template puts in a framed box beside the house with a site key (the owner 10/28,
  // concept B). site: both boxes in page pixels, so the key shows where the listing places the garage.
  const detachedGarages = (canvases, levels) => { const out = [];
    const house = levels.map(L => { const c = canvases[L.page - 1]; if(!c) return L;
      const b = drawingBox(c), P = f => ({x: b.x + f.left * b.w, y: b.y + f.top * b.h, r: b.x + f.right * b.w, z: b.y + f.bottom * b.h});
      const o = P(L.outline), near = 0.04 * Math.max(o.r - o.x, o.z - o.y);
      const apart = r => { if(r.kind !== 'garage') return false; const e = P(r.box); return !(e.x <= o.r + near && e.r >= o.x - near && e.y <= o.z + near && e.z >= o.y - near); };
      const gs = L.rooms.filter(apart); if(!gs.length) return L;
      gs.forEach(g => { const e = P(g.box), fpp = L.feet && L.feet.w > 0 ? L.feet.w / (o.r - o.x) : 0;
        out.push({L: Object.assign({}, L, {rooms: [g], outline: g.box, stairs: null, name: 'Detached garage', roof: false,
          feet: fpp ? {w: +((e.r - e.x) * fpp).toFixed(1), d: +((e.z - e.y) * fpp).toFixed(1)} : null}),
          site: {house: [o.x, o.y, o.r - o.x, o.z - o.y].map(v => Math.round(v)), garage: [e.x, e.y, e.r - e.x, e.z - e.y].map(v => Math.round(v))}}); });
      return Object.assign({}, L, {rooms: L.rooms.filter(r => !gs.includes(r))}); });
    return {house, garages: out};
  };
  // the owner 10/28 (late): no more redrawing. Every listing's plan is placed as the agent gave it: cut from its page, turned
  // and sized to the plan panel, its white paper made clear so it sits on the design's own background; a colored plan
  // keeps its colors. Redrawing kept misreading rooms and erasing lines. colorFloor stays for a plan with redraw: true
  // (off everywhere). A watermark (another company's name) or a file too soft to print sharp is flagged on the proof.
  PT.colorPlan = (canvases, plan) => {
    const fin = PT.planFinished(canvases, plan), levels = [], redraw = plan.redraw === true;
    const sep = detachedGarages(canvases, plan.levels || []);
    const withPpf = sep.house.map(L => { const c = canvases[L.page - 1]; if(!c || !L.feet || !(L.feet.w > 0)) return L;
      const bb = drawingBox(c); return Object.assign({}, L, {ppfPage: (L.outline.right - L.outline.left) * bb.w / L.feet.w}); });
    const place = (c, L) => redraw ? colorFloor(c, L) : finishedFloor(c, L);
    for(const L of redraw ? sep.house : splitParts(withPpf)){ const c = canvases[L.page - 1]; if(c) levels.push(place(c, L)); }
    const detached = sep.garages.map(({L, site}) => { const c = canvases[L.page - 1]; if(!c) return null;
      return Object.assign(place(c, L), {name: 'Detached garage', detached: 'garage', site}); }).filter(Boolean);
    if(!redraw && fin.watermark && levels[0]) levels[0].issues.push({kind: 'plan-watermark', detail: "another company's name across the plan: ask the agent for a clean file"});
    return {kind: 'color', source: redraw ? (plan.source || 'Floor plan from the listing, colored for this brochure.') : 'Floor plan from the listing.',
      levels, detached, finished: !redraw, colored: fin.colored > 0.1, watermark: fin.watermark, noSizes: redraw && levels.length > 0 && levels.every(l => l.noSizes)};
  };
  // the listing's plan as the agent gave it, with no AI read (the owner 10/29): each page is one floor, cut to its drawing
  // (PT.drawingBox), white paper made clear, colors kept. No room boxes, so no split blocks or detached-garage box.
  PT.givenPlan = canvases => PT.colorPlan(canvases, {levels: canvases.map((c, i) => ({page: i + 1, floor: i + 1, name: FLOORS[i] || '',
    outline: {left: 0, top: 0, right: 1, bottom: 1}, rooms: [], feet: null}))});
  // the agent said yes to sizes from the MLS room list: each label takes the size of the MLS room with its name on its
  // floor (Primary for Master; "Bedroom 2" or the next unused bedroom), rounded to feet. A room with no match stays unsized.
  PT.mlsSizes = (plan, mls) => {
    const lv = r => { const m = String(r.level || '').match(/\d+/); return m ? +m[0] : /main|ground|first/i.test(r.level || '') ? 1 : /second|upper/i.test(r.level || '') ? 2 : 0; };
    const key = s => String(s || '').toLowerCase().replace(/master/g, 'primary').replace(/\broom\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const ft = s => { const m = String(s || '').match(/(\d+)\s*'?\s*(?:-?\s*\d+\s*"?)?\s*[x×]\s*(\d+)/i); return m ? `${m[1]} x ${m[2]}` : ''; };
    const used = new Set();
    for(const L of plan.levels || []) for(const l of L.labels || []){
      if(l.dims || l.zone === 'void' || l.name === 'W/D') continue;
      const pool = (mls || []).filter((r, i) => !used.has(i) && ft(r.size) && (!lv(r) || lv(r) === L.floor)).map(r => [r, (mls || []).indexOf(r)]);
      const hit = pool.find(([r]) => key(r.name) === key(l.name)) || pool.find(([r]) => key(r.name).startsWith(key(l.name)) || key(l.name).startsWith(key(r.name)))
        || (/bedroom/i.test(l.name) ? pool.find(([r]) => /bed/i.test(r.name) && !/primary|master/i.test(r.name)) : null);
      if(hit){ l.dims = ft(hit[0].size); used.add(hit[1]); }
    }
    plan.noSizes = false; plan.sizesFrom = 'mls';
    return plan;
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
