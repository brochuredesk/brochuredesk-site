/* Ivory design: shared helpers for every piece.
   Brand, captions, the contact card and the print checks live here so all pieces behave the same. */
(function(){
  const Ivory = {};
  // the standard contact card (Right panel, 10/25/2026): templates/_shared/agentcard.js here, /designs/shared/agentcard.js on the site
  const ME = document.currentScript && document.currentScript.src;
  Ivory.cardReady = window.ContactCard ? Promise.resolve() : new Promise(res => {
    const add = (rel, next) => { const el = document.createElement('script'); el.src = new URL(rel, ME || location.href).href; el.onload = res; el.onerror = next || res; document.head.appendChild(el); };
    add('../_shared/agentcard.js', () => add('../shared/agentcard.js'));
  });

  Ivory.data = function(){
    return JSON.parse(document.getElementById('brochure-data').textContent || '{}');
  };

  // Brand comes from the agent's profile. The accent is the agent's brand color.
  Ivory.applyBrand = function(b){
    b = b || {};
    const root = document.documentElement.style;
    if(b.accent) root.setProperty('--accent', b.accent);
    if(b.paper)  root.setProperty('--paper',  b.paper);
    if(b.ink)    root.setProperty('--ink',    b.ink);
    if(b.muted)  root.setProperty('--muted',  b.muted);
    if(b.fontDisplay) root.setProperty('--font-display', b.fontDisplay);
    if(b.fontBody)    root.setProperty('--font-body',    b.fontBody);
    if(b.fontFaces){ const s=document.createElement('style'); s.textContent=b.fontFaces; document.head.appendChild(s); }
  };

  Ivory.esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const esc = Ivory.esc;

  Ivory.src = (D, id) => (D.photos && D.photos[id] && D.photos[id].src) || '';

  // A full-house shot (front, back or side of the whole house) never loses its roof: frames may crop the sides,
  // never the top, so the photo is pinned to its top edge and any height it has to lose comes off the ground.
  Ivory.fullHouse = (D, id) => {
    const p = (D.photos||{})[id] || {};
    if(p.fullHouse != null) return !!p.fullHouse;
    return /\b(front|rear|back|side) exterior\b|\bfull house\b/i.test(p.tags||'');
  };
  Ivory.fit = (D, id) => {
    if(!id) return '';
    const p = (D.photos||{})[id] || {};
    const fx = p.focusX != null ? p.focusX : 50;
    if(Ivory.fullHouse(D, id)) return `object-position:${fx}% 0%`;
    if(p.focusY != null || p.focusX != null) return `object-position:${fx}% ${p.focusY != null ? p.focusY : 50}%`;
    return '';
  };
  // Where each photo prints and how big (inches), so the renderer can enlarge any that would print under 300 ppi.
  window.photoPlacements = () => [...document.querySelectorAll('.photo img')].map(img => {
    const el = img.parentElement; return {src: img.getAttribute('src'), w: el.clientWidth/96, h: el.clientHeight/96};
  });

  Ivory.photo = (D, cls, id, style) =>
    `<div class="photo ${cls||''}" data-photo="${esc(id)}"${Ivory.fullHouse(D,id)?' data-fullhouse="1"':''} style="${style||''}">${id && Ivory.src(D,id) ? `<img src="${esc(Ivory.src(D,id))}" alt="" style="${Ivory.fit(D,id)}">` : ''}</div>`;

  // Which of the 8 property type versions this listing gets (template readiness standard, section 8).
  // Story count from the listing data (or the plan's level count); plan = a redrawn plan with at least one level.
  Ivory.version = D => {
    const L = D.listing || {};
    const real = !!(D.plan && D.plan.levels && D.plan.levels.length);
    // the rough-draft preview's simple plan (D.planPreview, one image per floor) picks the plan version too
    const pre = !real && !!(D.planPreview && D.planPreview.length), plan = real || pre;
    const levels = real ? D.plan.levels.filter(l=>!l.garageApartment).length : pre ? D.planPreview.length : 0;
    const stories = Math.max(1, Math.min(4, Math.round(+L.stories || levels || 1)));
    return {stories, plan, id: `${stories}-story-${plan ? 'plan' : 'noplan'}`};
  };

  // The appraisal district that the size facts come from, named by county.
  const DISTRICTS = {harris:'HCAD', galveston:'GCAD', brazoria:'BCAD', 'fort bend':'FBCAD', montgomery:'MCAD',
                     chambers:'CCAD', waller:'WCAD', liberty:'LCAD', bexar:'BCAD', travis:'TCAD', dallas:'DCAD', tarrant:'TAD'};
  Ivory.district = L => L.district || DISTRICTS[String(L.county||'').toLowerCase().replace(/ county$/,'')] || '';

  // Logo, or the brokerage name set in type when there is no logo file.
  Ivory.logo = (b, cls, style) =>
    `<div class="logo ${cls||''}" style="${style||''}">${b && b.logo ? `<img src="${esc(b.logo)}" alt="">` : `<span class="text">${esc((b && b.brokerage)||'')}</span>`}</div>`;

  const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  // Caption = bold room name + one short detail line. Written captions win; otherwise both come
  // from the photo's tags (first tag = room name, the next tags = the detail line).
  Ivory.caption = function(D, id){
    const p = (D.photos||{})[id] || {};
    if(p.caption && p.caption.name) return {name: p.caption.name, detail: p.caption.detail || ''};
    const tags = String(p.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
    const name = cap1(tags[0] || '');
    let detail = '';
    for(const t of tags.slice(1)){
      const next = detail ? detail + ', ' + t : t;
      if(next.length > 34) break;
      detail = next;
    }
    return {name, detail: cap1(detail)};
  };

  Ivory.captionHTML = (D, id, x, y, w, slot) => {
    const c = Ivory.caption(D, id);
    // an untagged photo before the package is written: faint lines, never an empty gap
    if(!c.name && D.copyPending) return Ivory.ghost(x, y, w*0.55, 1, 10.5) + Ivory.ghost(x, y+11, w*0.8, 1, 10);
    return `<div class="abs cap-name" style="left:${x}pt;top:${y}pt;width:${w}pt;height:10.5pt" data-slot="${slot}.name" data-lines="1">${esc(c.name)}</div>`
         + `<div class="abs cap-detail" style="left:${x}pt;top:${y+11}pt;width:${w}pt;height:10pt" data-slot="${slot}.detail" data-lines="1">${esc(c.detail)}</div>`;
  };

  // Faint lines in place of copy that hasn't been written yet.
  // The open house flyers' optional lines (special notes, refreshments) wrap instead of shrinking. eventLines measures
  // how many lines each needs at its own size in a column w pt wide and returns the HTML plus the height used.
  // lines: [[text, slot, cls], ...] (empty texts skipped); each block gets data-lines = the lines it needs, so the
  // print checks still catch anything that runs past them.
  Ivory.linesNeeded = (cls, text, w, lh) => {
    const m = document.createElement('div');
    m.className = cls; m.textContent = text;
    m.style.cssText = `position:absolute;left:-9999pt;top:0;visibility:hidden;width:${w}pt;height:auto;white-space:normal;overflow:visible`;
    document.body.appendChild(m); const n = Math.max(1, Math.round(m.scrollHeight*72/96/lh)); m.remove(); return n;
  };
  Ivory.eventLines = (lines, x, y, w, lh, gap, extraStyle) => {
    let h = '', at = y;
    lines.filter(l=>l[0]).forEach(([text, slot, cls])=>{
      const n = Ivory.linesNeeded(cls, text, w, lh);
      h += `<div class="abs ${cls}" style="left:${x}pt;top:${at}pt;width:${w}pt;height:${n*lh}pt;white-space:normal;${extraStyle||''}" data-slot="${slot}" data-lines="${n}">${Ivory.esc(text)}</div>`;
      at += n*lh + (gap||0);
    });
    return {html: h, h: at > y ? at - y - (gap||0) : 0};
  };

  Ivory.ghost = (x, y, w, lines, lh) => {
    let h = '';
    const widths = [100, 96, 99, 92, 97, 88, 95, 100, 90, 62];
    for(let i=0;i<lines;i++){ const last = i===lines-1; h += `<i style="width:${last?58:widths[i%widths.length]}%;margin-top:${i?(lh-3.2):(lh-3.2)/2}pt"></i>`; }
    return `<div class="ghost" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${lines*lh}pt">${h}</div>`;
  };

  // Body text, or faint lines when the copy is still pending.
  Ivory.text = (D, text, x, y, w, lines, lh, size, slot) => {
    if(D.copyPending || !text) return Ivory.ghost(x, y, w, lines, lh);
    return `<div class="abs body" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${lines*lh}pt;font-size:${size}pt;line-height:${lh}pt" data-slot="${slot}" data-lines="${lines}">${esc(text)}</div>`;
  };

  Ivory.facts = L => {
    const f = [];
    if(L.beds) f.push(`${L.beds} bedroom${L.beds==1?'':'s'}`);
    if(L.baths) f.push(`${L.baths} full bath${L.baths==1?'':'s'}`);
    if(L.halfBaths) f.push(`${L.halfBaths} half bath${L.halfBaths==1?'':'s'}`);
    if(L.sqft) f.push(`${Number(L.sqft).toLocaleString('en-US')} square feet`);
    return f;
  };
  Ivory.factsShort = L => {
    const f = [];
    if(L.beds) f.push(`${L.beds} bed${L.beds==1?'':'s'}`);
    if(L.baths) f.push(`${L.baths} full bath${L.baths==1?'':'s'}`);
    if(L.halfBaths) f.push(`${L.halfBaths} half`);
    if(L.sqft) f.push(`${Number(L.sqft).toLocaleString('en-US')} sq ft`);
    return f.join('  /  ');
  };
  const ST = {alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',
    'district of columbia':'DC',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',
    kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',
    missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY',
    'north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI',
    'south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',washington:'WA',
    'west virginia':'WV',wisconsin:'WI',wyoming:'WY'};
  // "Houston, TX": city and two-letter state (Open House v5 city line, 10/25/2026)
  Ivory.cityST = L => [L.city, ST[String(L.state||'').trim().toLowerCase()] || L.state].filter(Boolean).join(', ');
  Ivory.place = L => [L.city, L.state].filter(Boolean).join(', ');   // city and state only, no neighborhood or ZIP (owner, 10/21/2026)

  // Photos for the companion pieces: written order if given, else listing order (exterior first).
  Ivory.photoOrder = function(D){
    const P = D.photos || {};
    const ids = (D.companion && D.companion.photos) || Object.keys(P).filter(id => !/floor ?plan/i.test(P[id].tags||''));
    return ids.filter(id => Ivory.src(D, id));
  };

  /* Contact card for the companion pieces: the standard Right panel card (templates/_shared/agentcard.js, 10/25/2026).
     opts: x, y, w, h (pt), layout ('panel' / 'band'; default by width), grow (pt it may grow upward), s (size overrides).
     The card carries the piece's one brokerage logo. */
  Ivory.card = function(D, o){
    const A = D.agent || {}, hs = Ivory.src(D, A.headshot) || (/^(file|https?|data):/.test(A.headshot || '') ? A.headshot : '');
    return ContactCard.html([o.x, o.y, o.w, o.h], Object.assign({}, A, {headshot: hs}), D.brand || {}, {layout: o.layout, grow: o.grow || 0, s: o.s, bottomGap: 0.5});
  };

  // Lay out every contact card (the card's own fitting); the print checks read the cards at check time (Ivory.check)
  Ivory.layoutCards = function(){ ContactCard.fit(document); return []; };


  // MLS room sizes for a postcard back: living spaces, kitchen, primary, then the other bedrooms (numbered), at most n rows
  Ivory.roomRows = (L, n) => {
    const rs = (L.rooms || []).filter(r => r && r.name && r.size && !/bath|closet|utility|laundry|garage|covered|porch|patio|structure/i.test(r.name));
    const rank = r => /living|family|great|game|media/i.test(r.name) ? 0 : /kitchen/i.test(r.name) ? 1 : /primary|master/i.test(r.name) ? 2 : /^bed/i.test(r.name) ? 3 : /dining/i.test(r.name) ? 4 : 5;
    let bed = 1;
    const out = rs.map((r, i) => ({r, i})).sort((a, c) => rank(a.r) - rank(c.r) || a.i - c.i).map(({r}) => {
      let nm = r.name.replace(/^Living$/i, 'Living room').replace(/^Primary Bedroom$/i, 'Primary bedroom');
      if(/^bedroom$/i.test(r.name)){ bed += 1; nm = 'Bedroom ' + bed; }
      return [nm, r.size]; });
    return out.slice(0, n);
  };

  /* Footer print checks (owner, 10/25/2026, every footer on every piece):
     1. The agent's contact info never touches the bottom line: every line's box ends at least 0.5 pt above the card's
        bottom edge (its rule); a line running onto the edge fails, and the card keeps at least 4 pt above the trim (the field edge on flyers).
     2. The brokerage logo and contact are centered in their own space (the tinted panel or band), within 1.5 pt,
        whatever the agent's name. */
  Ivory.footerChecks = function(){
    const issues = [], PT = 96/72;
    document.querySelectorAll('.cc[data-contactcard]').forEach(card => {
      const k = card.getBoundingClientRect().height / card.offsetHeight || 1, r = card.getBoundingClientRect();
      const toPt = px => px / k / PT;
      const vis = e => !!(e.offsetParent || e.getClientRects().length);
      let low = -1e9;
      card.querySelectorAll('.cc-agent *, .cc-panel *').forEach(e => {
        if(!vis(e) || ![...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) return;
        const rg = document.createRange(); rg.selectNodeContents(e);
        [...rg.getClientRects()].forEach(q => { if(q.width) low = Math.max(low, q.bottom); }); });
      const gap = toPt(r.bottom - low);
      if(low > -1e9 && gap < 0.5) issues.push({slot:'contact-card', kind:'footer-touches-bottom-line', gapPt:+gap.toFixed(2), detail:'contact text runs onto the card bottom'});
      const sheet = card.closest('.sheet') || card.closest('.page');
      if(sheet){ const sr = sheet.getBoundingClientRect(), field = document.querySelector('.field');
        const edge = (document.body.dataset.mode === 'print' && field && field.getBoundingClientRect().bottom < sr.bottom) ? field.getBoundingClientRect().bottom : sr.bottom;
        const g2 = toPt(edge - r.bottom);
        if(g2 < 4) issues.push({slot:'contact-card', kind:'footer-too-close-to-edge', gapPt:+g2.toFixed(1)}); }
      const panel = card.querySelector('.cc-panel');
      if(panel && vis(panel)){
        const pr = panel.getBoundingClientRect(), kids = [...panel.children].filter(vis);
        if(kids.length){
          const bx = kids.map(e => e.getBoundingClientRect());
          // content box: the logo image's drawn box and each office line's text, not their full-width containers
          const parts = [];
          panel.querySelectorAll('img, .cc-office, .cc-lock, .cc-brkname').forEach(e => { if(!vis(e)) return;
            if(e.tagName === 'IMG'){ parts.push(e.getBoundingClientRect()); return; }
            const rg = document.createRange(); rg.selectNodeContents(e); [...rg.getClientRects()].forEach(q => q.width && parts.push(q)); });
          const L = Math.min(...parts.map(q => q.left)), R = Math.max(...parts.map(q => q.right));
          const T = Math.min(...bx.map(q => q.top)), B = Math.max(...bx.map(q => q.bottom));
          const dx = toPt(((L - pr.left) - (pr.right - R)) / 2), dy = toPt(((T - pr.top) - (pr.bottom - B)) / 2);
          if(Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) issues.push({slot:'contact-card', kind:'brokerage-not-centered', dxPt:+dx.toFixed(1), dyPt:+dy.toFixed(1)});
        } }
    });
    return issues;
  };

  // Print checks, read by the renderer: overflow per slot, type under 8 pt (6 pt for fine print),
  // photos under 300 ppi at print size, empty or missing photos.
  Ivory.check = function(extra){
    const issues = [...(extra||[]), ...Ivory.fontIssues, ...(window.ContactCard ? ContactCard.check(document) : []), ...Ivory.footerChecks()];
    // rough-draft preview text and the preview plan never reach a paid or downloaded piece (10/25/2026)
    const PD = Ivory.data() || {};
    if(PD.preview) issues.push({slot:'copy', kind:'preview-text', detail:'rough-draft preview lines; the writer has not run'});
    if(PD.planPreview && PD.planPreview.length) issues.push({slot:'plan', kind:'preview-plan', detail:'simple preview plan; the redraw has not run'});
    document.querySelectorAll('[data-slot]').forEach(el=>{
      const name = el.dataset.slot, cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize)*72/96;
      const oneLine = cs.whiteSpace === 'nowrap';
      if(oneLine ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1)
        issues.push({slot:name, kind:'overflow', text:el.textContent.slice(0,80)});
      if(size < 8 && !el.dataset.fine) issues.push({slot:name, kind:'type-too-small', size:+size.toFixed(1)});
      if(size < 6) issues.push({slot:name, kind:'fine-print-below-6pt', size:+size.toFixed(1)});
      // fill target (10/21/2026): a text block with data-fill="n" needs at least n lines, and when it stops at
      // exactly n the last line runs at least 75% of the width (owner 10/26: every box filled, last line at least 3/4). Short copy comes back to the writer to be filled out.
      const need = +el.dataset.fill || 0;
      if(need && el.textContent.trim()){
        const rg = document.createRange(); rg.selectNodeContents(el);
        const rows = []; [...rg.getClientRects()].forEach(r=>{ const row = rows.find(x=>Math.abs(x.top - r.top) < 2); if(row) row.right = Math.max(row.right, r.right); else rows.push({top:r.top, left:r.left, right:r.right}); });
        const box = el.getBoundingClientRect(), last = rows[rows.length-1];
        const lastFill = last ? (last.right - box.left) / box.width : 0;
        if(rows.length < need || (rows.length === need && lastFill < 0.75))
          issues.push({slot:name, kind:'underfilled', lines:rows.length, need, lastLine:Math.round(lastFill*100)+'%', detail:`write it out to ${need} full lines`});
      }
    });
    // a brokerage logo never touches text (owner 10/26: the inside-top header logo ran into a long title). The drawn
    // logo (image, or the typeset name) needs 3 pt clear of every line of text outside its own box.
    const pad = 3*96/72, textRects = [];
    document.querySelectorAll('[data-slot]').forEach(el=>{ if(el.closest('.logo') || !el.textContent.trim()) return;
      const rg = document.createRange(); rg.selectNodeContents(el);
      [...rg.getClientRects()].filter(r=>r.width > .5 && r.height > .5).forEach(r=>textRects.push({slot:el.dataset.slot, r})); });
    document.querySelectorAll('.logo img, .logo .text').forEach(lg=>{ if(lg.closest('.card,[data-card]')) return;
      const q = lg.getBoundingClientRect(); if(!q.width) return;
      const hit = textRects.find(({r})=> r.left < q.right + pad && r.right > q.left - pad && r.top < q.bottom + pad && r.bottom > q.top - pad);
      if(hit) issues.push({slot:hit.slot, kind:'logo-touches-text', detail:'the brokerage logo runs into this text'}); });
    // no photo twice in one piece unless the listing is short on photos
    const D = Ivory.data(), seen = {};
    document.querySelectorAll('.photo[data-photo]').forEach(el=>{ const id = el.dataset.photo; if(id) seen[id] = (seen[id]||0) + 1; });
    if(!D.allowRepeats) Object.entries(seen).filter(([,n])=>n>1).forEach(([id,n])=>issues.push({slot:id, kind:'photo-repeated', times:n}));
    document.querySelectorAll('.photo').forEach(el=>{
      const img = el.querySelector('img');
      if(!img){ issues.push({slot:el.dataset.photo||'photo', kind:'empty-photo-slot'}); return; }
      if(!img.complete || !img.naturalWidth){ issues.push({slot:img.getAttribute('src'), kind:'photo-missing'}); return; }
      const wIn = el.clientWidth/96, hIn = el.clientHeight/96;
      const ppi = Math.min(img.naturalWidth/wIn, img.naturalHeight/hIn);
      if(ppi < 300) issues.push({slot:el.dataset.photo, kind:'photo-under-300ppi', ppi:Math.round(ppi), placedIn:[+wIn.toFixed(2),+hIn.toFixed(2)]});
      // the photo tagger marks full-house shots whose roof is already cut in the original; those never go in a frame
      const meta = (D.photos||{})[el.dataset.photo] || {};
      if(meta.roofCut) issues.push({slot:el.dataset.photo, kind:'roof-cut-in-original', detail:'pick a photo that shows the whole roof, or ask the agent for one'});
      // roofline: a full-house shot is pinned to its top; flag it when the frame is so much wider than the photo
      // that more than a quarter of the height comes off (the house itself, not just ground, would be cut)
      if(el.dataset.box === '0') issues.push({slot:el.dataset.photo, kind:'house-box-cut', detail:'the whole house does not fit this frame'});
      if(el.dataset.fullhouse && !el.dataset.box){
        const fr = el.clientWidth/el.clientHeight, ir = img.naturalWidth/img.naturalHeight;
        const lost = fr > ir ? 1 - ir/fr : 0;
        if(lost > 0.25) issues.push({slot:el.dataset.photo, kind:'full-house-frame-too-wide', heightCropped:Math.round(lost*100)+'%'});
      }
    });
    return issues;
  };

  // Page frame for single-page pieces.
  //   email: the ivory field runs edge to edge at trim size
  //   print (flyers): same page size, white margin around the ivory field
  //   print (postcards): trim + bleed on every edge, TrimBox set by the renderer
  Ivory.frame = function(D, trimW, trimH, inner){
    const mode = D.mode || 'email';
    const bleed = (mode==='print' && D.piece.print==='bleed') ? 9 : 0;
    const inset = (mode==='print' && D.piece.print==='margin') ? (D.piece.margin||18) : 0;
    const W = trimW + 2*bleed, H = trimH + 2*bleed;
    document.documentElement.style.setProperty('--inset', inset+'pt');
    return { W, H, bleed, inset,
      html: `<div class="page" data-page="${esc(D.piece.id)}" style="width:${W}pt;height:${H}pt">
        <div class="field" style="left:${inset}pt;top:${inset}pt;right:${inset}pt;bottom:${inset}pt"></div>
        <div class="sheet" style="left:${bleed}pt;top:${bleed}pt;width:${trimW}pt;height:${trimH}pt">${inner}</div>
      </div>` };
  };

  // A rule that runs the full width of the ivory field (into the bleed on postcards).
  Ivory.fullRule = (D, trimW, y) => {
    const mode = D.mode || 'email';
    const bleed = (mode==='print' && D.piece.print==='bleed') ? 9 : 0;
    const inset = (mode==='print' && D.piece.print==='margin') ? (D.piece.margin||18) : 0;
    return `<div class="rule" style="left:${inset-bleed}pt;width:${trimW-2*inset+2*bleed}pt;top:${y}pt"></div>`;
  };

  // Build the page only after the design's fonts are loaded, so every measurement (contact card columns,
  // long addresses, plan labels) uses the real type. The renderer waits for window.brochureCheck.
  // An agent's font picks (brand.fonts: {display, body}, pool ids) are applied first, but only fonts on Ivory's approved
  // list (fonts.json, built by scripts/approve_fonts.py); anything else keeps the original and is listed in the checks.
  Ivory.fontBase = '../../fonts/pool/';
  Ivory.fontIssues = [];
  Ivory.applyFonts = async function(D, spec){
    const want = (D.brand && D.brand.fonts) || {}, issues = [];
    const roles = {display: ['--font-display', 'Georgia,serif'], body: ['--font-body', 'Helvetica,Arial,sans-serif']};
    for(const role of Object.keys(roles)){
      const o = spec && spec.originals && spec.originals[role], id = want[role];
      if(!id || (o && id === o.id)) continue;
      if(!o || !(o.approved || []).includes(id)){ issues.push({slot:'fonts.'+role, kind:'font-not-approved', detail:id}); continue; }
      const fam = 'iv-' + id, have = (spec.weights && spec.weights[id]) || [400,500,600,700];
      const faces = (o.weightsNeeded || [o.weight]).map(w => {
        const near = have.reduce((a,b) => Math.abs(b-w) < Math.abs(a-w) ? b : a);
        const f = new FontFace(fam, `url(${Ivory.fontBase}${id}-latin-${near}-normal.woff2)`, {weight:String(w)});
        document.fonts.add(f); return f.load();
      });
      try { await Promise.all(faces); document.documentElement.style.setProperty(roles[role][0], `'${fam}',${roles[role][1]}`); }
      catch(e){ issues.push({slot:'fonts.'+role, kind:'font-load-failed', detail:id}); }
    }
    return issues;
  };

  Ivory.whenFonts = fn => {
    const D = Ivory.data();
    const spec = D.fontSpec ? Promise.resolve(D.fontSpec) : fetch('fonts.json').then(r => r.json()).catch(() => null);
    window.brochureReady = spec.then(s => Ivory.applyFonts(D, s)).then(issues => {
      Ivory.fontIssues = issues;
      const cs = getComputedStyle(document.documentElement), d = cs.getPropertyValue('--font-display'), b = cs.getPropertyValue('--font-body');
      return Promise.all([`400 10pt ${d}`, `400 10pt ${b}`, `600 10pt ${b}`, `700 10pt ${b}`].map(f => document.fonts.load(f)).concat(Ivory.cardReady));
    }).then(fn, fn);
  };

  // Logo shape: square and tall logos get a taller box than wide lockups so all shapes read at a similar size.
  // Each piece's CSS sets the box per shape ([data-shape=square|tall]); wide logos keep the default box.
  Ivory.shapeLogos = () => document.querySelectorAll('.logo img').forEach(img => {
    const set = () => { const r = img.naturalWidth / img.naturalHeight; if(r) img.parentElement.dataset.shape = r < 0.85 ? 'tall' : r < 1.6 ? 'square' : 'wide'; };
    if(img.complete) set(); else img.addEventListener('load', set);
  });

  /* Open house fields for the open house flyers. Everything comes from data: nothing is invented.
       label    Public / Broker / REALTOR(R) Open House (REALTOR(R) only for NAR members, else Broker)
       long     "Saturday, November 7"       weekday "Saturday"   monthDay "November 7"
       month    "November"  monthShort "Nov"  day "7"  (empty when the date isn't an ISO date; long then shows the raw text)
       time     "1:00 to 4:00 pm" (or openHouse.timeText as written)
       note          openHouse.note (special notes: RSVP, door prize, co-op terms), agent-entered
       refreshments  openHouse.refreshments, agent-entered
       Both lines show only on broker and REALTOR(R) opens and only when filled; a public open house shows date and time only.
       (openHouse.coop from the 10/19 drafts is read as the note when no note is set.)  */
  Ivory.openHouse = function(D){
    const O = D.openHouse || {}, A = D.agent || {};
    const kinds = {public:'Public Open House', broker:'Broker Open House', realtor:'REALTOR® Open House'};
    let kind = O.kind in kinds ? O.kind : 'public';
    if(kind==='realtor' && !A.nar) kind = 'broker';
    const r = {kind, label:kinds[kind], long:'', weekday:'', monthDay:'', month:'', monthShort:'', day:'', time:'', note:'', refreshments:''};
    if(kind!=='public'){ r.note = String(O.note||O.coop||'').trim(); r.refreshments = String(O.refreshments||'').trim(); }
    const dt = /^\d{4}-\d{2}-\d{2}$/.test(O.date||'') ? new Date(O.date+'T12:00:00') : null;
    if(dt && !isNaN(dt)){
      const f = o => dt.toLocaleDateString('en-US', o);
      r.weekday = f({weekday:'long'}); r.month = f({month:'long'}); r.monthShort = f({month:'short'}); r.day = f({day:'numeric'});
      r.monthDay = `${r.month} ${r.day}`; r.long = `${r.weekday}, ${r.monthDay}`;
    } else if(O.date){ r.long = String(O.date); }
    const t12 = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s||''); if(!m) return null; let H=+m[1]; const M=+m[2]; const ap=H>=12?'pm':'am'; H=H%12||12; return {txt:M?`${H}:${String(M).padStart(2,'0')}`:`${H}:00`, ap}; };
    const a = t12(O.start), z = t12(O.end);
    if(O.timeText) r.time = String(O.timeText);
    else if(a && z) r.time = a.ap===z.ap ? `${a.txt} to ${z.txt} ${z.ap}` : `${a.txt} ${a.ap} to ${z.txt} ${z.ap}`;
    else if(a) r.time = `${a.txt} ${a.ap}`;
    return r;
  };

  window.Ivory = Ivory;
})();
