/* The Houston Answer Book: shared helpers for every piece.
   Data, fonts, question captions, the stat row, the flood rule, the contact card and the print checks live here,
   so the fold-over and the smaller pieces behave the same. */
(function(){
  const AB = {};
  const esc = AB.esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const pt = px => px*72/96;

  AB.data = () => JSON.parse(document.getElementById('brochure-data').textContent || '{}');

  // ---------- fonts ----------
  // Every render opens in the design's original fonts. An agent may pick other fonts, but only from the approved
  // list in fonts.json (fonts that keep the originals' width and letter heights). Anything else falls back to the originals.
  AB.fontBase = '../../fonts/pool/';
  AB.applyFonts = async function(D, spec){
    const want = (D.brand && D.brand.fonts) || D.fonts || {};
    const issues = [];
    const roles = {display: '--font-display', body: '--font-body'};
    const loads = [];
    for(const role of Object.keys(roles)){
      const o = spec && spec.originals[role];
      let id = want[role];
      if(!o || !id || id === o.id) continue;
      if(!o.approved.includes(id)){ issues.push({slot:'fonts.'+role, kind:'font-not-approved', detail:id}); continue; }
      const fam = 'ab-' + id;
      const have = (spec.weights && spec.weights[id]) || [400,500,600,700];
      for(const w of role === 'display' ? [500,600] : [400,600,700]){
        const near = have.reduce((a,b)=> Math.abs(b-w) < Math.abs(a-w) ? b : a);
        const f = new FontFace(fam, `url(${AB.fontBase}${id}-latin-${near}-normal.woff2)`, {weight:String(w)});
        document.fonts.add(f); loads.push(f.load());
      }
      document.documentElement.style.setProperty(roles[role], `'${fam}',Helvetica,Arial,sans-serif`);
    }
    await Promise.all(loads).catch(e => issues.push({slot:'fonts', kind:'font-load-failed', detail:String(e)}));
    const cs = getComputedStyle(document.documentElement);
    await Promise.all(['400 10pt','500 10pt','600 10pt'].flatMap(w => [document.fonts.load(`${w} ${cs.getPropertyValue('--font-display')}`), document.fonts.load(`${w} ${cs.getPropertyValue('--font-body')}`)]));
    return issues;
  };

  // ---------- photos ----------
  AB.src = (D, id) => (D.photos && D.photos[id] && D.photos[id].src) || '';
  AB.photo = (D, id, style, slot) => {
    const p = (D.photos||{})[id] || {};
    const pos = p.focus ? `object-position:${esc(p.focus)}` : '';
    return `<div class="ph" data-photo="${esc(id||'')}" data-slot-photo="${esc(slot||'')}" style="${style||''}">${id && p.src ? `<img src="${esc(p.src)}" style="${pos}" alt="">` : ''}</div>`;
  };

  // ---------- text ----------
  const widths = [100, 96, 99, 92, 97, 88, 95, 100, 90, 62];
  AB.ghost = (lines, lh, style) => {
    let h = '';
    for(let i=0;i<lines;i++) h += `<i style="width:${i===lines-1 && lines>1 ? 58 : widths[i%widths.length]}%;margin-top:${i ? lh-3.2 : (lh-3.2)/2}pt"></i>`;
    return `<div class="ghost" style="height:${lines*lh}pt;${style||''}">${h}</div>`;
  };
  AB.pending = (D, text) => D.copyPending || text == null || text === '';

  // Question caption: "— Question?" then the answer, with an optional bold lead ("Kitchen, 8'1" x 11'10".").
  AB.caption = (D, c, slot, lines, extra) => {
    c = c || {};
    lines = lines || 3;
    if(D.copyPending || (!c.q && !c.a))
      return `<div class="cap" ${extra||''}>${AB.ghost(1, 11, 'width:55%')}${AB.ghost(lines, 11.5, 'margin-top:1.5pt')}</div>`;
    const lead = c.lead ? `<b>${esc(c.lead)}</b> ` : '';
    return `<div class="cap" ${extra||''}>
      <div class="q" data-slot="${slot}.q" data-lines="1"><i class="dash"></i>${esc(c.q)}</div>
      <div class="a" data-slot="${slot}.a" data-lines="${lines}" style="max-height:${lines*11.5+2}pt">${lead}${esc(c.a||'')}</div></div>`;
  };

  // ---------- listing facts ----------
  const n = v => Number(v).toLocaleString('en-US');
  const pl = (k, one, many) => `${n(k)} ${k==1 ? one : many}`;
  // The fifth stat is lot size, garage or stories, never anything else (flood status never goes in the stat row).
  AB.stat5 = (L, pick) => {
    const opts = {
      lot: L.lotAcres ? (L.lotAcres >= 0.5 ? `${L.lotAcres} Acre Lot` : `${n(Math.round(L.lotAcres*43560))} Sq Ft Lot`)
         : L.lotSqft ? `${n(L.lotSqft)} Sq Ft Lot` : null,
      garage: L.garage ? `${L.garage}-Car Garage` : null,
      stories: L.stories ? (L.stories == 1 ? 'One Story' : `${L.stories} Stories`) : null,
    };
    if(pick && opts[pick]) return opts[pick];
    return opts.lot || opts.garage || opts.stories || null;
  };
  AB.stats = (L, pick) => {
    const s = [];
    if(L.beds) s.push(pl(L.beds, 'Bedroom', 'Bedrooms'));
    if(L.baths) s.push(pl(L.baths, 'Full Bath', 'Full Baths') + (L.halfBaths ? `, ${L.halfBaths} Half` : ''));
    if(L.sqft) s.push(`${n(L.sqft)} Square Feet`);
    if(L.yearBuilt || L.year) s.push(`Built in ${L.yearBuilt || L.year}`);
    const f = AB.stat5(L, pick); if(f) s.push(f);
    return s;
  };
  AB.place = L => [L.neighborhood, L.city, [L.state, L.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  // ---------- the flood rule ----------
  // "Never flooded" may show only when the listing description says so in plain words. A claim tied to one storm
  // ("did not flood in Harvey") is narrower than "never", so it doesn't count. We never infer flood status.
  AB.floodStated = desc => {
    const sentences = String(desc||'').split(/(?<=[.!?])\s+/);
    return sentences.some(s => /\b(never\s+(been\s+)?flooded|(has|have)\s+(not|never)\s+(ever\s+)?(been\s+)?flooded|(hasn|haven)['’]t\s+(ever\s+)?(been\s+)?flooded)\b/i.test(s)
      && !/\b(during|in|from)\s+(hurricane|tropical|harvey|ike|allison|beryl|imelda|the\s+\d{4}|\d{4})\b/i.test(s));
  };

  // ---------- photo rows that fill a column ----------
  // Picks the row arrangement whose photos stay closest to a 3:2 landscape shape once the rows are stretched to fill
  // the height, so a house with few rooms gets bigger photos, not tall slivers. Returns rows with flex-grow weights.
  AB.CAP_EST = 41.5;            // caption estimate (question + about two lines); rows are equalized after layout
  AB.bestRows = function(pair, tiles, o){
    const T = 1.5, shapes = {0:[],1:[1],2:[2],3:[3],4:[2,2],5:[3,2],6:[3,3],7:[4,3],8:[4,4],9:[3,3,3],10:[4,3,3]};
    const tag = (arr, pre) => arr.map((t,i) => Object.assign({}, t, {_slot: pre + i}));
    const P = tag(pair, 'beds.pair'), Tl = tag(tiles, 'beds.tile');
    const cands = [];
    if(P.length === 2) cands.push([{items:P, weights:[5.3,3.2]}, ...(shapes[Tl.length]||[]).map(c => ({cols:c}))]);
    if(P.length === 2) cands.push([{items:P, weights:[1,1]}, ...(shapes[Tl.length]||[]).map(c => ({cols:c}))]);
    if(P.length >= 1) cands.push([{items:[P[0]], weights:[1]}, ...(shapes[Tl.length + P.length - 1]||[]).map(c => ({cols:c, rest:true}))]);
    if(!P.length) cands.push((shapes[Tl.length]||[]).map(c => ({cols:c})));
    let best = null;
    for(const c of cands){
      const pool = [...(c[0] && c[0].items === P ? [] : P.slice(c[0] && c[0].items ? c[0].items.length : 0)), ...Tl];
      let k = 0;
      const rows = c.map(r => {
        if(r.items) return {items:r.items, weights:r.weights, cols:r.items.length};
        const items = pool.slice(k, k + r.cols); k += r.cols;
        return {items, weights:items.map(() => 1), cols:r.cols};
      }).filter(r => r.items.length);
      // natural photo height of each row at 3:2 (the narrowest photo in the row sets it)
      rows.forEach(r => { const sum = r.weights.reduce((a,b)=>a+b,0), wmin = Math.min(...r.weights.map(w => (o.W - o.gap*(r.cols-1)) * w / sum)); r.nat = wmin / T; r.wmin = wmin; });
      const room = o.H - rows.length * (AB.CAP_EST + 12);
      const s = room / rows.reduce((a,r)=>a+r.nat,0);
      // the original design's wide + narrow primary pair wins whenever it is close
      const score = Math.max(...rows.map(r => Math.abs(Math.log((r.wmin / (r.nat*s)) / T)))) - (c === cands[0] && P.length === 2 ? 0.15 : 0);
      rows.forEach(r => r.grow = r.nat);
      if(!best || score < best.score - 1e-6) best = {rows, score};
    }
    return best ? best.rows : [];
  };

  // ---------- contact card ----------
  // Agent | brokerage | QR on one row grid. Gutters are equal and the hairlines sit in their middles. When the logo
  // or QR is missing the columns reflow. Only the agent's name may step down, from 30 pt to an 18 pt floor.
  AB.card = function(D, o){
    const A = D.agent || {}, b = D.brand || {};
    const cell = A.cell || A.phone, office = A.office || b.phone, title = A.title || A.designation;
    const qr = A.qr ? `<div class="qr" style="left:0;top:12pt;width:${o.qr}pt;height:${o.qr}pt"><img src="${esc(A.qr)}" alt=""></div>
        <div class="line" style="left:-30pt;right:-30pt;top:${o.qr+18}pt;text-align:center;font-weight:400" data-slot="agent.qrLabel" data-lines="1">${esc(A.qrLabel || A.web || '')}</div>` : '';
    const logo = b.logo
      ? `<div class="logo" data-area="5000" data-maxh="38" style="position:absolute;left:0;right:0;top:8pt;height:38pt;justify-content:center"><img src="${esc(b.logo)}" alt=""></div>
         <div class="lbl" style="left:0;right:0;top:50pt;text-align:center" data-slot="broker.name" data-fine="1">${esc(b.brokerage||'')}</div>`
      : `<div class="logo" style="position:absolute;left:0;right:0;top:12pt;height:36pt;justify-content:center"><span class="word" style="font-size:15pt" data-slot="broker.name" data-lines="1">${esc(b.brokerage||'')}</span></div>`;
    return `<div class="card" data-card="1" style="left:${o.x}pt;top:${o.y}pt;width:${o.w}pt;height:${o.h}pt">
      <div class="col agent" style="left:0">
        <div class="name" style="top:10pt;font-size:30pt;line-height:34pt" data-slot="agent.name" data-lines="1" data-start="30">${esc(A.name)}</div>
        ${title ? `<div class="lbl" style="left:1pt;top:50pt" data-slot="agent.title" data-fine="1">${esc(title)}</div>` : ''}
        ${cell ? `<div class="lbl" style="left:1pt;top:64pt" data-fine="1">${esc(A.phoneLabel||'Call or text')}</div>
        <div class="big" style="left:0;top:74pt" data-slot="agent.cell" data-lines="1">${esc(cell)}</div>` : ''}
        ${A.email ? `<div class="line" style="left:0;top:101pt" data-slot="agent.email" data-lines="1">${esc(A.email)}</div>` : ''}
        ${A.web ? `<div class="line" style="left:0;top:113pt" data-slot="agent.web" data-lines="1">${esc(A.web)}</div>` : ''}
      </div>
      <div class="vr v1" style="top:12pt;bottom:6pt"></div>
      <div class="col brk" style="text-align:center">
        ${logo}
        ${office ? `<div class="lbl" style="left:0;right:0;top:64pt;text-align:center" data-fine="1">${esc(b.officeLabel||'Office')}</div>
        <div class="big" style="left:0;right:0;top:74pt;text-align:center" data-slot="broker.office" data-lines="1">${esc(office)}</div>` : ''}
        ${b.web ? `<div class="line" style="left:0;right:0;top:101pt;text-align:center;font-weight:400" data-slot="broker.web" data-lines="1">${esc(b.web)}</div>` : ''}
      </div>
      ${qr ? `<div class="vr v2" style="top:12pt;bottom:6pt"></div><div class="col qrcol" style="width:${o.qr}pt">${qr}</div>` : ''}
    </div>`;
  };

  // Logos of any shape get about the same visual weight: each slot gives a logo a set area (pt²), up to the slot's
  // height and width. A wide lockup ends up wide and short, a square or stacked logo taller.
  AB.fitLogos = () => document.querySelectorAll('.logo[data-area] img').forEach(img => {
    const box = img.parentElement, a = img.naturalWidth / img.naturalHeight || 1;
    const maxW = pt(box.clientWidth) || 170;
    let h = Math.min(+box.dataset.maxh, Math.sqrt(+box.dataset.area / a));
    if(h * a > maxW) h = maxW / a;
    img.style.height = h + 'pt'; img.style.width = (h * a) + 'pt'; img.style.maxWidth = 'none'; img.style.maxHeight = 'none';
  });

  // Lines a block of text actually sets in (line boxes of its text, however it is styled inside).
  AB.lines = el => {
    const r = document.createRange(); r.selectNodeContents(el);
    const tops = [...r.getClientRects()].filter(q => q.width > .5 && q.height > .5).map(q => q.top).sort((a,b)=>a-b);
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 12;
    let n = 0, last = -1e9;
    for(const t of tops){ if(t - last > lh*0.5){ n++; last = t; } }
    return n;
  };
  // Natural width of a single-line text element, as set.
  AB.textWidth = el => { const r = document.createRange(); r.selectNodeContents(el); return pt(r.getBoundingClientRect().width); };

  // Captions in one row share one height (the longest), so the photos above them line up.
  AB.equalizeRows = () => document.querySelectorAll('.row').forEach(row => {
    const caps = [...row.children].map(it => it.querySelector(':scope > .cap')).filter(Boolean);
    if(caps.length < 2) return;
    const h = Math.max(...caps.map(c => c.offsetHeight));
    caps.forEach(c => c.style.height = h + 'px');
  });

  AB.layoutCards = function(){
    const issues = [];
    document.querySelectorAll('[data-card]').forEach(card=>{
      const W = pt(card.clientWidth), minGap = 26;
      const agent = card.querySelector('.agent'), brk = card.querySelector('.brk'), qr = card.querySelector('.qrcol');
      const name = agent.querySelector('.name');
      const nat = AB.textWidth;
      const agentW = () => Math.max(...[...agent.children].map(nat));
      const img = brk.querySelector('.logo img');
      const logoW = img ? pt(img.getBoundingClientRect().width) : 0;
      const word = brk.querySelector('.logo .word');
      const brkW = Math.max(logoW, ...[...brk.querySelectorAll('[data-slot]')].map(nat), word ? nat(word) : 0);
      const qrW = qr ? pt(qr.offsetWidth) : 0;
      const cols = qr ? 2 : 1;
      let fs = +name.dataset.start, aw = agentW(), free = W - aw - brkW - qrW;
      while(free < minGap*cols && fs > 18){ fs -= 1; name.style.fontSize = fs+'pt'; name.style.lineHeight = (fs+4)+'pt'; aw = agentW(); free = W - aw - brkW - qrW; }
      if(free < minGap*cols) issues.push({slot:'contact-card', kind:'card-fit', detail:'columns need '+Math.round(minGap*cols-free)+'pt more'});
      const g = free/cols;
      agent.style.width = aw+'pt';
      brk.style.left = (aw+g)+'pt'; brk.style.width = brkW+'pt';
      card.querySelector('.v1').style.left = (aw+g/2)+'pt';
      if(qr){ qr.style.left = (aw+g+brkW+g)+'pt'; card.querySelector('.v2').style.left = (aw+g+brkW+g/2)+'pt'; }
    });
    return issues;
  };

  // ---------- print checks (read by the renderer) ----------
  // Overflow per slot, type under 8 pt (6 pt for fine print), photos under 300 ppi at print size, empty slots,
  // flood claims the listing doesn't make, prices, and sample text on a real agent's piece.
  AB.check = function(D, extra){
    const issues = [...(extra||[])];
    // rough-draft preview lines never reach a paid or downloaded piece (10/25/2026)
    if(D && D.preview) issues.push({slot:'copy', kind:'preview-text', detail:'rough-draft preview lines; the writer has not run'});
    const sample = /\b(avery morgan|any brokerage|your brokerage|your website|lorem|ipsum|placeholder|tbd|xx+)\b|555[.\-]01\d\d/i;
    const flood = AB.floodStated((D.listing||{}).description);
    document.querySelectorAll('[data-slot]').forEach(el=>{
      const name = el.dataset.slot, cs = getComputedStyle(el), txt = el.textContent.trim();
      const size = parseFloat(cs.fontSize)*72/96;
      const oneLine = cs.whiteSpace === 'nowrap';
      const max = +el.dataset.lines || 0;
      const over = oneLine ? el.scrollWidth > el.clientWidth + 1
                 : max ? AB.lines(el) > max || el.scrollWidth > el.clientWidth + 1
                 : el.scrollHeight > el.clientHeight + 1;
      if(over) issues.push({slot:name, kind:'overflow', text:txt.slice(0,80), ...(max && !oneLine ? {lines:AB.lines(el), max} : {})});
      if(size < 8 && !el.dataset.fine) issues.push({slot:name, kind:'type-too-small', size:+size.toFixed(1)});
      if(size < 6) issues.push({slot:name, kind:'fine-print-below-6pt', size:+size.toFixed(1)});
      if(!txt && !el.dataset.optional) issues.push({slot:name, kind:'empty-slot'});
      if(/\$\s?\d/.test(txt)) issues.push({slot:name, kind:'price', text:txt.slice(0,80)});
      if(!flood && /flood/i.test(txt)) issues.push({slot:name, kind:'flood-not-stated', text:txt.slice(0,80)});
      if(!D.sample && sample.test(txt)) issues.push({slot:name, kind:'placeholder', text:txt.slice(0,80)});
    });
    document.querySelectorAll('.ph').forEach(el=>{
      const img = el.querySelector('img'), slot = el.dataset.slotPhoto || el.dataset.photo || 'photo';
      if(!img){ issues.push({slot, kind:'empty-photo-slot'}); return; }
      if(!img.complete || !img.naturalWidth){ issues.push({slot, kind:'photo-missing', src:img.getAttribute('src')}); return; }
      const wIn = el.clientWidth/96, hIn = el.clientHeight/96;
      const ppi = Math.min(img.naturalWidth/wIn, img.naturalHeight/hIn);
      if(ppi < 300) issues.push({slot, photo:el.dataset.photo, kind:'photo-under-300ppi', ppi:Math.round(ppi), placedIn:[+wIn.toFixed(2),+hIn.toFixed(2)]});
    });
    if(!D.sample){
      const A = D.agent||{}, b = D.brand||{};
      if(/brochuredesk/i.test((A.qrUrl||'') + (A.web||''))) issues.push({slot:'agent.qr', kind:'placeholder', text:'QR or website still points to BrochureDesk'});
      if(/sample|placeholder/i.test(String(b.logo||'').split('/').pop())) issues.push({slot:'broker.logo', kind:'placeholder', text:'sample logo'});
    }
    return issues;
  };

  // Where each photo sits and how big, so the renderer can fit photos to print size.
  AB.placements = () => [...document.querySelectorAll('.ph img')].map(img => ({src: img.getAttribute('src'), w: img.parentElement.clientWidth/96, h: img.parentElement.clientHeight/96}));

  window.AB = AB;
})();
