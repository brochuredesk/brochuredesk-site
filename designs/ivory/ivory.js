/* Ivory design: shared helpers for every piece.
   Brand, captions, the contact card and the print checks live here so all pieces behave the same. */
(function(){
  const Ivory = {};

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
    const plan = !!(D.plan && D.plan.levels && D.plan.levels.length);
    const levels = plan ? D.plan.levels.filter(l=>!l.garageApartment).length : 0;
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
  Ivory.place = L => [L.neighborhood, [L.city, L.state].filter(Boolean).join(', ') + (L.zip ? ' ' + L.zip : '')].filter(Boolean).join('  /  ');

  // Photos for the companion pieces: written order if given, else listing order (exterior first).
  Ivory.photoOrder = function(D){
    const P = D.photos || {};
    const ids = (D.companion && D.companion.photos) || Object.keys(P).filter(id => !/floor ?plan/i.test(P[id].tags||''));
    return ids.filter(id => Ivory.src(D, id));
  };

  /* Contact card for the companion pieces.
     opts: x, y, w, h, nameSize (start size; steps down to 18 pt), phoneSize, lineSize, qr (pt), brokerage (bool), slot prefix */
  Ivory.card = function(D, o){
    const A = D.agent || {}, b = D.brand || {};
    const portrait = !!(A.headshot && Ivory.src(D, A.headshot));
    const pw = portrait ? Math.round(o.h * 0.8) : 0;
    const L0 = portrait ? pw + 3 + 14 : 16;
    const t = o.top || {};
    const rows = Object.assign({name:8, title:o.nameSize+12, callLbl:o.nameSize+25, phone:o.nameSize+32}, t);
    const lineTop = rows.phone + o.phoneSize + 4;
    let h = `<div class="card" data-card="1" style="left:${o.x}pt;top:${o.y}pt;width:${o.w}pt;height:${o.h}pt" data-l0="${L0}" data-gap="${o.gap||20}" data-brkmin="${o.brkMin||110}">
      <div class="stripe"></div>
      ${portrait ? `<div class="portrait" style="width:${pw}pt;height:${o.h}pt"><img src="${esc(Ivory.src(D,A.headshot))}" alt=""></div>` : ''}
      <div class="agent" style="position:absolute;left:${L0}pt;top:0;bottom:0;width:${o.agentMax||260}pt">
        <div class="agent-name" style="position:absolute;left:0;top:${rows.name}pt;font-family:var(--font-display);font-size:${o.nameSize}pt;line-height:${o.nameSize+3}pt;color:var(--ink);white-space:nowrap" data-slot="agent.name" data-lines="1" data-start="${o.nameSize}">${esc(A.name)}</div>
        ${A.designation ? `<div class="lbl" style="left:1pt;top:${rows.title}pt" data-slot="agent.title" data-fine="1">${esc(A.designation)}</div>` : ''}
        <div class="lbl" style="left:1pt;top:${rows.callLbl}pt" data-fine="1">${esc(A.phoneLabel||'Call / Text')}</div>
        <div style="position:absolute;left:0;top:${rows.phone}pt;font:700 ${o.phoneSize}pt/${o.phoneSize+2}pt var(--font-body);color:var(--ink);white-space:nowrap" data-slot="agent.phone" data-lines="1">${esc(A.phone)}</div>
        <div style="position:absolute;left:0;top:${lineTop}pt;font-size:${o.lineSize}pt;line-height:${o.lineSize+2}pt;color:var(--ink);white-space:nowrap" data-slot="agent.email" data-lines="1">${esc(A.email||'')}</div>
        ${o.agentWeb!==false && A.web ? `<div style="position:absolute;left:0;top:${lineTop+o.lineSize+2.5}pt;font-size:${o.lineSize}pt;line-height:${o.lineSize+2}pt;color:var(--ink);white-space:nowrap" data-slot="agent.web" data-lines="1">${esc(A.web)}</div>` : ''}
      </div>`;
    if(o.brokerage !== false){
      h += `<div class="divider d1" style="top:10pt;bottom:10pt"></div>
      <div class="brk" style="position:absolute;top:0;bottom:0;text-align:center">
        ${o.brokerageLogo===false
          ? `<div style="position:absolute;left:0;right:0;top:${rows.name+2}pt;height:${o.logoH||24}pt;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:${o.brkNameSize||13}pt;line-height:1.1;color:var(--ink);white-space:nowrap" data-slot="broker.name" data-lines="1">${esc(b.brokerage||'')}</div>`
          : Ivory.logo(b, '', `left:-16pt;right:-16pt;top:${rows.name}pt;height:${Math.round((o.logoH||24)*1.3)}pt;justify-content:center`)}
        <div class="lbl" style="left:0;right:0;top:${rows.callLbl}pt;text-align:center" data-fine="1">${esc(b.officeLabel||'Office')}</div>
        <div style="position:absolute;left:0;right:0;top:${rows.phone+2}pt;font:700 ${o.officeSize||13}pt/${(o.officeSize||13)+2}pt var(--font-body);color:var(--ink);white-space:nowrap" data-slot="broker.phone" data-lines="1">${esc(b.phone||'')}</div>
        <div style="position:absolute;left:0;right:0;top:${lineTop}pt;font-size:${o.lineSize}pt;line-height:${o.lineSize+2}pt;color:var(--ink);white-space:nowrap" data-slot="broker.web" data-lines="1">${esc(b.web||'')}</div>
      </div>`;
    }
    h += `<div class="divider d2" style="top:10pt;bottom:10pt"></div>
      <div class="qrcol" style="position:absolute;top:0;bottom:0;width:${o.qr+12}pt;right:12pt">
        <div style="position:absolute;left:6pt;top:${(o.h - o.qr - 14)/2}pt;width:${o.qr}pt;height:${o.qr}pt">${A.qr ? `<img src="${esc(A.qr)}" alt="" style="width:100%;height:100%">` : ''}</div>
        <div class="lbl" style="left:-10pt;right:-10pt;top:${(o.h - o.qr - 14)/2 + o.qr + 6}pt;text-align:center;letter-spacing:.6pt;text-transform:none;font-weight:600" data-slot="agent.qrurl" data-fine="1">${esc(A.web||'')}</div>
      </div>
    </div>`;
    return h;
  };

  // Lay out every contact card: equal gutters, hairlines centered in them, the name steps down
  // from its start size to an 18 pt floor only when the columns can't fit. Nothing else shrinks.
  Ivory.layoutCards = function(){
    const issues = [];
    const pt = px => px*72/96;
    document.querySelectorAll('[data-card]').forEach(card=>{
      const W = pt(card.clientWidth);
      const L0 = +card.dataset.l0, minGap = +card.dataset.gap;
      const agent = card.querySelector('.agent'), brk = card.querySelector('.brk'), qr = card.querySelector('.qrcol');
      const name = agent.querySelector('.agent-name');
      const qrW = pt(qr.offsetWidth) + 12;
      const nat = el => { const s=document.createElement('span'); const cs=getComputedStyle(el); s.style.cssText='position:absolute;white-space:nowrap;visibility:hidden'; s.style.font=cs.font; s.style.letterSpacing=cs.letterSpacing; s.textContent=el.textContent; card.appendChild(s); const w=pt(s.offsetWidth); s.remove(); return w; };
      const agentW = () => Math.max(...[...agent.children].map(nat));
      // a brokerage name standing in for a missing logo is a wordmark: it scales to the column, like the fold-over
      const wm = brk && brk.querySelector('.logo .text');
      const brkText = brk ? Math.max(+card.dataset.brkmin||110, ...[...brk.querySelectorAll('[data-slot]')].map(nat)) : 0;
      if(wm){ const ww = nat(wm), cap = Math.max(brkText, 150); if(ww > cap) wm.style.fontSize = (parseFloat(getComputedStyle(wm).fontSize)*72/96*cap/ww)+'pt'; }
      const brkW = brk ? Math.max(brkText, wm ? nat(wm) : 0) : 0;
      const cols = brk ? 2 : 1;
      let fs = parseFloat(name.dataset.start), aw = agentW();
      let free = W - L0 - aw - brkW - qrW;
      while(free < minGap*cols && fs > 18){ fs -= 1; name.style.fontSize = fs+'pt'; name.style.lineHeight=(fs+3)+'pt'; aw = agentW(); free = W - L0 - aw - brkW - qrW; }
      // Still too wide at the 18 pt floor: break the widest line instead of shrinking type.
      //   long email -> two lines, broken before the @
      //   long name  -> two lines, first name over the rest
      // Rows below move down only as far as needed; the agent's web line (also printed under the QR code)
      // is dropped when it no longer fits inside the card's fixed height. Anything else that won't fit is flagged.
      const H = pt(card.clientHeight);
      const lineW = (el, html) => Math.max(...html.split('<br>').map(x=>{ const s=document.createElement('span'); const cs=getComputedStyle(el); s.style.cssText='position:absolute;white-space:nowrap;visibility:hidden'; s.style.font=cs.font; s.style.letterSpacing=cs.letterSpacing; s.innerHTML=x; card.appendChild(s); const w=pt(s.offsetWidth); s.remove(); return w; }));
      const widthOf = el => el.style.display==='none' ? 0 : lineW(el, el.innerHTML);
      const below = (top) => [...agent.children].filter(el => parseFloat(el.style.top) > top + 0.5);
      const fitRows = () => [...agent.children].forEach(el => {
        if(el.style.display==='none') return;
        const bottom = parseFloat(el.style.top) + el.offsetHeight*72/96;
        if(bottom > H - 2){ if(el.dataset.slot === 'agent.web') el.style.display = 'none';
          else issues.push({slot:el.dataset.slot||'agent', kind:'overflow', detail:'the contact card is full; shorten this line'}); }
      });
      const email = agent.querySelector('[data-slot="agent.email"]');
      for(let guard = 0; free < minGap*cols && guard < 2; guard++){
        const cands = [name, email].filter(el => el && !el.dataset.split);
        if(!cands.length) break;
        const wide = cands.sort((a,b)=>widthOf(b)-widthOf(a))[0];
        const t = wide.textContent.trim();
        const cut = wide === email ? t.indexOf('@') : t.indexOf(' ');
        if(cut <= 0) break;
        const lh = parseFloat(getComputedStyle(wide).lineHeight)*72/96;
        const top = parseFloat(wide.style.top), nextTop = Math.min(...below(top).map(el=>parseFloat(el.style.top)));
        wide.dataset.split = '1';
        wide.innerHTML = Ivory.esc(t.slice(0, cut)) + '<br>' + Ivory.esc(wide === email ? t.slice(cut) : t.slice(cut+1));
        wide.style.height = (2*lh)+'pt';
        const shift = Math.max(0, top + 2*lh + 1 - nextTop);
        below(top).forEach(el => el.style.top = (parseFloat(el.style.top) + shift)+'pt');
        fitRows();
        aw = Math.max(...[...agent.children].map(widthOf));
        free = W - L0 - aw - brkW - qrW;
      }
      if(free < minGap*cols) issues.push({slot:'contact-card', kind:'overflow', detail:'columns need '+Math.round(minGap*cols-free)+'pt more'});
      const g = free/cols;
      agent.style.width = aw+'pt';
      if(brk){
        brk.style.left = (L0+aw+g)+'pt'; brk.style.width = brkW+'pt';
        card.querySelector('.d1').style.left = (L0+aw+g/2)+'pt';
        card.querySelector('.d2').style.left = (L0+aw+g+brkW+g/2)+'pt';
      } else {
        card.querySelector('.d2').style.left = (L0+aw+g/2)+'pt';
      }
      // the QR code sits centered between its hairline and the card's right edge (the owner, 10/21/2026)
      const d2 = parseFloat(card.querySelector('.d2').style.left), qw = pt(qr.offsetWidth);
      qr.style.right = 'auto'; qr.style.left = ((d2 + W)/2 - qw/2)+'pt';
    });
    return issues;
  };

  // Print checks, read by the renderer: overflow per slot, type under 8 pt (6 pt for fine print),
  // photos under 300 ppi at print size, empty or missing photos.
  Ivory.check = function(extra){
    const issues = [...(extra||[]), ...Ivory.fontIssues];
    document.querySelectorAll('[data-slot]').forEach(el=>{
      const name = el.dataset.slot, cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize)*72/96;
      const oneLine = cs.whiteSpace === 'nowrap';
      if(oneLine ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1)
        issues.push({slot:name, kind:'overflow', text:el.textContent.slice(0,80)});
      if(size < 8 && !el.dataset.fine) issues.push({slot:name, kind:'type-too-small', size:+size.toFixed(1)});
      if(size < 6) issues.push({slot:name, kind:'fine-print-below-6pt', size:+size.toFixed(1)});
      // fill target (the owner, 10/21/2026): a text block with data-fill="n" needs at least n lines, and when it stops at
      // exactly n the last line runs at least 60% of the width. Short copy comes back to the writer to be filled out.
      const need = +el.dataset.fill || 0;
      if(need && el.textContent.trim()){
        const rg = document.createRange(); rg.selectNodeContents(el);
        const rows = []; [...rg.getClientRects()].forEach(r=>{ const row = rows.find(x=>Math.abs(x.top - r.top) < 2); if(row) row.right = Math.max(row.right, r.right); else rows.push({top:r.top, left:r.left, right:r.right}); });
        const box = el.getBoundingClientRect(), last = rows[rows.length-1];
        const lastFill = last ? (last.right - box.left) / box.width : 0;
        if(rows.length < need || (rows.length === need && lastFill < 0.6))
          issues.push({slot:name, kind:'underfilled', lines:rows.length, need, lastLine:Math.round(lastFill*100)+'%', detail:`write it out to ${need} full lines`});
      }
    });
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
      if(el.dataset.fullhouse){
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
      return Promise.all([`400 10pt ${d}`, `400 10pt ${b}`, `600 10pt ${b}`, `700 10pt ${b}`].map(f => document.fonts.load(f)));
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
