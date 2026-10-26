/* Open house flyer library: shared helpers for every library flyer (10/20/2026).
   Library flyers are extra 8.5 x 11 open house designs an agent can pick instead of their package's own flyer
   (docs/briefs/open-house-library-brief.md). They are drawn from data only, never from new copy.

   Each template loads ../ivory/ivory.js for the generic pieces (photo frames, open house fields, print checks)
   and this file for what the library adds:
     brand    three brand colors (main, accent, dark) from the agent's or team's brand kit; text on each flips
              white or near-black for contrast. CSS vars: --main --accent --dark --paper --ink, --on-main etc.
     event    the agent's own event wording (openHouse.label, remembered per agent) and the refreshment type
     contact  the shared agent card (templates/_shared/agentcard.js, 10/24/2026) + the one brokerage logo, no QR code
     check    Ivory's print checks plus: every size still 8 pt (6 pt fine print) after the home-print scale-down,
              and headline fitting within its box
   Data the library reads beyond Ivory's:
     brand.colors      {main, accent, dark}   (falls back to brand.accent / brand.ink)
     brand.logo        logo for light backgrounds; brand.logoOnDark for dark ones; brand.logoKnockout one-color white
     openHouse.label   the agent's wording ("REALTOR® Open House", "Broker Open House", "Open House", ...)
     openHouse.refreshmentType   luncheon | happy-hour | breakfast | sweets | other
     openHouse.refreshments      the agent's line (for "other", it is the whole refreshment text)
     food              {src, credit} the matching food photo picked from assets/food by refreshment type */
