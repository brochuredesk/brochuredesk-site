/* BrochureDesk Just Sold postcard library: runtime for every design in templates/js-library/.
   Each design file holds <template> elements made by scripts/build_js_library.py from the approved design scripts:
   data-side front|back, data-hs 1|0 (agent has a headshot), data-long 1 (long-name layout, where one exists).
   This fills the {{tokens}} from the listing and agent data, sizes the agent name, fits the copy, applies the
   roofline / alignment rules, and runs the print checks.

   Renderer (renderer/render.py): the page reads #brochure-data (with data.piece and data.mode) and draws itself.
   Site preview:   JSLib.mount(container, designHtmlText, data, {side:'back'}) returns a promise with the checks. */
(function(){
  const W = 864, H = 576, BLEED_PX = 12;             // 9 x 6 in at 96 px/in; 0.125 in bleed
  const ZONES = {postage:[736,16,112,131], address:[540,250,320,150], barcode:[408,516,456,60]};
  const NUM = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
  const SUFFIX = /^(street|st|avenue|ave|drive|dr|lane|ln|road|rd|boulevard|blvd|court|ct|way|place|pl|circle|cir|trail|trl|parkway|pkwy|terrace|ter|loop|row|square|sq)\.?$/i;
  const STATES = {alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',
    hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',
    michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ',
    'new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA',
    'rhode island':'RI','south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',
    washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY'};
  // Photo roles the designs ask for, and the listing photo tags that fill a role when the listing has no photo by that name.
  const ROLE_TAGS = {front:/front exterior|front of/i, family:/exterior|side angle/i, lawn:/back ?yard|patio|rear exterior|pool/i,
    kitchen:/kitchen/i, kitchen2:/kitchen|bar|island/i, living:/living|family room|great room/i, dining:/dining/i, nook:/nook|breakfast/i,
    primary:/primary|master/i, bedroom2:/bedroom/i, study:/bedroom|study|office/i, office:/bath|office/i, hall:/entry|foyer|hall/i};
  const EXTERIOR = {front:1, family:1, lawn:1};

  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const word = n => (Number.isInteger(n) && n >= 0 && n < NUM.length) ? NUM[n] : String(n);

  // ---------------------------------------------------------------- data -> token values
  function values(D){
    const L = D.listing || {}, A = D.agent || {}, B = D.brand || {}, S = D.sold || {};
    const street = (L.address || '').trim();
    const parts = street.split(/\s+/);
    const short = parts.length > 2 && SUFFIX.test(parts[parts.length-1]) ? parts.slice(0,-1).join(' ') : street;
    const num = /^\d/.test(parts[0]||'') ? parts[0] : '';
    const stateName = L.state && L.state.length > 2 ? L.state : (Object.keys(STATES).find(k => STATES[k] === (L.state||'').toUpperCase()) || L.state || '');
    const st = L.state && L.state.length === 2 ? L.state.toUpperCase() : (STATES[(L.state||'').toLowerCase()] || L.state || '');
    const beds = +L.beds || 0, full = Math.floor(+L.baths || 0), half = +L.halfBaths || ((+L.baths||0) % 1 ? 1 : 0);
    const bedsP = beds ? `${word(beds)} bedroom${beds === 1 ? '' : 's'}` : '';
    const bathsP = full ? (half ? `${word(full)} and a half baths` : `${word(full)} bath${full === 1 ? '' : 's'}`) : '';
    const bb = [bedsP, bathsP].filter(Boolean).join(' and ');
    const year = L.yearBuilt ? String(L.yearBuilt) : '';
    const stories = +L.stories || 0;
    const storyW = stories ? `${word(stories)}-story` : 'home';
    const art = /^(8|11|18)/.test(year) ? 'an' : 'a';
    const factsA = `${year ? art + ' ' + year : 'a'} ${storyW}${bb ? ' with ' + bb : ''}`;
    const dom = +S.daysOnMarket || 0, offers = +S.offers || 0;
    const name = (A.name || '').trim(), np = name.split(/\s+/);
    const first = np[0] || '', last = np.slice(1).join(' ');
    const ret = B.returnAddress || [];
    const v = {
      street, STREET: street.toUpperCase(), streetShort: short, STREETSHORT: short.toUpperCase(),
      STREETNUM: num.toUpperCase(), STREETNAME: (num ? parts.slice(1).join(' ') : street).toUpperCase(),
      city: L.city || '', CITY: (L.city || '').toUpperCase(), state: stateName, STATE: stateName.toUpperCase(), st, ST: st,
      yearBuilt: year, factsA, FactsA: cap(factsA), bedsBaths: bb,
      factsShort: cap([bedsP, bathsP].filter(Boolean).join(', ') + (year ? `, built in ${year}` : '')) + '.',
      factsBuilt: [year ? `Built in ${year}` : '', stories ? `${word(stories)} stor${stories === 1 ? 'y' : 'ies'}` : '', bb].filter(Boolean).join(', ').replace(/^./, c => c.toUpperCase()) + '.',
      builtLine: [year ? `Built in ${year}` : '', stories ? `${word(stories)} stor${stories === 1 ? 'y' : 'ies'}` : ''].filter(Boolean).join(', '),
      builtYear: year ? `built ${year}` : '',
      domDays: dom ? `${dom} day${dom === 1 ? '' : 's'}` : '', DOMDAYS: dom ? `${dom} DAY${dom === 1 ? '' : 'S'}` : '',
      offers: offers ? `${offers} offers` : 'multiple offers', OFFERS: offers ? `${offers} OFFERS` : 'MULTIPLE OFFERS',
      Offers: offers ? cap(`${word(offers)} offers`) : 'Multiple offers',
      agentName: name, AGENTNAME: name.toUpperCase(), agentFirst: first, AGENTFIRST: first.toUpperCase(),
      agentLast: last, AGENTLAST: last.toUpperCase(), agentPhone: A.phone || '', agentEmail: A.email || '',
      agentWeb: A.web || '', AGENTWEB: (A.web || '').toUpperCase(), designation: A.designation == null ? 'REALTOR®' : A.designation,
      brokerage: B.brokerage || '', BROKERAGE: (B.brokerage || '').toUpperCase(),
      ret1: ret[0] || '', ret2: ret[1] || '', retLine: ret.filter(Boolean).join(', '),
    };
    return v;
  }

  // Which listing photo fills each role; never the same photo twice on one side of a card.
  function photoPicker(D){
    const P = D.photos || {}, roles = D.photoRoles || {}, used = new Set(), notes = [];
    const ids = Object.keys(P);
    return {notes, pick(role){
      let id = roles[role] && P[roles[role]] ? roles[role] : (P[role] ? role : null);
      if(id && used.has(id)) id = null;
      if(!id){ const re = ROLE_TAGS[role]; id = ids.find(k => !used.has(k) && re && re.test(P[k].tags || '')) ||
                 (EXTERIOR[role] ? null : ids.find(k => !used.has(k) && !/exterior/i.test(P[k].tags||'')));
               if(id) notes.push({kind:'photo-stand-in', slot:'photo.' + role, photo:id}); }
      if(!id) return {id:null, src:''};
      used.add(id); return {id, src:P[id].src};
    }};
  }
  function logoFor(B, kind){
    if(kind === 'white') return B.logoKnockout || B.logoOnDark || B.logo || '';
    if(kind === 'goldondark') return B.logoOnDark || B.logoKnockout || B.logo || '';
    return B.logo || '';
  }

  // ---------------------------------------------------------------- template -> filled DOM
  function chooseTemplate(doc, side, hs, long){
    const q = s => doc.querySelector(`template[data-side="${side}"][data-hs="${hs?1:0}"][data-long="${s}"]`);
    return (long && q(1)) || q(0);
  }
  function isLong(doc, v){
    const n = Math.max(v.agentFirst.length, v.agentLast.length);
    const t = doc.querySelector('template[data-side="back"][data-long="0"]');
    const nf = t && t.content.querySelector('[data-nf]');
    if(nf){ const [avail, em] = nf.dataset.nf.split('|').map(Number); if(avail / (n * em) < 24) return true; }
    return n > 10;
  }
  const TOK = /\{\{([^}]+)\}\}/g;
  function fill(root, D, v){
    const B = D.brand || {}, pick = photoPicker(D), issues = [];
    const sub = s => s.replace(TOK, (m, k) => {
      if(k in v) return v[k];
      issues.push({kind:'unknown-token', slot:k}); return '';
    });
    root.querySelectorAll('img').forEach(im => {
      const s = im.getAttribute('src') || '';
      let m = s.match(/^\{\{photo:(\w+)\}\}$/);
      if(m){ const p = pick.pick(m[1]); im.dataset.role = m[1]; if(p.id) im.dataset.photo = p.id;
             if(p.src) im.setAttribute('src', p.src); else { im.removeAttribute('src'); im.dataset.missing = '1'; issues.push({kind:'missing-photo', slot:'photo.' + m[1]}); } return; }
      m = s.match(/^\{\{logo:(\w+)\}\}$/);
      if(m){ const src = logoFor(B, m[1]); im.dataset.logo = m[1]; if(src) im.setAttribute('src', src); else { im.removeAttribute('src'); issues.push({kind:'missing-logo', slot:'brand.logo'}); } }
    });
    root.querySelectorAll('[data-alts]').forEach(el => {
      el.dataset.alts = JSON.stringify(JSON.parse(el.dataset.alts).map(sub));
    });
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const nodes = [];
    while((n = w.nextNode())) if(n.nodeValue.indexOf('{{') >= 0) nodes.push(n);
    nodes.forEach(t => { t.nodeValue = sub(t.nodeValue); t.parentElement.dataset.tok = '1'; });
    // agent headshot into its frame (the placeholder stays only on unpaid samples)
    const hsSrc = (D.agent || {}).headshot;
    root.querySelectorAll('[data-hs]').forEach(el => {
      if(!hsSrc){ el.dataset.placeholder = '1'; return; }
      el.innerHTML = ''; const im = document.createElement('img'); im.src = hsSrc; im.alt = '';
      im.dataset.headshot = '1';
      im.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;object-position:center 25%';
      el.appendChild(im);
    });
    // agent name size from its length (the approved sizing: avail / (letters x em), within the design's limits)
    root.querySelectorAll('[data-nf]').forEach(el => {
      const [avail, em, capPx, min] = el.dataset.nf.split('|').map(Number);
      const lines = el.innerHTML.split(/<br\s*\/?>/i).map(h => h.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, 'x')), n = Math.max(...lines.map(s => s.trim().length), 1);
      el.style.fontSize = (Math.round(Math.max(min, Math.min(capPx, avail / (n * em))) * 10) / 10) + 'px';
    });
    return issues.concat(pick.notes);
  }

  // ---------------------------------------------------------------- copy fitting and the rules
  function lineBoxes(el){ const r = document.createRange(); r.selectNodeContents(el); const L = [];
    for(const x of r.getClientRects()){ if(x.width < 1) continue; const t = Math.round(x.top); let g = L.find(o => Math.abs(o.t - t) < 4);
      if(!g) L.push({t, l:x.left, r:x.right}); else { g.l = Math.min(g.l, x.left); g.r = Math.max(g.r, x.right); } }
    return L.sort((a,b) => a.t - b.t); }
  function stat(el, scale){ const L = lineBoxes(el), w = el.clientWidth * scale; return {n:L.length, last:L.length ? (L[L.length-1].r - L[L.length-1].l) / w : 0}; }

  function layout(card, D, front){
    const issues = [], notes = [];
    const scale = card.getBoundingClientRect().width / W || 1;
    const R = el => { const c = card.getBoundingClientRect(), r = el.getBoundingClientRect();
      return {left:(r.left-c.left)/scale, top:(r.top-c.top)/scale, right:(r.right-c.left)/scale, bottom:(r.bottom-c.top)/scale, width:r.width/scale, height:r.height/scale}; };
    // seller pitch: the combination of sentences that fills the planned lines best
    card.querySelectorAll('.fill').forEach(el => {
      const A = JSON.parse(el.dataset.alts), n = +el.dataset.lines, min = +el.dataset.min;
      const fs0 = parseFloat(getComputedStyle(el).fontSize); let best = null;
      outer: for(const d of [0,-0.25,0.25,-0.5,0.5]){ el.style.fontSize = (fs0 + d) + 'px';
        for(const a of A){ el.textContent = a; const s = stat(el, scale); if(s.n !== n) continue;
          if(!best || s.last > best.last) best = {a, d, last:s.last}; if(s.last >= min) break outer; } }
      if(best){ el.style.fontSize = (fs0 + best.d) + 'px'; el.textContent = best.a; }
      else issues.push({kind:'copy-fit', slot:'copy.pitch', lines:n});
      if(best && best.last < 0.6) notes.push({kind:'copy-short-last-line', slot:'copy.pitch', last:+best.last.toFixed(2)});
    });
    // Filled-in lines that run long (a long agent name or street) shrink as a unit until they fit, never under 8 pt
    // and never under 60% of the approved size. Whatever still doesn't fit is reported and blocks the print file.
    const blocks = new Set();
    card.querySelectorAll('[data-tok]').forEach(t => { let el = t;
      while(el && el !== card){ if(el.clientWidth > 0 && getComputedStyle(el).whiteSpace === 'nowrap' && getComputedStyle(el).display !== 'inline'){ blocks.add(el); break; } el = el.parentElement; } });
    blocks.forEach(el => {
      if(el.scrollWidth <= el.clientWidth + 1) return;
      const items = [el, ...el.querySelectorAll('*')].map(x => ({x, fs:parseFloat(getComputedStyle(x).fontSize)}));
      const minFs = Math.min(...items.filter(i => i.x.childNodes.length && [...i.x.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim())).map(i => i.fs).concat([999]));
      let k = 1;
      while(el.scrollWidth > el.clientWidth + 1 && k > 0.6 && minFs * (k - 0.02) >= 10.67){ k -= 0.02; items.forEach(i => i.x.style.fontSize = (i.fs * k) + 'px'); }
      if(k < 1) notes.push({kind:'line-shrunk-to-fit', slot:'text', text:el.textContent.trim().slice(0,30), scale:+k.toFixed(2)});
    });
    // Roofline (rule, 10/24): never cut off the top of the house. Exterior photos with a known house box get recropped.
    card.querySelectorAll('img[data-photo]').forEach(im => {
      const P = (D.photos || {})[im.dataset.photo] || {}, hb = P.house; if(!hb || !im.naturalWidth) return;
      if(getComputedStyle(im).borderRadius.indexOf('50%') >= 0) return;
      const ew = im.clientWidth, eh = im.clientHeight, s = Math.max(ew / im.naturalWidth, eh / im.naturalHeight);
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      const pos = getComputedStyle(im).objectPosition.split(' ');
      const pc = (v, room) => v.endsWith('%') ? parseFloat(v) / 100 : (room === 0 ? 0 : -parseFloat(v) / room);
      let px = pc(pos[0], dw - ew), py = pc(pos[1] || '50%', dh - eh);
      const top = () => (dh - eh) * py / dh, need = hb.top - 0.025;
      if(top() > need + 0.0005){ py = Math.max(0, need * dh / Math.max(1, dh - eh)); im.style.objectPosition = (px * 100) + '% ' + (py * 100) + '%';
        if(top() > need + 0.0005) issues.push({kind:'roof-cut', slot:'photo.' + im.dataset.role}); else notes.push({kind:'roof-crop-fixed', slot:'photo.' + im.dataset.role}); }
      const left = (dw - ew) * px / dw, right = left + ew / dw;
      if(hb.left < left - 0.01 || hb.right > right + 0.01) notes.push({kind:'house-sides-cropped', slot:'photo.' + im.dataset.role});
    });
    // No-headshot card (rule, 10/24): the name's top lines up with the phone number's top; the pair is centered in its space.
    card.querySelectorAll('[data-nohs]').forEach(el => {
      const nm = el.querySelector('.nm'), cc = el.querySelector('#cc'); if(!nm || !cc) return;
      const nTop = nm.querySelector('div').getBoundingClientRect().top, pTop = cc.firstElementChild.getBoundingClientRect().top;
      nm.style.top = (parseFloat(nm.style.top || 0) + (pTop - nTop) / scale) + 'px';
      const a = nm.getBoundingClientRect(), b = cc.getBoundingClientRect(), o = el.getBoundingClientRect();
      const d = ((o.top + o.height / 2) - (Math.min(a.top, b.top) + Math.max(a.bottom, b.bottom)) / 2) / scale;
      nm.style.top = (parseFloat(nm.style.top) + d) + 'px'; cc.style.top = (parseFloat(cc.style.top || 0) + d) + 'px';
      el.querySelectorAll(':scope > div:not(.nm):not(#cc)').forEach(v => { if(v.offsetWidth < 3) v.style.top = (parseFloat(v.style.top || 0) + d) + 'px'; });
    });
    // ---- print checks
    const Z = front ? {} : ZONES;
    const hit = (r, z) => r.left < z[0] + z[2] && r.right > z[0] && r.top < z[1] + z[3] && r.bottom > z[1];
    const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT); let nd;
    while((nd = w.nextNode())){ if(!nd.textContent.trim()) continue; const p = nd.parentElement; if(p.closest('[data-z]')) continue;
      const fsPx = parseFloat(getComputedStyle(p).fontSize), fine = !!p.closest('[data-k="disc"]');
      if(fsPx * 0.75 < (fine ? 6 : 8) - 0.05) issues.push({kind:'type-too-small', slot:'text', text:nd.textContent.trim().slice(0,30), pt:+(fsPx*0.75).toFixed(1)});
      const rg = document.createRange(); rg.selectNodeContents(nd);
      for(const q of rg.getClientRects()){ if(q.width < 1) continue; const c = card.getBoundingClientRect();
        const r = {left:(q.left-c.left)/scale, right:(q.right-c.left)/scale, top:(q.top-c.top)/scale, bottom:(q.bottom-c.top)/scale};
        for(const k in Z) if(hit(r, Z[k])) issues.push({kind:'text-in-mail-zone', slot:k, text:nd.textContent.trim().slice(0,30)});
        // letters (not their line box) stay 1/4 in inside the trim
        const fs = fsPx, inkTop = r.top + Math.max(0, (r.bottom - r.top - fs) / 2) + fs * 0.24, inkBot = r.bottom - Math.max(0, (r.bottom - r.top - fs) / 2) - fs * 0.14;
        // outside the 1/8 in safe area = a print problem; inside it but within 1/4 in of the trim = a note
        if(r.left < 12 || inkTop < 12 || r.right > W - 12 || inkBot > H - 12) issues.push({kind:'text-outside-safe-area', slot:'text', text:nd.textContent.trim().slice(0,30)});
        else if(r.left < 23 || inkTop < 14 || r.right > 841 || inkBot > 553) notes.push({kind:'text-near-trim', slot:'text', text:nd.textContent.trim().slice(0,30)});
      } }
    card.querySelectorAll('img, [data-blk]').forEach(el => { if(el.closest('[data-z]')) return; const r = R(el);
      for(const k in Z) if(hit(r, Z[k])) issues.push({kind:'image-in-mail-zone', slot:k}); });
    card.querySelectorAll('*').forEach(el => { if(el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).whiteSpace === 'nowrap' && el.clientWidth > 0)
      issues.push({kind:'overflow', slot:el.closest('[data-nf],[data-k="ret"]') ? 'agent.name' : 'text', text:el.textContent.trim().slice(0,30)}); });
    if(!front){ const A = {l:532, t:242, r:W, b:H};
      card.querySelectorAll('*').forEach(el => { if(el.closest('[data-z]')) return; const cs = getComputedStyle(el);
        const vis = el.tagName === 'IMG' || (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'rgb(255, 255, 255)') || cs.backgroundImage !== 'none';
        if(!vis) return; const r = R(el); if(r.width < 2 || r.height < 2) return;
        if(r.left <= A.l && r.right >= A.r && r.top <= A.t && r.bottom >= Math.min(A.b, 408)) return;   // full-width bands behind the block
        if(r.left < A.r && r.right > A.l && r.top < Math.min(A.b, 408) && r.bottom > A.t) issues.push({kind:'touches-address-block', slot:(el.dataset.role || el.tagName.toLowerCase())}); }); }
    { const ims = [...card.querySelectorAll('img')].filter(i => !i.closest('[data-z]') && i.offsetWidth > 40 && !i.dataset.logo && !i.dataset.headshot).map(R);
      for(let i = 0; i < ims.length; i++) for(let j = 0; j < ims.length; j++){ if(i === j) continue; const a = ims[i], b = ims[j], g = b.left - a.right; if(g < 0 || g > 40) continue;
        const ov = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if(ov < 0.5 * Math.min(a.height, b.height)) continue;
        if(Math.abs(a.top - b.top) > 2 || Math.abs(a.bottom - b.bottom) > 2) notes.push({kind:'row-not-aligned', slot:'photos'}); } }
    card.querySelectorAll('img[data-photo]').forEach(im => { if(!im.naturalWidth) return; const r = R(im);
      const ppi = Math.min(im.naturalWidth / (r.width / 96), im.naturalHeight / (r.height / 96));
      if(ppi < 299) issues.push({kind:'photo-under-300ppi', slot:'photo.' + im.dataset.role, ppi:Math.round(ppi)}); });
    if((D.paid || D.mode === 'print') && card.querySelector('[data-placeholder]') && (D.agent||{}).headshotWanted) issues.push({kind:'headshot-placeholder', slot:'agent.headshot'});
    if(!front && !(D.brand || {}).returnAddress) issues.push({kind:'missing-return-address', slot:'brand.returnAddress'});
    return {issues, notes};
  }

  // Print file: the review marks in the mail area don't print (the white areas stay), and the art runs 1/8 in past the trim.
  function forPrint(card){
    card.querySelectorAll('[data-z]').forEach(el => {
      const bg = getComputedStyle(el).backgroundColor;
      if(!bg || bg === 'rgba(0, 0, 0, 0)') { el.style.visibility = 'hidden'; return; }
      const cs = getComputedStyle(el);   // dashed and dotted lines are review marks; solid frames are part of the design
      if(/dashed|dotted/.test(cs.borderTopStyle)) el.style.border = 'none';
      el.style.color = 'transparent';
      [...el.childNodes].forEach(c => { if(c.nodeType === 3) c.nodeValue = ''; else c.style && (c.style.visibility = 'hidden'); });
    });
    [...card.children].forEach(el => {
      if(el.tagName === 'SCRIPT') return;
      const s = el.style, l = el.offsetLeft, t = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
      if(getComputedStyle(el).position !== 'absolute') return;
      const ext = {l: l <= 0.5, t: t <= 0.5, r: l + w >= W - 0.5, b: t + h >= H - 0.5};
      if(!(ext.l || ext.t || ext.r || ext.b)) return;
      if(ext.l){ s.left = (l - BLEED_PX) + 'px'; s.width = (w + BLEED_PX) + 'px'; }
      if(ext.r){ s.width = ((ext.l ? w + BLEED_PX : w) + BLEED_PX) + 'px'; }
      if(ext.t){ s.top = (t - BLEED_PX) + 'px'; s.height = (h + BLEED_PX) + 'px'; }
      if(ext.b){ s.height = ((ext.t ? h + BLEED_PX : h) + BLEED_PX) + 'px'; }
      s.boxSizing = 'border-box';
    });
  }

  // ---------------------------------------------------------------- public: draw one side
  function draw(doc, host, D, side, opts){
    opts = opts || {};
    const v = values(D);
    const hs = !!(D.agent || {}).headshot || !!(D.agent || {}).headshotPlaceholder || !!opts.headshot;
    const long = isLong(doc, v);
    const tpl = chooseTemplate(doc, side, hs, long);
    if(!tpl) throw new Error('no template for ' + side);
    const frag = tpl.content.cloneNode(true);
    const card = frag.querySelector('#card');
    card.removeAttribute('id'); card.classList.add('js-card');
    const filled = fill(card, D, v);
    host.appendChild(card);
    if(hs && !(D.agent || {}).headshot) card.querySelectorAll('[data-hs]').forEach(el => el.dataset.placeholder = '1');
    const imgs = [...card.querySelectorAll('img')].filter(i => i.getAttribute('src'));
    // load every face the card uses before measuring (copy fitting depends on the real letter widths)
    const faces = new Set();
    [card, ...card.querySelectorAll('*')].forEach(el => { const cs = getComputedStyle(el);
      faces.add(`${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}`); });
    return Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))
      .then(() => Promise.all([...faces].map(f => document.fonts.load(f).catch(() => null))))
      .then(() => document.fonts.ready)
      .then(() => { const r = layout(card, D, side === 'front'); if(opts.print) forPrint(card);
        return {card, issues:filled.filter(x => x.kind !== 'photo-stand-in').concat(r.issues), notes:filled.filter(x => x.kind === 'photo-stand-in').concat(r.notes),
                variant:{side, headshot:hs, longName:long}}; });
  }

  const JSLib = window.JSLib = {values, draw,
    // site preview: designHtml is the text of a design file (e.g. m05.html)
    mount(container, designHtml, D, opts){
      const doc = new DOMParser().parseFromString(designHtml, 'text/html');
      container.innerHTML = '';
      return draw(doc, container, D, (opts || {}).side || 'back', opts);
    },
    fontLinks(designHtml){ return (designHtml.match(/<link [^>]*fonts\.googleapis[^>]*>/g) || []); },
  };

  // ---------------------------------------------------------------- renderer page
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('brochure-data'); if(!el) return;
    const D = JSON.parse(el.textContent || '{}'); if(!D.piece) return;
    const print = D.mode === 'print', side = D.piece.side;
    const pages = document.getElementById('pages');
    const page = document.createElement('div'); page.className = 'page' + (print ? ' bleed' : ''); page.dataset.page = side;
    pages.appendChild(page);
    const bleedPt = print ? 9 : 0;
    window.pieceSize = {W:648 + 2 * bleedPt, H:432 + 2 * bleedPt, bleed:bleedPt};
    window.photoPlacements = () => [...page.querySelectorAll('img[data-photo]')].map(im => ({src:im.getAttribute('src'), w:im.clientWidth / 96, h:im.clientHeight / 96}));
    window.brochureReady = draw(document, page, D, side, {print}).then(r => {
      if(print) page.style.background = getComputedStyle(r.card).backgroundColor;
      const need = (D.piece.needs || []).filter(k => !(D.sold || {})[k]);
      need.forEach(k => r.issues.push({kind:'missing-sale-fact', slot:'sold.' + k}));
      window.proofNotes = r.notes;
      document.body.dataset.version = (r.variant.headshot ? 'headshot' : 'no-headshot') + (r.variant.longName ? '-long-name' : '');
      window.brochureCheck = () => r.issues;
      return true;
    });
  });
})();
