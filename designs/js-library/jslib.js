/* BrochureDesk Just Sold postcard library: runtime for every design in templates/js-library/.
   Each design file holds <template> elements made by scripts/build_js_library.py from the approved design scripts:
   data-side front|back, data-hs 1|0 (agent has a headshot), data-long 1 (long-name layout, where one exists).
   This fills the {{tokens}} from the listing and agent data, sizes the agent name, fits the copy, applies the
   roofline / alignment rules, and runs the print checks.

   Renderer (renderer/render.py): the page reads #brochure-data (with data.piece and data.mode) and draws itself.
   Site preview:   JSLib.mount(container, designHtmlText, data, {side:'back'}) returns a promise with the checks. */
(function(){
  const W0 = 864, H = 576, BLEED_PX = 12;            // 6 x 9 card: 9 x 6 in at 96 px/in; 0.125 in bleed. 6 x 11 is 1056 px wide.
  const WIDE = 1056;
  // mail zones on a 6 x 9 back; on a 6 x 11 back they sit the same distance from the right edge
  const zones = dx => ({postage:[736+dx,16,112,131], address:[540+dx,250,320,150], barcode:[408+dx,516,456,60]});
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
    // "Name on mailers" from the agent's profile when they set one (a shorter form of a long name), else their name
    const name = (A.mailerName || A.name || '').trim(), np = name.split(/\s+/);
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
  // Which listing photo fills each photo spot the design asks for. Photos carry a label from the photo-tags step
  // (package-ai "tag-photos": front, side, back, kitchen, primary...). Each spot takes the first unused photo whose
  // label is on its list, in order, so nothing repeats anywhere on the card, front or back.
  const ROLE_LABELS = {front:['front'], family:['side','front','back'], lawn:['back','patio','pool','yard','side'],
    kitchen:['kitchen'], kitchen2:['kitchen','dining','nook'], living:['living','family'], dining:['dining','nook','living','kitchen'],
    nook:['nook','dining','kitchen'], primary:['primary','bedroom'], bedroom2:['bedroom','primary'], study:['bedroom','office'],
    office:['bath','office','bedroom'], hall:['entry','stairs','living','family']};
  function assignPhotos(D, roles){
    const P = D.photos || {}, fixed = D.photoRoles || {}, ids = Object.keys(P), used = new Set(), map = {}, notes = [];
    const labeled = ids.some(k => P[k].role);
    roles.forEach(role => {
      if(role in map) return;
      let id = fixed[role] && P[fixed[role]] && !used.has(fixed[role]) ? fixed[role] : null;
      if(!id && !labeled && P[role] && !used.has(role)) id = role;                      // sample data names photos by role
      if(!id && labeled) for(const lab of (ROLE_LABELS[role] || [])){ id = ids.find(k => !used.has(k) && P[k].role === lab); if(id) break; }
      if(!id){ const re = ROLE_TAGS[role]; id = ids.find(k => !used.has(k) && re && re.test((P[k].tags || '') + ' ' + (P[k].note || ''))) || null; }
      if(!id && !EXTERIOR[role]) id = ids.find(k => !used.has(k) && !P[k].exterior && !/exterior/i.test(P[k].tags || '')) || null;
      if(id && !(fixed[role] === id || (!labeled && id === role) || (labeled && (ROLE_LABELS[role] || [])[0] === P[id].role))) notes.push({kind:'photo-stand-in', slot:'photo.' + role, photo:id});
      if(id) used.add(id);
      map[role] = id;
    });
    return {map, notes};
  }
  const rolesIn = tpls => { const out = []; tpls.forEach(t => t && (t.innerHTML.match(/\{\{photo:(\w+)\}\}/g) || []).forEach(m => { const r = m.slice(8, -2); if(out.indexOf(r) < 0) out.push(r); })); return out; };
  function photoPicker(D, assigned){
    const P = D.photos || {};
    return {notes:assigned.notes, pick(role){ const id = assigned.map[role]; return id ? {id, src:P[id].src} : {id:null, src:''}; }};
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
  function fill(root, D, v, assigned){
    const B = D.brand || {}, pick = photoPicker(D, assigned), issues = [];
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
    const W = card.offsetWidth || W0, dx = W - W0;
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
      // a wider card (6 x 11) can run out of sentences: set the type up to 1 px larger, then plan a line or two fewer
      if(!best) fallback: for(const n2 of [n, n - 1, n - 2]) for(const d of [0.75, 1, 0, 0.5]){ el.style.fontSize = (fs0 + d) + 'px';
        for(const a of A){ el.textContent = a; const s = stat(el, scale); if(s.n !== n2) continue;
          if(!best || s.last > best.last) best = {a, d, last:s.last}; if(s.last >= min) break fallback; } }
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
      // 6 x 11 (rule, 10/24): never cut off the top or the bottom of the house. The whole house has to fit the frame's height.
      // (a little sky and ground around it when there's room; the house itself is the limit)
      if(dx > 0){ const fv = eh / dh, room = fv - (hb.bottom - hb.top);
        if(room < -0.002) issues.push({kind:'house-cut', slot:'photo.' + im.dataset.role, fits:+(fv / (hb.bottom - hb.top)).toFixed(2)});
        else if(top() + fv < hb.bottom + Math.min(0.01, room / 3) - 0.0005){
          const want = Math.max(0, Math.min(hb.top - Math.min(0.025, room * 2 / 3), 1 - fv));
          py = Math.min(1, Math.max(0, want * dh / Math.max(1, dh - eh))); im.style.objectPosition = (px * 100) + '% ' + (py * 100) + '%';
          notes.push({kind:'house-bottom-crop-fixed', slot:'photo.' + im.dataset.role}); } }
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
    const Z = front ? {} : zones(dx);
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
        else if(r.left < 23 || inkTop < 14 || r.right > W - 23 || inkBot > 553) notes.push({kind:'text-near-trim', slot:'text', text:nd.textContent.trim().slice(0,30)});
      } }
    card.querySelectorAll('img, [data-blk]').forEach(el => { if(el.closest('[data-z]')) return; const r = R(el);
      for(const k in Z) if(hit(r, Z[k])) issues.push({kind:'image-in-mail-zone', slot:k}); });
    card.querySelectorAll('*').forEach(el => { if(el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).whiteSpace === 'nowrap' && el.clientWidth > 0)
      issues.push({kind:'overflow', slot:el.closest('[data-nf],[data-k="ret"]') ? 'agent.name' : 'text', text:el.textContent.trim().slice(0,30)}); });
    if(!front){ const A = {l:532 + dx, t:242, r:W, b:H};
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
    const W = card.offsetWidth || W0;
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

  // 6 x 11: the same design on the wider card. Fronts stretch evenly. On backs the mail side (postage, address block,
  // barcode strip and anything above the address block) keeps its size and moves right; the design side grows from
  // 528 to 720 px, so photos get wider and the seller pitch picks more sentences to fill its planned lines.
  function widen(card, front){
    const dx = WIDE - W0, kF = WIDE / W0, kL = (528 + dx) / 528;
    card.style.width = WIDE + 'px';
    [...card.children].forEach(el => {
      if(el.tagName === 'SCRIPT' || getComputedStyle(el).position !== 'absolute') return;
      const cr = card.getBoundingClientRect(), er = el.getBoundingClientRect();   // (SVG has no offsetLeft)
      const l = er.left - cr.left, w = er.width, t = er.top - cr.top, r = l + w, s = el.style;
      if(s.right && s.right !== 'auto' && !s.left) return;   // pinned to the right edge: it stays there
      let nl, nr;
      if(front){ nl = l * kF; nr = r * kF; }
      else if(el.hasAttribute('data-z') || l >= 528){ nl = l + dx; nr = r + dx; }
      else if(r <= 532){ nl = l * kL; nr = (t >= 500 && Math.abs(r - 408) < 1) ? 408 + dx : Math.min(r * kL, r > 520 ? 528 + dx - 8 : 1e9); }
      else { nl = l * kL; nr = r + dx; }
      // circles and other round shapes keep their size; only their center moves
      const br = getComputedStyle(el).borderTopLeftRadius;
      if(br.indexOf('%') >= 0 ? parseFloat(br) >= 40 : parseFloat(br) >= Math.min(w, el.offsetHeight) / 2 - 1){ const c = (nl + nr) / 2; nl = c - w / 2; nr = c + w / 2; }
      s.left = nl + 'px'; s.width = (nr - nl) + 'px'; s.right = 'auto'; s.boxSizing = 'border-box';
      if(el.tagName.toLowerCase() === 'svg'){   // drawn frames and waves follow the new width
        const nw = nr - nl; el.setAttribute('width', nw);
        if(el.getAttribute('viewBox')) el.setAttribute('preserveAspectRatio', 'none');
        else el.querySelectorAll('rect').forEach(rc => { const x = +rc.getAttribute('x'), rw = +rc.getAttribute('width');
          if(x < 60 && x + rw > w - 60) rc.setAttribute('width', rw + nw - w); });
      }
    });
  }

  // ---------------------------------------------------------------- 6 x 11 changes from the review (10/24/2026)
  // Each design can change its 6 x 11 sides after widen(): move or resize parts, add photos, set type sizes.
  // roles: extra photo spots the 6 x 11 side adds (they are picked after the design's own spots, so nothing repeats).
  // h.q('photo:front') finds a photo by its spot; h.q('Just Sold') finds the smallest part whose text contains the words.
  function helpers(card, pick, v, issues){
    const kids = () => [...card.querySelectorAll('*')];
    const h = {
      q(m, all){ let r;
        if(/^photo:/.test(m)) r = kids().filter(e => e.tagName === 'IMG' && e.dataset.role === m.slice(6));
        else if(/^logo/.test(m)) r = kids().filter(e => e.tagName === 'IMG' && e.dataset.logo);
        else if(m === 'hs') r = kids().filter(e => e.hasAttribute('data-hs'));
        else if(m === 'fill') r = kids().filter(e => e.classList.contains('fill'));   // the seller pitch (its words go in later)
        else { const lo = m.toLowerCase(); r = kids().filter(e => (e.textContent || '').toLowerCase().indexOf(lo) >= 0);
          r = r.filter(e => !r.some(o => o !== e && e.contains(o))); }
        return all ? r : r[0]; },
      // top-level part that holds el (what widen() placed)
      top(el){ while(el && el.parentElement !== card) el = el.parentElement; return el; },
      box(el, l, t, w, hh){ if(!el) return el; const s = el.style; if(l != null) s.left = l + 'px'; if(t != null) s.top = t + 'px';
        if(w != null) s.width = w + 'px'; if(hh != null) s.height = hh + 'px'; s.right = 'auto'; if(t != null) s.bottom = 'auto'; s.boxSizing = 'border-box'; return el; },
      css(el, o){ if(el) Object.assign(el.style, o); return el; },
      rect(el){ const c = card.getBoundingClientRect(), r = el.getBoundingClientRect(), k = c.width / card.offsetWidth;
        return {l:(r.left-c.left)/k, t:(r.top-c.top)/k, w:r.width/k, h:r.height/k, r:(r.right-c.left)/k, b:(r.bottom-c.top)/k}; },
      // a new photo spot, styled like another photo on the card (corners, border); placed right after that photo
      photo(role, l, t, w, hh, like){
        const im = document.createElement('img'), p = pick.pick(role); im.alt = ''; im.dataset.role = role;
        if(like) im.style.cssText = like.style.cssText;
        im.style.position = 'absolute'; im.style.objectFit = 'cover'; im.style.objectPosition = 'center';
        if(p.id){ im.dataset.photo = p.id; im.src = p.src; } else { im.dataset.missing = '1'; issues.push({kind:'missing-photo', slot:'photo.' + role}); }
        if(like && like.parentElement) like.after(im); else card.appendChild(im);
        return h.box(im, l, t, w, hh); },
      text(s){ return s.replace(TOK, (m, k) => k in v ? v[k] : ''); },
      parts(){ return [...card.children].filter(e => e.tagName !== 'SCRIPT'); },
      // copy that has to fill its lines: the fitter picks the version that fills them best (same as the seller pitch)
      fill(el, alts, lines, min){ el.classList.add('fill'); el.dataset.alts = JSON.stringify(alts.map(h.text)); el.dataset.lines = lines; el.dataset.min = min || 0.85; return el; },
      v,
    };
    return h;
  }
  // A front photo shows the whole house when its frame is no wider than about 2 x its height (listing photos are 3:2).
  const WIDE11 = {
    M06: {back:{roles:['dining'], run(h){   // two horizontals side by side, the Just Sold circle on the seam between them
      const a = h.q('photo:kitchen2'), c = h.top(h.q('Just'));
      h.box(a, 33, 24, 322, 214); h.photo('dining', 367, 24, 323, 214, a);
      const cr = h.rect(c); h.box(c, 361 - cr.w / 2, 131 - cr.h / 2); }}},
    M09: {front:{roles:['kitchen2'], run(h){   // a second skinny photo so the main photo can show the whole house
      const k = h.q('photo:kitchen'); h.box(h.q('photo:front'), 29, null, 660); h.box(k, 696, null, 161);
      h.photo('kitchen2', 864, 24, 162, 330, k);
      const j = h.rect(h.top(h.q('Just Sold'))), line = h.top(h.q('just sold.')), s = h.rect(h.top(h.q('Another success')));
      const jb = j.t + j.h * 0.9;   // bottom of the J's tail
      h.box(line, null, (jb + s.t) / 2 - h.rect(line).h / 2); }}},
    M14: {front:{run(h){   // a fourth point (three looked sparse)
      const last = h.q('A plan that fits'), list = last.parentElement, b = last.cloneNode(true);
      b.lastChild.nodeValue = 'Repairs worth making first'; list.appendChild(b);
      h.css(list, {gap:'12px'});   // centered top to bottom between the paragraph and the rule under the points
      const para = h.rect(h.top(h.q('Thinking about selling'))), rule = h.parts().find(e => { const r = h.rect(e); return r.h < 4 && r.w > 100 && r.t > para.b; });
      h.box(list, null, (para.b + h.rect(rule).t) / 2 - h.rect(list).h / 2); }}},
    M16: {front:{run(h){   // about two more lines
      h.q('glad to show you').textContent = 'I’d be glad to show you what your home could sell for and how I’d market it. You’ll get the recent sales near you, a clear price range and a plan that fits your timing. I can also tell you which repairs are worth making before you list and which ones aren’t. Call me to get started.'; }}},
    M23: {back:{run(h){   // the "Another home sold" block centered top to bottom on the photo beside it
      const parts = ['ANOTHER HOME', 'SOLD', 'BY ', h.v.street, 'private consultation'].map(t => h.top(h.q(t)));
      parts.forEach(e => h.css(e, {fontSize:(parseFloat(getComputedStyle(e).fontSize) + 1.35) + 'px'}));   // about 1 pt bigger than the write-up (recheck)
      const R = parts.map(h.rect), p = h.rect(h.q('photo:dining'));
      const d = (p.t + p.b) / 2 - (Math.min(...R.map(r => r.t)) + Math.max(...R.map(r => r.b))) / 2;
      parts.forEach((e, i) => h.box(e, null, R[i].t + d)); }}},
    M26: {front:{run(h){   // the plain white logo, no box behind it
      h.css(h.q('logo').parentElement, {background:'transparent'}); h.css(h.q('logo'), {filter:'drop-shadow(0 1px 4px rgba(0,0,0,.45))'}); }},
      back:{run(h){        // the long photo ends level with the photo beside it; the write-up moves up and gets a fifth line
      const k = h.rect(h.q('photo:kitchen2')), d = 250 - k.b;
      h.box(h.q('photo:lawn'), null, 0, null, k.b);
      ['JUST SOLD', h.v.street, 'Thinking about selling?'].forEach(t => { const e = h.top(h.q(t)); h.box(e, null, h.rect(e).t - d); });
      const f = h.top(h.q('fill')); h.box(f, null, h.rect(f).t - d); f.dataset.lines = 5; }}},
    M27: {front:{run(h){   // two or three more lines
      const a = 'If you’ve thought about selling, call me. I’ll show you what your home could bring, how I’d market it and what the recent sales near you mean for your price.';
      h.fill(h.q('thought about selling'), [   // five full lines (recheck: the last line has to be full)
        a + ' I can also tell you which repairs are worth making before you list and which ones aren’t. Let’s set a time to talk.',
        a + ' You’ll get a clear price range and a plan that fits your timing. Let’s set a time to talk.',
        a + ' I can also tell you which repairs are worth making before you list. You’ll get a clear price range and a plan that fits your timing.',
        a + ' You’ll get a clear price range, a plan that fits your timing and an honest list of the repairs worth making first. Let’s set a time to talk.',
        a + ' I can also tell you which repairs are worth making before you list. Let’s set a time to talk.',
        a + ' I can also tell you which repairs are worth making before you list and which ones aren’t. You’ll get a clear price range and a plan that fits your timing.',
        a + ' I can also tell you which repairs are worth making before you list, so you don’t spend money where it won’t pay off. Let’s set a time to talk.',
        a + ' You’ll get a clear price range, a plan that fits your timing and an honest read on which repairs are worth making first. Let’s set a time to talk.',
        a + ' I can also tell you which repairs are worth making before you list and which ones aren’t. You’ll get a clear price range and a plan that fits your timing. Let’s talk.',
        a + ' You’ll get a clear price range, a plan that fits your timing and an honest read on which repairs are worth making first. Call or text me to set a time.',
        a + ' I can also tell you which repairs are worth making before you list, so you don’t spend money where it won’t pay off. Call or text me to set a time to talk.'], 5, 0.85); }}},
    M34: {front:{run(h){   // name and number larger and a little lower; a callout of its own (the back keeps "Thinking about selling?")
      const n = h.top(h.q(h.v.agentName)), p = h.top(h.q(h.v.agentPhone));
      h.css(n, {fontSize:'24px'}); h.box(n, null, 440); h.css(p, {fontSize:'21px'}); h.box(p, null, 472);
      h.q('Thinking about selling?').textContent = 'Curious what your home is worth in today’s market? Let’s set a time to talk.'; }}},
    M42: {front:{roles:['kitchen', 'dining'], run(h){   // a shorter main photo so the whole house shows, two interiors stacked beside it
      const f = h.q('photo:front'), r = h.rect(f), w = 640, x = r.l + w + 8, cw = r.r - x, ch = (r.h - 8) / 2;
      h.box(f, null, null, w); h.photo('kitchen', x, r.t, cw, ch, f); h.photo('dining', x, r.t + ch + 8, cw, ch, f);
      const t = h.top(h.q('ANOTHER HOME SOLD')), lg = h.rect(h.q('logo'));   // larger, centered on the logo's height (recheck)
      h.css(t, {fontSize:'22px'}); h.box(t, null, (lg.t + lg.b) / 2 - h.rect(t).h / 2); }}},
    M48: {back:{run(h){    // the four-photo row with even gaps, from under the J to just short of the postage area
      [['dining', 33, 322], ['living', 363, 180], ['bedroom2', 551, 180], ['nook', 739, 181]].forEach(([r, l, w]) => h.box(h.q('photo:' + r), l, null, w)); }}},
    M49: {back:{roles:['bedroom2'], run(h){   // the same four-photo row as M48
      const d = h.q('photo:dining'), t = h.rect(d).t, hh = h.rect(d).h;
      [['dining', 0, 200], ['nook', 208, 296], ['primary', 720, 200]].forEach(([r, l, w]) => h.box(h.q('photo:' + r), l, null, w));
      h.photo('bedroom2', 512, t, 200, hh, h.q('photo:nook')); }}},
    'M30-BLACK': {front:{run(h){   // the agent's name and number larger
      const n = h.top(h.q(h.v.agentName)), p = h.top(h.q(h.v.agentPhone));
      h.css(n, {fontSize:'34px'}); h.box(n, null, 465); h.css(p, {fontSize:'15px'}); h.box(p, null, 512); }}},
    'M30-RED': {front:{run(h){   // the logo a little bigger
      const lg = h.q('logo'); h.css(lg, {width:'150px', height:'38px', marginTop:'0', objectPosition:'right center'});
      h.css(lg.parentElement, {alignItems:'center'}); }}},   // centered top to bottom on "Your home could be next" and the line under it (recheck)
    'M30-GREEN': {front:{run(h){   // heading up and tighter; a taller, wider middle photo that shows the whole house; side photos a little narrower
      const at = (e, y) => h.box(e, null, y), parts = h.parts().map(e => [e, h.rect(e)]);
      at(h.top(h.q('ANOTHER HOME SOLD')), 34); at(h.top(h.q('Just Sold')), 44); at(h.top(h.q(h.v.STREET)), 155);
      parts.forEach(([e, r]) => { if(r.t > 140 && r.b < 175) at(e, r.t - 21); });            // the rule and its diamond
      const frames = parts.filter(([e, r]) => e.querySelector('img[data-role]') && r.t > 200 && r.t < 240).map(([e]) => e);
      [[29, 215], [258, 540], [812, 215]].forEach(([l, w], i) => h.box(frames[i], l, 178, w, 260));
      at(h.top(h.q('Curious what')), 450); }}},
    // ---- approved cards changed for the 6 x 11 rule "never cut off the top or bottom of a house" (10/24)
    M33: {front:{roles:['kitchen'], run(h){
      const f = h.q('photo:front'); h.box(f, 49, null, 760); h.photo('kitchen', 817, h.rect(f).t, 190, h.rect(f).h, f); }},
      back:{roles:['kitchen2'], run(h){
      const f = h.q('photo:lawn'); h.box(f, 0, null, 700); h.photo('kitchen2', 708, h.rect(f).t, 212, h.rect(f).h, f); }}},
    M41: {front:{roles:['dining', 'primary'], run(h){
      const f = h.q('photo:front'); h.box(f, 0, 0, 716, 448);
      h.photo('dining', 724, 0, 332, 220, f); h.photo('primary', 724, 228, 332, 220, f); }}},
    // ---- specialty cards (sale details). plain(): the plain version leaves the sale detail out.
    M11: {front:{roles:['dining', 'nook'], run(h){   // a smaller front photo that shows the whole house, two interiors stacked beside it
      const f = h.q('photo:front'); h.box(f, 0, 0, 700, 396);
      h.photo('dining', 708, 0, 348, 194, f); h.photo('nook', 708, 202, 348, 194, f);
      // recheck: two or three full lines under "Thinking about selling?"; the column moves up to make room
      const col = h.parts().filter(e => { const r = h.rect(e); return r.l > 360 && r.l < 700 && r.t > 400 && r.h < 60; });
      col.forEach(e => h.box(e, null, h.rect(e).t - 10));
      const t = h.top(h.q('show you what your home could bring')); h.box(t, null, h.rect(h.top(h.q('Thinking about selling?'))).b + 6);
      h.fill(t, ['I’ll show you what your home could bring, how I’d market it and what the recent sales near you mean for your price.',
        'I’ll show you what your home could bring and how I’d market it. You’ll get a clear price range and a plan for your timing.',
        'I’ll walk you through the recent sales near you, show you what your home could bring and explain how I’d market it.',
        'I’ll show you what your home could bring and how I’d market it, with the recent sales near you to back it up.',
        'I’ll show you what your home could bring and how I’d market it. Let’s set a time to talk.'], 3, 0.85); }},
      back:{run(h){        // recheck: the right photo stays; the two left photos widen so both gaps match the thin one; return address centered over the right photo
      const r = h.rect(h.q('photo:primary')), a = h.q('photo:living'), b = h.q('photo:kitchen'), g = h.rect(b).l - h.rect(a).r, w = (r.l - g - g) / 2;
      h.box(a, 0, null, w); h.box(b, w + g, null, w);
      const ret = h.top(h.q(h.v.ret1)); h.css(ret, {textAlign:'center'}); h.box(ret, r.l, null, r.w); }},
      plain(h, side){ if(side !== 'front') return; const o = h.top(h.q(h.v.OFFERS)), d = h.rect(h.top(h.q(h.v.street))).t - h.rect(o).t; o.style.display = 'none';
        h.parts().forEach(e => { const r = h.rect(e); if(e !== o && r.l > 360 && r.l < 700 && r.t > 400) h.box(e, null, r.t - d); }); }},
    M18: {front:{run(h){   // address a little bigger; the write-up a little bigger, centered between the gold line and "Your agent"
      const a = h.top(h.q(h.v.street)); h.css(a, {fontSize:'19px'});
      const gold = h.parts().find(e => { const r = h.rect(e); return r.h < 4 && r.w < 60 && r.t > 100 && r.t < 200; });
      h.box(gold, null, h.rect(a).b + 8);
      const t = h.top(h.q('Curious what')); h.css(t, {fontSize:'14.5px', lineHeight:'21px'});
      const y0 = h.rect(gold).b, y1 = h.rect(h.top(h.q('YOUR AGENT'))).t; h.box(t, null, (y0 + y1) / 2 - h.rect(t).h / 2); }},
      back:{run(h){        // the middle photo moves right so the gaps on both sides match
      const a = h.rect(h.q('photo:living')), k = h.q('photo:kitchen'), c = h.rect(h.q('photo:primary'));
      h.box(k, (a.r + c.l - h.rect(k).w) / 2);
      // recheck: the dark SOLD bar runs to the right edge of the third photo; the return address sits on it, centered top to bottom
      const bar = h.top(h.q('SOLD')), ret = h.top(h.q(h.v.ret1)), br = h.rect(bar); h.box(bar, null, null, c.r - br.l);
      h.box(ret, c.l, br.t + (br.h - h.rect(ret).h) / 2); }},
      plain(h){ h.q(h.v.OFFERS + ' RECEIVED').style.display = 'none'; }},
    M21: {front:{roles:['dining', 'primary'], run(h){   // two photos on the side so the main photo shows the whole house; the Just Sold tile under them
      const f = h.q('photo:front'); h.box(f, 0, 0, 716, 440);
      h.photo('dining', 724, 0, 332, 158, f); h.photo('primary', 724, 166, 332, 158, f);
      h.box(h.top(h.q('JUST SOLD!')), 724, 332, 332, 108); }},
      back:{roles:['nook'], run(h){   // recheck: a grid like the front: main photo, then a photo over the Just Sold tile; a third photo under the return address
      h.box(h.q('photo:living'), 0, 0, 440, 238); h.box(h.q('photo:kitchen'), 448, 0, 264, 115);
      h.box(h.top(h.q('JUST SOLD!')), 448, 123, 264, 115);
      h.parts().forEach(e => { const r = h.rect(e); if(!e.textContent.trim() && !e.querySelector('img') && e.tagName !== 'IMG' && r.t < 10 && r.l > 500 && r.r < 1060 && !e.hasAttribute('data-z')) e.style.display = 'none'; });
      const ret = h.top(h.q(h.v.ret1)); h.css(ret, {color:'#161616', textShadow:'none'}); h.box(ret, 732, 18);
      h.photo('nook', 732, 86, 184, 152, h.q('photo:kitchen')); }},
      plain(h, side){ h.q('SOLD IN ' + h.v.DOMDAYS).style.display = 'none'; if(side !== 'front') return;
        const w = h.q('Wondering how fast'); if(w) w.textContent = w.textContent.replace(/^Wondering how fast yours could sell\?/, 'Thinking about selling?'); }},
    M24: {front:{run(h){   // the corner text centered, "Another home sold" and "Multiple offers received" a little bigger
      const b = h.top(h.q('ANOTHER HOME SOLD'));
      h.css(b, {padding:'0 12px', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', textAlign:'center'});
      h.css(h.q('ANOTHER HOME SOLD'), {fontSize:'21px'}); h.css(h.q('Multiple offers received'), {fontSize:'16.5px'}); }},
      plain(h, side){ if(side === 'front') h.q('Multiple offers received').style.display = 'none'; }},
    M25: {front:{roles:['hall'], run(h){   // a second tight vertical; the main photo shows the whole house; address and the words under it bigger
      const k = h.q('photo:kitchen'); h.box(h.q('photo:front'), 0, null, 760); h.box(k, 768, null, 140);
      h.photo('hall', 916, h.rect(k).t, 140, h.rect(k).h, k);
      const lg = h.q('logo'); h.box(lg, 760 - 24 - h.rect(lg).w);
      const a = h.top(h.q(h.v.STREET)), t = h.top(h.q('A home near you'));
      h.css(a, {fontSize:(parseFloat(getComputedStyle(a).fontSize) * 1.2) + 'px'});
      h.css(t, {fontSize:(parseFloat(getComputedStyle(t).fontSize) * 1.15) + 'px', lineHeight:'1.6'}); h.box(t, null, h.rect(a).b + 12); }},
      back:{run(h){        // the far-right photo stays; the other four even out so every gap in the row matches
      const right = h.rect(h.q('photo:bedroom2')).l, g = 8, w = (right - g - 33 - 3 * g) / 4;
      ['living', 'dining', 'primary', 'nook'].forEach((r, i) => h.box(h.q('photo:' + r), 33 + i * (w + g), null, w)); }},
      plain(h){ const t = h.q(h.v.DOMDAYS); if(t && /SOLD IN/.test(t.textContent)) t.innerHTML = 'JUST<br>SOLD';
        h.q(' in ' + h.v.domDays, true).forEach(e => { e.textContent = e.textContent.replace(' in ' + h.v.domDays, ''); }); }},
    M29: {plain(h){ const t = h.q('SOLD IN ' + h.v.DOMDAYS); if(t) t.textContent = 'ANOTHER HOME SOLD'; }},
    M35: {back:{run(h){    // the far-right photo stays; the other two even out so the gaps match
      const right = h.rect(h.q('photo:primary')).l, g = 12, n = h.q('photo:nook'), nw = 187;
      h.box(h.q('photo:dining'), 33, null, right - g - nw - g - 33); h.box(n, right - g - nw, null, nw); }},
      plain(h){ h.q('REPRESENTED THE SELLER').style.display = 'none'; }},
    M37: {plain(h, side){ const d = h.top(h.q('in ' + h.v.domDays)), r = h.rect(d); d.style.display = 'none';
      const shift = side === 'front' ? 40 : 36;
      if(side === 'front'){ const t = h.q('Thinking about selling? I’ll show you'); if(t) t.textContent = t.textContent.replace(/(could bring\.)/, '$1 You’ll get a clear price range and a plan that fits your timing.'); }
      h.parts().forEach(e => { const q = h.rect(e); if(e !== d && q.l < 400 && q.t > r.t && q.b < 400 && !e.querySelector('img')) h.box(e, null, q.t - shift); }); }},
    M17: {front:{roles:['nook'], run(h){
      const l = h.q('photo:living'); h.box(h.q('photo:front'), 37, null, 640); h.box(l, 686, null, 162);
      h.photo('nook', 857, 62, 162, 316, l); }}},
    M38: {front:{roles:['living'], run(h){
      const k = h.q('photo:kitchen'); h.box(h.q('photo:front'), 44, null, 660); h.box(k, 714, null, 144);
      h.photo('living', 868, 52, 144, 330, k); }}},
  };

  // ---------------------------------------------------------------- the agent's own text changes (the owner, 10/24/2026)
  // An agent can click any text spot and change its wording, font (from the design's tested fonts), color and size
  // (80% to 130% of the design's size). The print checks still run on the result. Edits are saved per side and spot:
  // D.textEdits = {"back:4": {text, font, color, size}}. A spot is the outermost element that holds text, numbered in order.
  const SIZE_MIN = 0.8, SIZE_MAX = 1.3;
  const LOCKED = el => !!el.closest('[data-k="disc"]');   // the listed-property notice keeps its wording
  function fontsOf(doc){
    const out = [];
    doc.querySelectorAll('link[href*="fonts.googleapis"]').forEach(l => (l.getAttribute('href').match(/family=([^&:]+)/g) || [])
      .forEach(m => { const f = decodeURIComponent(m.slice(7)).replace(/\+/g, ' '); if(out.indexOf(f) < 0) out.push(f); }));
    return out;
  }
  function spotsOf(card){
    const all = [...card.querySelectorAll('*')].filter(e => !e.closest('[data-z]') && !e.closest('svg') && e.tagName !== 'SCRIPT' && getComputedStyle(e).display !== 'none'
      && (e.classList.contains('fill') || [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())));
    return all.filter(e => !all.some(o => o !== e && o.contains(e)));
  }
  function applyEdits(card, side, edits, fonts){
    const done = [];
    spotsOf(card).forEach((e, i) => {
      const id = side + ':' + i, ed = edits[id]; e.dataset.spot = id; if(!ed) return;
      e._before = overlaps(card, e);   // what the design already lets it sit on (a banner over a photo)
      const each = f => [e, ...e.querySelectorAll('*')].forEach(f);
      if(ed.text != null && !LOCKED(e)){ e.classList.remove('fill'); delete e.dataset.alts;
        e.innerHTML = String(ed.text).replace(/[&<>]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;'})[c]).replace(/\n/g, '<br>'); }
      if(ed.font && fonts.indexOf(ed.font) >= 0) each((x, k) => x.style.fontFamily = k === undefined || x === e ? `'${ed.font}', sans-serif` : 'inherit');
      if(ed.color && /^#[0-9a-f]{3,8}$/i.test(ed.color)){ e.style.color = ed.color; e.querySelectorAll('*').forEach(x => x.style.color = 'inherit'); }
      const k = Math.min(SIZE_MAX, Math.max(SIZE_MIN, +ed.size || 1));
      if(k !== 1) each(x => { const cs = getComputedStyle(x); x.style.fontSize = (parseFloat(cs.fontSize) * k) + 'px';
        if(/px$/.test(cs.lineHeight)) x.style.lineHeight = (parseFloat(cs.lineHeight) * k) + 'px'; });
      e.dataset.edited = '1'; done.push(e);
    });
    return done;
  }
  function overlaps(card, e){
    const a = e.getBoundingClientRect(), k = card.getBoundingClientRect().width / card.offsetWidth;
    return [...card.querySelectorAll('[data-spot], img, [data-spot] ~ *')].filter(o => o !== e && !o.contains(e) && !e.contains(o) && getComputedStyle(o).display !== 'none' && (() => {
      const b = o.getBoundingClientRect(); return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 * k && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2 * k; })());
  }
  // an edited spot must not run into other text or a photo it didn't already sit on
  function editChecks(card, edited){
    const issues = [];
    edited.forEach(e => {
      if(e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).whiteSpace === 'nowrap') return;   // reported as overflow already
      const before = e._before || [];
      const hit = overlaps(card, e).find(o => before.indexOf(o) < 0 && !o.closest('[data-hs]') && (o.dataset.spot || o.tagName === 'IMG'));
      if(hit) issues.push({kind:'text-overlap', slot:e.dataset.spot, text:e.textContent.trim().slice(0, 30)}); });
    return issues;
  }
  function spotInfo(card, fonts){
    return spotsOf(card).map(e => { const cs = getComputedStyle(e);
      return {id:e.dataset.spot, text:e.innerText, font:(cs.fontFamily.split(',')[0] || '').replace(/['"]/g, ''), color:cs.color,
              pt:+(parseFloat(cs.fontSize) * 0.75).toFixed(1), edited:!!e.dataset.edited, locked:LOCKED(e)}; });
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
    const did = ((doc.title || '').match(/M\d\d(?:-[a-z]+)?/i) || [''])[0].toUpperCase();
    const wide = (opts.size || '6x9') === '6x11', fix = wide ? (WIDE11[did] || {}) : {};
    // photos are assigned across the whole card (front first, then back) so a photo never shows up twice
    const roles = rolesIn([chooseTemplate(doc, 'front', hs, long), chooseTemplate(doc, 'back', hs, long)]);
    ['front', 'back'].forEach(s => ((fix[s] || {}).roles || []).forEach(r => { if(roles.indexOf(r) < 0) roles.push(r); }));
    const assigned = assignPhotos(D, roles);
    const filled = fill(card, D, v, assigned);
    host.appendChild(card);
    if(wide){ widen(card, side === 'front');
      const h = helpers(card, photoPicker(D, assigned), v, filled);
      if(fix[side] && fix[side].run) fix[side].run(h, {hs, long});
      // the plain version of a specialty card leaves out the sale detail (days on market, offers)
      if(opts.plain && fix.plain) fix.plain(h, side, {hs, long}); }
    const fonts = fontsOf(doc), edited = applyEdits(card, side, D.textEdits || {}, fonts);
    if(hs && !(D.agent || {}).headshot) card.querySelectorAll('[data-hs]').forEach(el => el.dataset.placeholder = '1');
    const imgs = [...card.querySelectorAll('img')].filter(i => i.getAttribute('src'));
    // load every face the card uses before measuring (copy fitting depends on the real letter widths)
    const faces = new Set();
    [card, ...card.querySelectorAll('*')].forEach(el => { const cs = getComputedStyle(el);
      faces.add(`${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}`); });
    return Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))
      .then(() => Promise.all([...faces].map(f => document.fonts.load(f).catch(() => null))))
      .then(() => document.fonts.ready)
      .then(() => { const r = layout(card, D, side === 'front'); r.issues.push(...editChecks(card, edited)); if(opts.print) forPrint(card);
        // a name that won't fit this design: one plain message for the agent (shorten the mailer name or pick another design)
        const parts = [v.agentName, v.agentFirst, v.agentLast].filter(x => x && x.length > 2).map(x => x.toLowerCase().slice(0, 12));
        if(r.issues.some(c => /overflow|safe-area|mail-zone/.test(c.kind) && c.text && parts.some(x => c.text.toLowerCase().indexOf(x) >= 0)))
          r.issues.unshift({kind:'name-too-long', slot:'agent.mailerName', name:v.agentName});
        return {card, issues:filled.filter(x => x.kind !== 'photo-stand-in').concat(r.issues), notes:filled.filter(x => x.kind === 'photo-stand-in').concat(r.notes),
                variant:{side, headshot:hs, longName:long}, fonts, spots:spotInfo(card, fonts), sizeRange:[SIZE_MIN, SIZE_MAX]}; });
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
    const wide = D.piece.size === '6x11';
    if(wide) page.classList.add('wide');
    window.pieceSize = {W:(wide ? 792 : 648) + 2 * bleedPt, H:432 + 2 * bleedPt, bleed:bleedPt};
    window.photoPlacements = () => [...page.querySelectorAll('img[data-photo]')].map(im => ({src:im.getAttribute('src'), w:im.clientWidth / 96, h:im.clientHeight / 96}));
    window.brochureReady = draw(document, page, D, side, {print, size:D.piece.size, plain:!!D.piece.plain}).then(r => {
      if(print) page.style.background = getComputedStyle(r.card).backgroundColor;
      const need = (D.piece.needs || []).filter(k => !(D.sold || {})[k]);
      need.forEach(k => r.issues.push({kind:'missing-sale-fact', slot:'sold.' + k}));
      window.proofNotes = r.notes;
      document.body.dataset.version = (r.variant.headshot ? 'headshot' : 'no-headshot') + (r.variant.longName ? '-long-name' : '');
      window.brochureCheck = () => r.issues; window.brochureSpots = () => ({fonts:r.fonts, spots:r.spots});
      return true;
    });
  });
})();