(function(){
  const OHL = {};
  const esc = s => Ivory.esc(s);
  // the standard contact card (templates/_shared/agentcard.js here, /designs/shared/agentcard.js on the site): ivory.js loads it
  OHL.cardReady = Ivory.cardReady;
  OHL.PRINT_SCALE = 576 / 612;   // home printers: the whole flyer is scaled to fit inside 0.25 in margins

  // ---------- color ----------
  const rgb = h => { h = String(h||'').replace('#',''); if(h.length===3) h = h.split('').map(c=>c+c).join(''); const n = parseInt(h,16); return [n>>16&255, n>>8&255, n&255]; };
  const lum = h => { const c = rgb(h).map(v => { v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; };
  OHL.contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
  OHL.WHITE = '#ffffff'; OHL.BLACK = '#161616';
  OHL.on = bg => OHL.contrast(bg, OHL.WHITE) >= OHL.contrast(bg, OHL.BLACK) ? OHL.WHITE : OHL.BLACK;
  // a brand color used as text on bg: kept when it reads (3:1 for large type), else white or black
  OHL.readable = (fg, bg, min) => OHL.contrast(fg, bg) >= (min||3) ? fg : OHL.on(bg);
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join(''); };
  OHL.mix = mix;

  OHL.colors = D => {
    const b = D.brand || {}, c = b.colors || {};
    const main = c.main || b.accent || '#2f4a3a', dark = c.dark || b.ink || '#1c1c1c', accent = c.accent || b.accent2 || main;
    return {main, accent, dark, paper: b.paper || mix(main, '#ffffff', .93)};
  };
  OHL.applyBrand = D => {
    const k = OHL.colors(D), r = document.documentElement.style;
    Object.entries(k).forEach(([n, v]) => { r.setProperty('--'+n, v); r.setProperty('--on-'+n, OHL.on(v)); });
    // accent as text on each field, only where it reads
    r.setProperty('--accent-on-dark', OHL.readable(k.accent, k.dark));
    r.setProperty('--accent-on-main', OHL.readable(k.accent, k.main));
    r.setProperty('--accent-on-paper', OHL.readable(k.accent, k.paper));
    r.setProperty('--main-on-paper', OHL.readable(k.main, k.paper));
    r.setProperty('--ink', OHL.BLACK);
    return k;
  };

  // ---------- event ----------
  const REFRESH = {luncheon:'Luncheon', 'happy-hour':'Happy Hour', breakfast:'Breakfast', sweets:'Sweets & Coffee', other:''};
  OHL.event = D => {
    const O = D.openHouse || {}, A = D.agent || {}, E = Ivory.openHouse(D);
    let label = String(O.label || '').trim().slice(0, 28) || E.label;
    if(/realtor/i.test(label) && !A.nar) label = 'Broker Open House';   // REALTOR(R) is for NAR members only
    label = label.replace(/REALTOR(?!®)/, 'REALTOR®');
    const type = E.kind !== 'public' && O.refreshmentType in REFRESH ? O.refreshmentType : '';
    return Object.assign(E, {label, refreshType: type,
      refreshTitle: type === 'other' ? '' : (REFRESH[type] || ''),
      refreshText: E.refreshments, hasRefresh: !!(type || E.refreshments)});
  };
  // the label as headline lines: "REALTOR® Open House" -> ["REALTOR®", "Open House"]; "Open House" -> ["Open", "House"]
  OHL.labelLines = (label, lines) => {
    const w = label.split(/\s+/);
    if(lines === 1 || w.length === 1) return [label];
    if(/open house$/i.test(label) && w.length > 2) return [w.slice(0,-2).join(' '), w.slice(-2).join(' ')];
    let best = null;
    for(let i=1;i<w.length;i++){ const a = w.slice(0,i).join(' '), b = w.slice(i).join(' '), d = Math.abs(a.length-b.length); if(!best || d < best.d) best = {d, l:[a,b]}; }
    return best.l;
  };

  // ---------- photos ----------
  // listing photos only (the food photo and floor plans never fill a house slot)
  OHL.photos = D => Ivory.photoOrder(D).filter(id => !/^food\b|floor ?plan/i.test((D.photos[id]||{}).tags||'') && !(D.photos[id]||{}).staged);
  // the hero: a full-house shot. want 'straight' (straight-on) or 'angled' (a corner view); the photo tagger marks
  // angled shots (photos.<id>.angled). Falls back to any full-house shot, then the first photo.
  OHL.hero = (D, want) => {
    const ids = OHL.photos(D), full = ids.filter(id => Ivory.fullHouse(D, id));
    const angled = id => !!(D.photos[id]||{}).angled;
    return full.find(id => want === 'angled' ? angled(id) : want === 'straight' ? !angled(id) : true) || full[0] || ids[0];
  };
  OHL.photo = (D, id, style, cls) => Ivory.photo(D, cls||'', id, style);
  // May a mask clear everything above `clear` (a fraction of the frame height) on this photo? Only when the photo's
  // house box proves the house ends above it (a full-house shot is pinned to its top). No box, no mask: the template
  // keeps a straight edge, so the house is never at risk.
  // The shortest a frame fw wide may get when a layout needs room (it gives up ground at the bottom of the photo).
  // Room photos may lose a fifth; a full-house shot only down to just below its house box; no box, no trim.
  OHL.minFrameH = (D, id, fw, fh) => {
    const p = (D.photos||{})[id] || {}, m = p.house;
    if(!Ivory.fullHouse(D, id)) return Math.round(fh*0.8);
    if(!m || !p.w || !p.h) return fh;
    // and never more than a quarter of the photo's height (Ivory's roofline rule)
    return Math.min(fh, Math.max(Math.ceil(m.bottom*fw*p.h/p.w + 6), Math.ceil(fw*p.h/p.w*0.755)));
  };
  // Where the house sits in a frame fw x fh (fractions of the frame), from the photo's house box and pixel size;
  // object-fit cover, pinned to the top, sideways by focusX. null when the photo has no box.
  OHL.houseInFrame = (D, id, fw, fh) => {
    const p = (D.photos||{})[id] || {}, m = p.house;
    if(!m || !p.w || !p.h) return null;
    const s = Math.max(fw/p.w, fh/p.h), iw = p.w*s, ih = p.h*s, fx = (p.focusX != null ? p.focusX : 50)/100;
    const ox = (fw - iw)*fx;
    return {left:(ox + m.left*iw)/fw, right:(ox + m.right*iw)/fw, top:m.top*ih/fh, bottom:m.bottom*ih/fh};
  };
  const inPoly = (x, y, poly) => {   // convex or not: ray casting
    let inside = false;
    for(let i = 0, j = poly.length-1; i < poly.length; j = i++){
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if(((yi > y) !== (yj > y)) && x < (xj - xi)*(y - yi)/(yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // Does the house sit wholly inside a polygon mask (points as fractions of the frame), with a small margin?
  // Rooms always fit; a full-house shot without a box never does (the template then keeps a plain frame).
  OHL.polyFits = (D, id, fw, fh, poly, margin) => {
    if(!Ivory.fullHouse(D, id)) return true;
    const b = OHL.houseInFrame(D, id, fw, fh); if(!b) return false;
    const g = margin == null ? .015 : margin;
    return [[b.left-g, b.top-g], [b.right+g, b.top-g], [b.right+g, b.bottom+g], [b.left-g, b.bottom+g]].every(([x, y]) => inPoly(x, y, poly));
  };
  // The frame for a house photo that may be at most maxH tall in a slot fw wide: full width when trimming ground is
  // enough, otherwise narrower at the same proportions (nothing more is cropped), centered by the template.
  // capTall: also never taller than the photo's own shape at that width (a taller frame would zoom in and crop the sides)
  OHL.fitHero = (D, id, fw, maxH, capTall) => {
    const min = OHL.minFrameH(D, id, fw, 99999);
    const p = (D.photos||{})[id] || {};
    if(capTall && p.w && p.h) maxH = Math.min(maxH, Math.floor(fw*p.h/p.w));
    return min <= maxH ? {w: fw, h: maxH} : {w: Math.round(fw*maxH/min), h: maxH};
  };
  OHL.maskFits = (D, id, fw, fh, clear) => OHL.polyFits(D, id, fw, fh, [[-1,-1],[2,-1],[2,clear-0.005],[-1,clear-0.005]], 0.015);
  // a clip-path polygon() from fraction points, and the matching data-poly for the check
  OHL.clip = poly => `clip-path:polygon(${poly.map(([x,y]) => `${(x*100).toFixed(2)}% ${(y*100).toFixed(2)}%`).join(',')})`;
  OHL.maskedPhoto = (D, id, style, poly) => OHL.photo(D, id, style + ';' + OHL.clip(poly)).replace('class="photo ', `data-poly="${poly.map(p=>p.join(' ')).join(',')}" class="photo `);

  // line icons, drawn in currentColor
  OHL.ICON = {
    bed:'<svg viewBox="0 0 24 24"><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/></svg>',
    bath:'<svg viewBox="0 0 24 24"><path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V5a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/></svg>',
    area:'<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 9h5M15 4v5M9 20v-5M20 15h-5"/></svg>',
    pin:'<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/></svg>',
    cal:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>'
  };
  OHL.icon = (name, size, color) => OHL.ICON[name].replace('<svg', `<svg style="width:${size}pt;height:${size}pt;stroke:${color||'currentColor'};fill:none;stroke-width:1.5;display:block"`);
  // the listing facts as [icon, value, label] for highlight rows
  OHL.factCells = L => {
    const f = [];
    if(L.beds) f.push(['bed', L.beds, L.beds == 1 ? 'Bedroom' : 'Bedrooms']);
    if(L.baths) f.push(['bath', L.baths + (L.halfBaths ? ' / ' + L.halfBaths : ''), L.halfBaths ? 'Full / half baths' : (L.baths == 1 ? 'Full bath' : 'Full baths')]);
    if(L.sqft) f.push(['area', Number(L.sqft).toLocaleString('en-US'), 'Square feet']);
    if(L.neighborhood) f.push(['pin', L.neighborhood, L.city || '']);
    return f;
  };

  // which logo version reads on a field of this color
  OHL.toneOn = bg => OHL.on(bg) === OHL.WHITE ? 'dark' : 'light';

  // ---------- logo ----------
  // tone: 'light' (logo on a light field), 'dark' (logoOnDark), 'knockout' (one-color white)
  // A brand kit without a dark or white version gets a white knockout of its logo made on the page.
  OHL.logo = (D, tone, style) => {
    const b = Object.assign({}, D.brand||{});
    let ko = false;
    if(tone === 'dark'){ ko = !b.logoOnDark && !b.logoKnockout; b.logo = b.logoOnDark || b.logoKnockout || b.logo; }
    if(tone === 'knockout'){ ko = !b.logoKnockout; b.logo = b.logoKnockout || b.logo; }
    const h = Ivory.logo(b, ko ? 'knockout' : '', style);
    return ko ? h.replace('<img ', '<img style="filter:brightness(0) invert(1)" ') : h;
  };

  // ---------- contact ----------
  // Every library flyer uses the standard Right panel contact card (owner, 10/25/2026; templates/_shared/agentcard.js):
  // the agent column, then the brokerage panel flush to the card's right edge, logo and office lines centered. With a
  // headshot the photo bleeds off the card's left edge; without one an accent stripe marks the edge and the card closes
  // up. A flyer styles it only through its own fonts (.oh-agent-name, .oh-agent rules, or nameFont/bodyFont) and colors;
  // the layout is the same on every flyer. Same box both ways, so nothing else on the flyer moves.
  // o: x, y, w, h (pt), tone ('light'|'dark'|'knockout': which logo version), nameSize (start size, pt), logoW, logoH
  //    (pt), logo false = the flyer shows its one logo elsewhere (no brokerage panel), color (text color), accent,
  //    field ('paper'|'main'|'dark': what the card sits on), nameFont, bodyFont
  // Which version: data.cardMode 'headshot' | 'none' (the publish gate renders both); otherwise the agent's own
  // choice on the proof (agent.cardPhoto 'with' | 'without', remembered), and never a photo when none is on file.
  OHL.cardMode = D => {
    const A = D.agent || {};
    if(!A.headshot) return 'none';
    if(D.cardMode === 'none' || D.cardMode === 'headshot') return D.cardMode;
    return A.cardPhoto === 'without' ? 'none' : 'headshot';
  };
  OHL.contact = (D, o) => {
    const field = o.field || (/on-main/.test(o.color || '') ? 'main' : /on-dark/.test(o.color || '') || o.tone === 'dark' || o.tone === 'knockout' ? 'dark' : 'paper');
    const ink = o.color || (field === 'paper' ? 'var(--ink)' : `var(--on-${field})`);
    const acc = o.accent || `var(--accent-on-${field})`;
    const b = Object.assign({}, D.brand || {});
    let ko = false;   // the logo version that reads on this field (as OHL.logo)
    if(o.tone === 'dark'){ ko = !b.logoOnDark && !b.logoKnockout; b.logo = b.logoOnDark || b.logoKnockout || b.logo; }
    if(o.tone === 'knockout'){ ko = !b.logoKnockout; b.logo = b.logoKnockout || b.logo; }
    const H = o.h || 62, name = Math.max(o.nameSize || 18, 18), pw = Math.max(150, o.logoW || 170), lh = Math.min(o.logoH || 46, H - 30);
    const s = {name, nameFloor: o.w < 420 ? 14 : 15, hsW: o.w < 420 ? 54 : Math.round(H * 0.74), panelW: pw, inlineLabel: H < 72, wrap: o.w < 420, lock: Math.max(9.5, name * 0.5 + 0.5),
               logo: {wide: [pw - 20, lh], square: [H - 34, H - 34], tall: [H - 32, H - 32]}};
    const A = Object.assign({}, D.agent || {}, {headshot: OHL.cardMode(D) === 'headshot' ? (D.agent || {}).headshot : ''});
    // on a colored band the card has no paper of its own: a hairline frame and a light veil of the text color for the panel
    const onField = field !== 'paper';
    const card = ContactCard.html([o.x, o.y, o.w, H], A, b, {layout: 'panel', size: 'short', s, grow: 6, floor: 8.6, bottomGap: 0.5, brokerage: o.logo !== false,
      logoStyle: ko ? 'filter:brightness(0) invert(1)' : '', panelBg: o.panelBg || (onField ? `color-mix(in srgb, ${ink} 10%, transparent)` : '')});
    const font = [o.nameFont ? `--cc-display:${o.nameFont}` : '', o.bodyFont ? `--cc-body:${o.bodyFont}` : ''].filter(Boolean).join(';');
    const look = `--cc-ink:${ink};--cc-muted:${ink};--cc-accent:${acc};` + (onField ? `--cc-paper:transparent;--cc-line:color-mix(in srgb, ${ink} 30%, transparent);` : '');
    return `<div class="oh-card" data-oh-card="${o.nameFont ? 'set' : ''}" data-name-weight="${o.nameWeight || ''}" style="${look}${font}">${card}</div>`;
  };
  // each card takes its flyer's fonts (and loads them: a font no text has asked for yet would measure as the fallback)
  OHL.cardFonts = () => {
    const want = new Set();
    document.querySelectorAll('[data-oh-card]').forEach(w => {
      if(w.dataset.ohCard !== 'set'){
        const pr = document.createElement('div'); pr.className = 'oh-agent'; pr.style.cssText = 'position:absolute;visibility:hidden';
        pr.innerHTML = '<div class="oh-agent-name">x</div>'; w.appendChild(pr);
        const b = getComputedStyle(pr), n = getComputedStyle(pr.firstChild);
        if(!w.style.getPropertyValue('--cc-body')) w.style.setProperty('--cc-body', b.fontFamily);
        w.style.setProperty('--cc-display', n.fontFamily); if(!w.dataset.nameWeight) w.dataset.nameWeight = n.fontWeight;
        pr.remove();
      }
      w.querySelectorAll('.cc-name').forEach(e => e.style.fontWeight = w.dataset.nameWeight || 400);
      const v = k => w.style.getPropertyValue(k).trim();
      want.add(`${w.dataset.nameWeight || 400} 20px ${v('--cc-display')}`);
      [400, 600, 700].forEach(wt => want.add(`${wt} 12px ${v('--cc-body')}`));
    });
    return Promise.all([...want].map(f => document.fonts.load(f).catch(() => 0)));
  };
  // then the shared fit (name, website, hyphen; the brokerage panel); its checks run with the print checks
  OHL.fitCards = () => {
    if(!window.ContactCard) return [{slot: 'agent', kind: 'agent-card-missing', detail: 'templates/_shared/agentcard.js did not load'}];
    ContactCard.fit(document);
    // no box behind the whole card (owner, 10/25): it sits on the flyer's own background. The panel keeps its accent tint,
    // worked out from the flyer's paper color (the fill is cleared after the fit; the card's hairline frame stays).
    document.querySelectorAll('.cc[data-contactcard]').forEach(c => { c.style.background = 'transparent'; });
    return [];
  };

  // ---------- type fitting ----------
  // A headline (the event label) may step down from max to min to fit its box; anything still too big is flagged
  // by the overflow check. Body copy never shrinks.
  OHL.fit = (el, max, min, step) => {
    let s = max; el.style.fontSize = s+'pt';
    const over = () => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    while(over() && s > min){ s = Math.max(min, s - (step||1)); el.style.fontSize = s+'pt'; if(el.dataset.lh) el.style.lineHeight = (s*+el.dataset.lh)+'pt'; }
    return s;
  };
  // headline lines set as one block: every line at the size of the widest (each fitted to its width, max..min),
  // stacked at k x size apart from top. Returns {size, bottom}.
  OHL.stack = (els, max, min, top, k) => {
    const s = Math.min(...els.map(el => OHL.fit(el, max, min)));
    els.forEach((el, i) => { el.style.fontSize = s+'pt'; el.style.lineHeight = (s*1.05)+'pt'; el.style.height = (s*1.1)+'pt'; el.style.top = (top + i*s*k)+'pt'; });
    return {size: s, bottom: top + (els.length-1)*s*k + s*1.1};
  };
  OHL.fitAll = () => document.querySelectorAll('[data-fit]').forEach(el => { const [mx, mn] = el.dataset.fit.split(',').map(Number); OHL.fit(el, mx, mn); });

  // ---------- page ----------
  // email: the design at trim, edge to edge. print: the same design scaled to sit inside 0.25 in white margins
  // (agents print 8.5 x 11 at home or the office; no bleed there).
  OHL.frame = (D, inner) => {
    const print = D.mode === 'print';
    const s = print ? OHL.PRINT_SCALE : 1, W = 612, H = 792;
    const dx = (W - W*s)/2, dy = (H - H*s)/2;
    return { W, H, bleed: 0, html: `<div class="page" data-page="${esc(D.piece.id)}" style="width:${W}pt;height:${H}pt;background:${print?'#fff':'var(--paper)'}">
      <div class="sheet" style="left:${dx}pt;top:${dy}pt;width:${W}pt;height:${H}pt;transform:scale(${s});transform-origin:0 0">${inner}</div></div>` };
  };

  // ---------- checks ----------
  OHL.check = extra => {
    const issues = Ivory.check(extra);
    // TREC broker size (logo at least half the agent-name size, after the card's fit) and a logo never stretched
    const logos = [...document.querySelectorAll('.logo img')].filter(i => i.offsetParent);
    if(window.AgentCard) issues.push(...AgentCard.trec(document, logos.filter(i => !i.closest('.cc'))), ...AgentCard.logoCheck(logos));
    document.querySelectorAll('[data-slot]').forEach(el => {
      const r = el.getBoundingClientRect(); if(!r.width || !r.height) return;
      const size = parseFloat(getComputedStyle(el).fontSize)*72/96, printed = size*OHL.PRINT_SCALE;
      if(printed < 8 && !el.dataset.fine) issues.push({slot:el.dataset.slot, kind:'type-too-small-printed', size:+printed.toFixed(1)});
      if(printed < 6) issues.push({slot:el.dataset.slot, kind:'fine-print-below-6pt-printed', size:+printed.toFixed(1)});
    });
    // No two pieces of text touch: compares where the words actually are (not their boxes).
    const leaves = [...document.querySelectorAll('[data-slot]')].filter(el => !el.querySelector('[data-slot]') && el.offsetWidth);
    // a text run's box holds empty room above the capitals and below the baseline; keep the letters only
    // (top 24% and bottom 14% of the font size off)
    const ink = el => { const r = document.createRange(); r.selectNodeContents(el); const fs = parseFloat(getComputedStyle(el).fontSize);
      return [...r.getClientRects()].filter(q => q.width > 1 && q.height > 1).map(q => {
        const mid = (q.top + q.bottom)/2, top = Math.min(mid, q.top + (q.height - fs)/2 + fs*.24), bottom = Math.max(mid, q.bottom - (q.height - fs)/2 - fs*.14);
        return {left:q.left, right:q.right, top, bottom}; }); };
    const boxes = leaves.map(el => ({el, rs: ink(el)}));
    for(let i = 0; i < boxes.length; i++) for(let j = i+1; j < boxes.length; j++){
      const a = boxes[i], b = boxes[j];
      if(a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const hit = a.rs.some(p => b.rs.some(q => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 2 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 2));
      if(hit) issues.push({slot:a.el.dataset.slot, kind:'text-overlap', detail:'runs into ' + b.el.dataset.slot});
      // fine print sits close to other lines, so it must keep at least 1 pt clear of their letters
      else if(a.el.dataset.fine || b.el.dataset.fine){
        const close = a.rs.some(p => b.rs.some(q => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 2 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > -1.33));
        if(close) issues.push({slot:a.el.dataset.slot, kind:'text-overlap', detail:'touches ' + b.el.dataset.slot});
      }
    }
    // Never cut off the house. A full-house photo's tags may carry the house's box in the original
    // (photos.<id>.house = {left, top, right, bottom}, fractions of the image). The check maps it into the frame
    // (object-fit cover, pinned to the top) and flags it when any corner falls outside the frame or its mask:
    // data-poly="x y,x y,..." (fractions of the frame) or data-clear="left,top,right,bottom".
    document.querySelectorAll('.photo[data-fullhouse]').forEach(el => {
      const id = el.dataset.photo, masked = el.dataset.poly || el.dataset.clear;
      const box = OHL.houseInFrame(D, id, el.clientWidth, el.clientHeight);
      if(!box){ if(masked) issues.push({slot:id, kind:'house-box-unknown', detail:'a masked frame needs the house box (use OHL.polyFits)'}); return; }
      let poly;
      if(el.dataset.poly) poly = el.dataset.poly.split(',').map(p => p.trim().split(/\s+/).map(Number));
      else { const c = (el.dataset.clear||'0,0,1,1').split(',').map(Number); poly = [[c[0],c[1]],[c[2],c[1]],[c[2],c[3]],[c[0],c[3]]]; }
      const g = .002, corners = {'top left':[box.left+g, box.top+g], 'top right':[box.right-g, box.top+g], 'bottom right':[box.right-g, box.bottom-g], 'bottom left':[box.left+g, box.bottom-g]};
      const cut = Object.entries(corners).filter(([, [x, y]]) => !inPoly(x, y, poly)).map(([k]) => k);
      if(cut.length) issues.push({slot:id, kind:'house-cut', detail:'house cut at the '+cut.join(', ')});
    });
    return issues;
  };
  let D = null;
  OHL.start = (fonts, build) => {
    D = Ivory.data();
    if(!D.listing){ document.getElementById('pages').innerHTML = '<p style="padding:20pt">No data injected.</p>'; return; }
    window.brochureReady = Promise.all([...fonts.map(f => document.fonts.load(f)), OHL.cardReady]).catch(()=>{}).then(() => {
      OHL.applyBrand(D);
      const f = build(D);
      document.getElementById('pages').innerHTML = f.html;
      Ivory.shapeLogos();
      OHL.fitAll();
      // the agent card fits once its logo and headshot have loaded (the hairline sits where the logo is drawn)
      const imgs = [...document.querySelectorAll('.cc img')].map(i => i.complete ? 0 : new Promise(r => { i.addEventListener('load', r, {once:true}); i.addEventListener('error', r, {once:true}); }));
      return Promise.all(imgs).then(OHL.cardFonts).then(() => document.fonts.ready).then(() => {
        const card = OHL.fitCards();
        if(f.after) f.after();
        window.pieceSize = {W:f.W, H:f.H, bleed:0};
        window.brochureCheck = () => OHL.check((f.issues||[]).concat(card));
      });
    });
  };

  window.OHL = OHL;
})();
