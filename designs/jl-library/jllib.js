/* BrochureDesk Just Listed postcard library: runtime for every design in templates/jl-library/.
   Each design file holds <template> elements made by scripts/build_jl_library.py from the approved design scripts:
   data-side front|back, data-hs 1|0 (agent has a headshot), data-long 1 (long-name layout, where one exists).
   This fills the {{tokens}} from the listing and agent data, sizes the agent name, fits the write-ups, applies the
   approved layout rules (long-name contact lines, agent block centering, return address over its photo, roofline)
   and runs the print checks.

   Renderer (renderer/render.py): the page reads #brochure-data (with data.piece and data.mode) and draws itself.
   Site preview:   JLLib.mount(container, designHtmlText, data, {side:'back'}) returns a promise with the checks. */
(function(){
  const W0 = 864, H = 576, BLEED_PX = 12;            // 6 x 9 card: 9 x 6 in at 96 px/in; 0.125 in bleed. 6 x 11 is 1056 px wide.
  const WIDE = 1056;
  const zones = dx => ({postage:[736+dx,16,112,131], address:[540+dx,250,320,150], barcode:[408+dx,516,456,60]});   // mail zones on the back
  const NUM = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
  const SUFFIX = /^(street|st|avenue|ave|drive|dr|lane|ln|road|rd|boulevard|blvd|court|ct|way|place|pl|circle|cir|trail|trl|parkway|pkwy|terrace|ter|loop|row|square|sq)\.?$/i;
  const STATES = {alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',
    hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',
    michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ',
    'new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA',
    'rhode island':'RI','south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',
    washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY'};
  const ROLE_TAGS = {front:/front exterior|front of/i, family:/exterior|side angle/i, lawn:/back ?yard|patio|rear exterior|pool/i,
    kitchen:/kitchen/i, kitchen2:/kitchen|bar|island/i, living:/living|family room|great room/i, dining:/dining/i, nook:/nook|breakfast/i,
    primary:/primary|master/i, bedroom2:/bedroom/i, study:/bedroom|study|office/i, office:/bath|office/i, hall:/entry|foyer|hall/i};
  const EXTERIOR = {front:1, family:1, lawn:1};
  const LONG_LEN_DEFAULT = 99;

  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const word = n => (Number.isInteger(n) && n >= 0 && n < NUM.length) ? NUM[n] : String(n);
  const title = s => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[c]);

  // ---------------------------------------------------------------- data -> token values
  function values(D){
    const L = D.listing || {}, A = D.agent || {}, B = D.brand || {}, C = D.copy || {};
    const street = (L.address || '').trim();
    const parts = street.split(/\s+/);
    const short = parts.length > 2 && SUFFIX.test(parts[parts.length-1]) ? parts.slice(0,-1).join(' ') : street;
    const stateName = L.state && L.state.length > 2 ? L.state : (Object.keys(STATES).find(k => STATES[k] === (L.state||'').toUpperCase()) || L.state || '');
    const st = L.state && L.state.length === 2 ? L.state.toUpperCase() : (STATES[(L.state||'').toLowerCase()] || L.state || '');
    const beds = +L.beds || 0, full = Math.floor(+L.baths || 0), half = +L.halfBaths || ((+L.baths||0) % 1 ? 1 : 0);
    const bathsW = full ? word(full) + (half ? ' and a half' : '') : '';
    const stories = +L.stories || 1;
    const sqft = L.sqft ? Number(String(L.sqft).replace(/[^\d.]/g, '')).toLocaleString('en-US') : '';
    // headline: one editable field, default "Just Listed" (no other spin); two-word styles split it after the first word
    const head = (C.headline || 'Just Listed').trim().replace(/\s+/g, ' ');
    const hw = head.split(' '), h1 = hw[0], h2 = hw.slice(1).join(' ');
    // "Name on mailers" from the agent's profile when they set one (a shorter form of a long name), else their name
    const name = (A.mailerName || A.name || '').trim(), np = name.split(/\s+/);
    const first = np[0] || '', last = np.slice(1).join(' ');
    const ret = B.returnAddress || [];
    return {
      street, STREET: street.toUpperCase(), streetShort: short, STREETSHORT: short.toUpperCase(),
      city: L.city || '', CITY: (L.city || '').toUpperCase(), state: stateName, STATE: stateName.toUpperCase(), st, ST: st,
      zip: L.zip || '', yearBuilt: L.yearBuilt ? String(L.yearBuilt) : '', sqft, beds: beds ? String(beds) : '', baths: full ? String(full + (half ? 0.5 : 0)) : '',
      bedsW: beds ? word(beds) : '', BedsW: beds ? cap(word(beds)) : '', BEDSW: beds ? word(beds).toUpperCase() : '',
      bathsW, BATHSW: bathsW.toUpperCase(),
      storiesW: word(stories), StoriesW: cap(word(stories)), STORIESW: word(stories).toUpperCase(),
      HEAD: head.toUpperCase(), Head: title(head), Headsc: cap(head.toLowerCase()), headlc: head.toLowerCase(),
      HEAD1: h1.toUpperCase(), HEAD2: h2.toUpperCase(), Head1: title(h1), Head2: title(h2), head1: h1.toLowerCase(), head2: h2.toLowerCase(),
      agentName: name, AGENTNAME: name.toUpperCase(), agentFirst: first, AGENTFIRST: first.toUpperCase(),
      agentLast: last, AGENTLAST: last.toUpperCase(), agentPhone: A.phone || '', agentEmail: A.email || '',
      agentWeb: A.web || '', AGENTWEB: (A.web || '').toUpperCase(), designation: A.designation == null ? 'REALTOR®' : A.designation,
      brokerage: B.brokerage || '', BROKERAGE: (B.brokerage || '').toUpperCase(),
      ret1: ret[0] || '', ret2: ret[1] || '', retLine: ret.filter(Boolean).join(', '),
    };
  }

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
    if(kind === 'accent') return B.logoAccent || B.logo || '';   // the brand-color version on a light background (M01)
    return B.logo || '';
  }

  // write-up choices: the listing's sentences in story order, two or more at a time, opening with one of the first three
  function poolAlts(pool, spec){
    const [lead, max, skip] = (spec || '0,1,2|10|').split('|');
    const L = lead.split(',').map(Number), sk = (skip || '').split(',').filter(Boolean).map(Number);
    const idx = pool.map((s, i) => i).filter(i => sk.indexOf(i) < 0 && pool[i]).slice(0, 14), out = new Set(), mx = Math.min(+max || 10, idx.length);
    const n = idx.length;
    for(let m = 1; m < (1 << n); m++){ const pick = []; for(let b = 0; b < n; b++) if(m & (1 << b)) pick.push(idx[b]);
      if(pick.length < 2 || pick.length > mx || L.indexOf(pick[0]) < 0) continue; out.add(pick.map(i => pool[i]).join(' ')); }
    if(!out.size && pool.length) out.add(pool.join(' '));
    return [...out].sort((a, b) => b.length - a.length);
  }

  // ---------------------------------------------------------------- template -> filled DOM
  function chooseTemplate(doc, side, hs, long){
    const q = s => doc.querySelector(`template[data-side="${side}"][data-hs="${hs?1:0}"][data-long="${s}"]`) || doc.querySelector(`template[data-side="${side}"][data-long="${s}"]`);
    return (long && q(1)) || q(0);
  }
  // the long-name layout: the approved rule from the drawings (name column too narrow for the name at 24 px), decided
  // separately with and without a headshot, as the drawings did
  function isLong(doc, v, hs){
    const n = Math.max(v.agentFirst.length, v.agentLast.length);
    const t = doc.querySelector(`template[data-side="back"][data-hs="${hs?1:0}"][data-long="0"]`) || doc.querySelector('template[data-side="back"][data-long="0"]');
    if(t && t.dataset.longlen) return n > +t.dataset.longlen;
    const nf = t && t.content.querySelector('[data-nf]');
    if(nf){ const [avail, em] = nf.dataset.nf.split('|').map(Number); return avail / (n * em) < 24; }
    return n > LONG_LEN_DEFAULT;
  }
  const TOK = /\{\{([^}]+)\}\}/g;
  function fill(root, D, v, assigned){
    const B = D.brand || {}, C = D.copy || {}, P = D.photos || {}, issues = [];
    const sub = (s, e) => s.replace(TOK, (m, k) => {
      if(k in v) return e ? esc(v[k]) : v[k];
      issues.push({kind:'unknown-token', slot:k}); return '';
    });
    root.querySelectorAll('img').forEach(im => {
      const s = im.getAttribute('src') || '';
      let m = s.match(/^\{\{photo:(\w+)\}\}$/);
      if(m){ const id = assigned.map[m[1]]; im.dataset.role = m[1];
             if(id && P[id]){ im.dataset.photo = id; im.setAttribute('src', P[id].src); }
             else { im.removeAttribute('src'); im.dataset.missing = '1'; issues.push({kind:'missing-photo', slot:'photo.' + m[1]}); } return; }
      m = s.match(/^\{\{logo:(\w+)\}\}$/);
      if(m){ const src = logoFor(B, m[1]); im.dataset.logo = m[1]; if(src) im.setAttribute('src', src); else { im.removeAttribute('src'); issues.push({kind:'missing-logo', slot:'brand.logo'}); } }
    });
    // contact-line variants (JSON lists of HTML): filled the same way, escaped for HTML
    root.querySelectorAll('[data-cl],[data-clb]').forEach(el => ['cl', 'clb'].forEach(k => { if(el.dataset[k]) el.dataset[k] = sub(el.dataset[k], true); }));
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const nodes = [];
    while((n = w.nextNode())) if(n.nodeValue.indexOf('{{') >= 0) nodes.push(n);
    nodes.forEach(t => { t.nodeValue = sub(t.nodeValue); t.parentElement.dataset.tok = '1'; });
    // write-ups and captions: the choices come from the listing's copy
    root.querySelectorAll('.fill[data-pool]').forEach(el => { el.dataset.alts = JSON.stringify(poolAlts((C.pool || []).map(s => sub(s)), el.dataset.pool)); });
    root.querySelectorAll('.fill[data-cap]').forEach(el => {
      const caps = ((C.captions || {})[el.dataset.cap] || []).map(s => sub(s));
      el.dataset.alts = JSON.stringify(caps); if(!caps.length) issues.push({kind:'missing-caption', slot:'copy.captions.' + el.dataset.cap}); });
    // agent headshot into its frame (the placeholder stays only on unpaid samples)
    const hsSrc = (D.agent || {}).headshot;
    root.querySelectorAll('[data-hs]').forEach(el => {
      if(!hsSrc){ el.dataset.placeholder = '1'; return; }
      el.innerHTML = ''; el.style.overflow = 'hidden'; const im = document.createElement('img'); im.src = hsSrc; im.alt = '';
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
    return issues.concat(assigned.notes);
  }

  // ---------------------------------------------------------------- copy fitting and the layout rules
  function layout(card, D, front, did){
    const issues = [], notes = [];
    const W = card.offsetWidth || W0, dx = W - W0;
    const scale = card.getBoundingClientRect().width / W || 1;
    const C0 = () => card.getBoundingClientRect();
    const R = el => { const c = C0(), r = el.getBoundingClientRect();
      return {left:(r.left-c.left)/scale, top:(r.top-c.top)/scale, right:(r.right-c.left)/scale, bottom:(r.bottom-c.top)/scale, width:r.width/scale, height:r.height/scale}; };
    const RR = r => { const c = C0(); return {left:(r.left-c.left)/scale, top:(r.top-c.top)/scale, right:(r.right-c.left)/scale, bottom:(r.bottom-c.top)/scale, width:r.width/scale, height:r.height/scale}; };
    const textW = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width / scale; };
    function lineBoxes(el){ const r = document.createRange(); r.selectNodeContents(el); const L = [];
      for(const x of r.getClientRects()){ if(x.width < 1) continue; const t = Math.round(x.top); let g = L.find(o => Math.abs(o.t - t) < 4);
        if(!g) L.push({t, l:x.left, r:x.right}); else { g.l = Math.min(g.l, x.left); g.r = Math.max(g.r, x.right); } }
      return L.sort((a,b) => a.t - b.t); }
    const stat = el => { const L = lineBoxes(el), w = el.clientWidth * scale; return {n:L.length, last:L.length ? (L[L.length-1].r - L[L.length-1].l) / w : 0}; };

    // write-ups: the combination of the listing's sentences that fills the planned lines best (last line 86%+)
    card.querySelectorAll('.fill').forEach(el => {
      const A = JSON.parse(el.dataset.alts || '[]'), n = +el.dataset.lines, min = +el.dataset.min || 0.85;
      const fs0 = parseFloat(getComputedStyle(el).fontSize); let best = null;
      outer: for(const d of (el.dataset.cap ? [0,-0.5,0.5,-1] : [0,-0.25,0.25,-0.5,0.5])){ el.style.fontSize = (fs0 + d) + 'px';
        for(const a of A){ el.textContent = a; const s = stat(el); if(s.n !== n) continue;
          if(!best || s.last > best.last) best = {a, d, last:s.last}; if(s.last >= min) break outer; } }
      // a wider card (6 x 11) can run out of sentences: set the type up to 1 px larger, then plan a line or two fewer
      if(!best && dx > 0) fallback: for(const n2 of [n, n - 1, n - 2]) for(const d of [0.75, 1, 0, 0.5]){ el.style.fontSize = (fs0 + d) + 'px';
        for(const a of A){ el.textContent = a; const s = stat(el); if(s.n !== n2) continue;
          if(!best || s.last > best.last) best = {a, d, last:s.last}; if(s.last >= min) break fallback; } }
      if(best){ el.style.fontSize = (fs0 + best.d) + 'px'; el.textContent = best.a; }
      else { el.style.fontSize = fs0 + 'px'; el.textContent = A[A.length - 1] || ''; issues.push({kind:'copy-fit', slot:el.dataset.cap ? 'copy.captions.' + el.dataset.cap : 'copy.pool', lines:n}); }
      if(best && best.last < min) notes.push({kind:'copy-short-last-line', slot:'copy.pool', last:+best.last.toFixed(2)});
    });

    // Long-name rule (Review Book 10): contact lines use the fullest version that fits; stacked blocks step the name down
    const cl = [];
    function fitName(nm, mw, floor){ nm.style.whiteSpace = 'nowrap'; nm.style.display = 'block';
      if(!nm.dataset.fs0) nm.dataset.fs0 = parseFloat(getComputedStyle(nm).fontSize); const base = +nm.dataset.fs0; let f = 1; nm.style.fontSize = base + 'px';
      while(textW(nm) > mw + 0.5 && f > floor){ f -= 0.02; nm.style.fontSize = (base * f) + 'px'; } return [f, textW(nm) <= mw + 0.5]; }
    card.querySelectorAll('[data-clb]').forEach(e => { const v = JSON.parse(e.dataset.clb), mw = +e.dataset.maxw, mh = +e.dataset.maxh; let pick = null;
      for(const pass of ['near', 'one', 'two']) for(let i = 0; i < v.length && !pick; i++){ e.innerHTML = v[i]; const nm = e.querySelector('[data-name]'); let f = 1, ok = true;
        if(nm){ [f, ok] = fitName(nm, mw, pass === 'near' ? 0.9 : 0.72); if(!ok){ if(pass !== 'two') continue; nm.style.whiteSpace = 'normal'; nm.style.fontSize = (+nm.dataset.fs0 * 0.86) + 'px'; f = 0.86; } }
        if(e.scrollHeight <= mh + 0.5 && e.scrollWidth <= mw + 0.5) pick = {level:i, f}; }
      if(!pick) issues.push({kind:'overflow', slot:'agent.name', text:e.textContent.trim().slice(0, 30)});
      else if(pick.level || pick.f < 1) notes.push({kind:'contact-shortened', level:pick.level, scale:+pick.f.toFixed(2)}); });
    card.querySelectorAll('[data-fitname]').forEach(e => { const mw = +e.dataset.fitname; e.style.whiteSpace = 'nowrap'; e.style.display = 'block';
      const base = parseFloat(getComputedStyle(e).fontSize); let f = 1;
      while(textW(e) > mw + 0.5 && f > 0.6){ f -= 0.02; e.style.fontSize = (base * f) + 'px'; }
      if(f < 1) notes.push({kind:'name-shrunk', scale:+f.toFixed(2)}); });
    card.querySelectorAll('[data-cl]').forEach(e => { const v = JSON.parse(e.dataset.cl), mw = +e.dataset.maxw; let lvl = -1;
      const hide = () => e.dataset.hide && card.querySelectorAll(e.dataset.hide).forEach(h => h.style.display = 'none');
      for(let i = 0; i < v.length; i++){ e.innerHTML = v[i]; if(R(e).width <= mw + 0.5){ lvl = i; break; } }
      if(lvl >= 1) hide();
      if(lvl < 0){ lvl = v.length - 1; hide(); let f = 1; e.innerHTML = v[lvl]; const base = parseFloat(getComputedStyle(e).fontSize);
        while(R(e).width > mw + 0.5 && f > 0.8){ f -= 0.02; e.style.fontSize = (base * f) + 'px';
          e.querySelectorAll('[style*="font-size"]').forEach(k => { if(!k.dataset.fs) k.dataset.fs = parseFloat(k.style.fontSize); k.style.fontSize = (k.dataset.fs * f) + 'px'; }); }
        notes.push({kind:'contact-shrunk', scale:+f.toFixed(2)});
        if(R(e).width > mw + 0.5) issues.push({kind:'overflow', slot:'agent.name', text:e.textContent.trim().slice(0, 30)}); }
      if(lvl > 0) notes.push({kind:'contact-shortened', level:lvl});
      if(e.dataset.spread){ e.style.display = 'flex'; e.style.justifyContent = 'space-between'; e.style.width = mw + 'px'; } });
    // design hooks that ran as page scripts in the approved drawings
    (HOOKS[did] || []).forEach(f => f(card, R, RR));

    // Agent block: center the name group (headshot, name, divider) and the contact column in their bands
    const ub = els => { let t = 1e9, b = -1e9; els.forEach(e => { const r = R(e); t = Math.min(t, r.top); b = Math.max(b, r.bottom); }); return [t, b]; };
    const tight = el => { let t = 1e9, b = -1e9; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
      while((n = w.nextNode())){ if(!n.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(n);
        for(const q of g.getClientRects()){ const r = RR(q); t = Math.min(t, r.top); b = Math.max(b, r.bottom); } } return [t, b]; };
    const shift = (els, d) => els.forEach(e => { e.style.top = (parseFloat(e.style.top || 0) + d) + 'px'; });
    const isHs = e => e.hasAttribute('data-hs');
    card.querySelectorAll('.agent').forEach(a => {
      const ng = [...a.querySelectorAll('[data-mv="n"]')], cg = [...a.querySelectorAll('[data-mv="c"]')];
      const nameEls = ng.filter(e => e.dataset.nm || isHs(e));
      if(a.dataset.nb){ const [t, b] = a.dataset.nb.split(',').map(Number);
        const nmEl = ng.find(e => e.dataset.nm), nmDiv = nmEl && nmEl.querySelector('div[style*="nowrap"]');
        if(nmDiv && a.dataset.na !== 'bottom') for(let k = 0; k < 14; k++){ const [q1, q2] = ub(nameEls); if(q2 - q1 <= b - t - 18) break;
          const f = parseFloat(getComputedStyle(nmDiv).fontSize); if(f <= 24) break; nmDiv.style.fontSize = (f - 1) + 'px'; }
        const hsEl = ng.find(isHs); if(hsEl && hsEl.offsetHeight > b - t - 16){ const h = Math.max(90, b - t - 16); hsEl.style.height = h + 'px'; hsEl.style.width = Math.round(h * 0.81) + 'px'; }
        let [nt, nb] = ub(nameEls); const tx = tight(nmEl); nt = Math.min(nt, tx[0] > 0 ? tx[0] : nt);
        nb = Math.max(tx[1], nameEls.filter(e => !e.dataset.nm).reduce((m, e) => Math.max(m, R(e).bottom), -1e9));
        const d = a.dataset.na === 'bottom' ? (b - nb) : ((t + b) / 2 - (nt + nb) / 2); shift(ng, d); nt += d; nb += d;
        if((a.dataset.na !== 'bottom' && nt - t < 8) || b - nb < (a.dataset.na === 'bottom' ? -1 : 8)) notes.push({kind:'agent-name-tight'}); }
      if(a.dataset.cb && cg.length){ const [t, b] = a.dataset.cb.split(',').map(Number); const [ct, cb2] = tight(cg[0]); const d = (t + b) / 2 - (ct + cb2) / 2; shift(cg, d);
        if(ct + d - t < 8 || b - (cb2 + d) < 8) notes.push({kind:'agent-contact-tight'}); }
      // a vertical divider runs exactly the height of the text block beside it (the contact column)
      const cc = a.querySelector('#cc'), dv = ng.find(e => !e.dataset.nm && !isHs(e));
      if(cc && dv){ const [t, b] = tight(cc); dv.style.alignSelf = 'flex-start'; dv.style.top = '0px'; const nat = R(dv).top; dv.style.height = Math.round(b - t) + 'px'; dv.style.top = (t - nat) + 'px'; }
      if(a.dataset.lt){ const nm = a.querySelector('[data-nm]');
        if(nm && dv){ const lab = nm.firstElementChild, d = R(dv).top - R(lab).top; nm.style.top = (parseFloat(nm.style.top || 0) + d) + 'px'; }
        const lab = nm && nm.firstElementChild, hsEl = ng.find(isHs);
        if(lab && hsEl){ hsEl.style.alignSelf = 'flex-start'; hsEl.style.top = '0px'; const nat = R(hsEl).top; hsEl.style.top = (R(lab).top - nat) + 'px'; } }
    });
    // Rule (10/25, M02, from the markup page): the divider and contact column sit closer to a short agent name: they move
    // left by half the spare room between the end of the name and the divider. Long names leave no spare room.
    card.querySelectorAll('.agent').forEach(a => { const cc = a.querySelector('#cc'), nm = a.querySelector('[data-nm]');
      const dv = [...a.querySelectorAll('[data-mv="n"]')].find(e => !e.dataset.nm && !isHs(e) && !e.querySelector('svg'));
      if(!cc || !nm || !dv || !cc.dataset.mv) return;
      let right = -1e9; nm.querySelectorAll('div').forEach(d => { const g = document.createRange(); g.selectNodeContents(d); for(const q of g.getClientRects()) right = Math.max(right, RR(q).right); });
      const gap = parseFloat(getComputedStyle(a).columnGap || getComputedStyle(a).gap) || 16, spare = R(dv).left - right - gap;
      if(spare > 2){ const sh = Math.round(spare / 2); [dv, cc].forEach(e => { e.style.left = (parseFloat(e.style.left || 0) - sh) + 'px'; }); } });
    // Disclaimer (approved 10/25): always the same two lines. Under the agent it steps down to fit its width; on the mail
    // side it sits bottom-right, 4 px above the barcode strip, at the largest size (10.5 px down to 8 px = 6 pt) that fits
    // between everything to its left and the right margin.
    card.querySelectorAll('[data-k="disc"]:not([data-br])').forEach(q => { let fs = parseFloat(getComputedStyle(q).fontSize);
      while(q.scrollWidth > q.clientWidth + 0.5 && fs > 8){ fs -= 0.25; q.style.fontSize = fs + 'px'; } });
    card.querySelectorAll('[data-k="disc"][data-br]').forEach(q => {
      const obs = [...card.querySelectorAll('img, *')].filter(e => e !== q && !e.closest('[data-z]') && !e.closest('[data-br]') && (e.tagName === 'IMG' || (e.children.length === 0 && e.textContent.trim())));
      const fits = fs => { q.style.fontSize = fs + 'px'; const top = 512 - 2 * fs * 1.25 - 4; let left = 408 + dx;
        obs.forEach(e => { const r = R(e); if(r.width < 2 || r.bottom < top || r.top > 514 || r.right > 780 + dx) return; left = Math.max(left, r.right + 20); });
        return R(q).width <= W - 24 - left; };
      let fs = 10.5; while(!fits(fs) && fs > 8) fs -= 0.25;
      if(!fits(fs)) issues.push({kind:'disclaimer-does-not-fit', slot:'text'}); });
    card.querySelectorAll('[data-vrule]').forEach(r => { const a = card.querySelector('.agent'); if(!a) return; const nm = a.querySelector('[data-nm]'); let [t, b] = tight(nm);
      const hsEl = [...a.querySelectorAll('[data-mv="n"]')].find(isHs); if(hsEl){ const h = R(hsEl); t = Math.min(t, h.top); b = Math.max(b, h.bottom); }
      r.style.top = Math.round(t) + 'px'; r.style.height = Math.round(b - t) + 'px'; });
    // Rule (Review Book 8): when a photo sits under the brokerage return address, the return address centers over that photo
    card.querySelectorAll('[data-k="ret"]:not([data-free])').forEach(r => { r.style.width = 'auto'; const rr = R(r), cx = rr.left + rr.width / 2; let best = null;
      card.querySelectorAll('img[data-role]').forEach(im => { const q = R(im);
        if(q.top < rr.bottom - 2 || q.top - rr.bottom > 70) return; if(q.left > cx || q.right < cx || q.left < 500) return; if(!best || q.top < best.top) best = q; });
      if(!best) return; const w = Math.max(best.width, rr.width); r.style.left = (best.left + best.width / 2 - w / 2) + 'px'; r.style.width = w + 'px'; r.style.textAlign = 'center'; });

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

    // ---- print checks
    const Z = front ? {} : zones(dx);
    const hit = (r, z) => r.left < z[0] + z[2] && r.right > z[0] && r.top < z[1] + z[3] && r.bottom > z[1];
    const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT); let nd;
    while((nd = w.nextNode())){ if(!nd.textContent.trim()) continue; const p = nd.parentElement; if(p.closest('[data-z]')) continue;
      if(getComputedStyle(p).visibility === 'hidden') continue;
      const fsPx = parseFloat(getComputedStyle(p).fontSize), fine = !!p.closest('[data-k="disc"]');
      if(fsPx * 0.75 < (fine ? 6 : 8) - 0.05) issues.push({kind:'type-too-small', slot:'text', text:nd.textContent.trim().slice(0,30), pt:+(fsPx*0.75).toFixed(1)});
      const rg = document.createRange(); rg.selectNodeContents(nd);
      const vert = /vertical/.test(getComputedStyle(p).writingMode);
      for(const q of rg.getClientRects()){ if(q.width < 1) continue; let r = RR(q);
        for(const k in Z) if(hit(r, Z[k])) issues.push({kind:'text-in-mail-zone', slot:k, text:nd.textContent.trim().slice(0,30)});
        // sideways text (M43): the letters sit in the middle of a line box that runs top to bottom
        if(vert){ const pad = Math.max(0, (r.width - fsPx) / 2), il = r.left + pad + fsPx * 0.14, ir = r.right - pad - fsPx * 0.14;
          if(il < 12 || ir > W - 12 || r.top < 12 || r.bottom > H - 12) issues.push({kind:'text-outside-safe-area', slot:'text', text:nd.textContent.trim().slice(0,30)});
          else if(il < 23 || r.top < 14 || ir > W - 23 || r.bottom > 553) notes.push({kind:'text-near-trim', slot:'text', text:nd.textContent.trim().slice(0,30)});
          continue; }
        // letters (not their line box) stay inside the safe area: outside 1/8 in = a print problem; within 1/4 in of the trim = a note
        const fs = fsPx, inkTop = r.top + Math.max(0, (r.bottom - r.top - fs) / 2) + fs * 0.24, inkBot = r.bottom - Math.max(0, (r.bottom - r.top - fs) / 2) - fs * 0.14;
        if(r.left < 12 || inkTop < 12 || r.right > W - 12 || inkBot > H - 12) issues.push({kind:'text-outside-safe-area', slot:'text', text:nd.textContent.trim().slice(0,30)});
        else if(r.left < 23 || inkTop < 14 || r.right > W - 23 || inkBot > 553) notes.push({kind:'text-near-trim', slot:'text', text:nd.textContent.trim().slice(0,30)});
      } }
    card.querySelectorAll('img, [data-blk]').forEach(el => { if(el.closest('[data-z]')) return; const r = R(el);
      for(const k in Z) if(hit(r, Z[k])) issues.push({kind:'image-in-mail-zone', slot:k}); });
    card.querySelectorAll('*').forEach(el => { if(el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).whiteSpace === 'nowrap' && el.clientWidth > 0)
      issues.push({kind:'overflow', slot:el.closest('[data-nf],[data-nm],[data-cl],[data-clb],[data-fitname]') ? 'agent.name' : 'text', text:el.textContent.trim().slice(0,30)}); });
    // Rule (Review Book 9): nothing sits under the address block (a band may touch its edge, or run full width behind it)
    if(!front){ const A = {l:540 + dx, t:250, r:852 + dx, b:400};
      card.querySelectorAll('*').forEach(el => { if(el.closest('[data-z]')) return; const cs = getComputedStyle(el);
        const vis = el.tagName === 'IMG' || (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'rgb(255, 255, 255)') || cs.backgroundImage !== 'none';
        if(!vis) return; const r = R(el); if(r.width < 2 || r.height < 2) return;
        if(r.left <= A.l && r.right >= A.r && r.top <= A.t && r.bottom >= A.b) return;
        if(r.right > A.l + 1 && r.left < A.r - 1 && r.bottom > A.t + 1 && r.top < A.b - 1) issues.push({kind:'touches-address-block', slot:(el.dataset.role || el.tagName.toLowerCase())}); }); }
    // photos in a row line up top and bottom
    { const ims = [...card.querySelectorAll('img[data-role]')].filter(i => i.offsetWidth > 40).map(R);
      for(let i = 0; i < ims.length; i++) for(let j = 0; j < ims.length; j++){ if(i === j) continue; const a = ims[i], b = ims[j], g = b.left - a.right; if(g < -1 || g > 40) continue;
        if(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 0) continue; if(Math.min(a.height, b.height) / Math.max(a.height, b.height) < 0.8) continue;
        if(Math.abs(a.top - b.top) > 1.5 || Math.abs(a.bottom - b.bottom) > 1.5) notes.push({kind:'row-not-aligned', slot:'photos'}); } }
    // logos centered in their band (data-vc), side to side (data-hc); a write-up's planned lines (data-lines) end full
    card.querySelectorAll('[data-vc]').forEach(e => { const [t, b] = e.dataset.vc.split(',').map(Number), r = R(e); if(Math.abs((r.top + r.bottom) / 2 - (t + b) / 2) > 1) notes.push({kind:'logo-off-center'}); });
    card.querySelectorAll('[data-hc]').forEach(e => { const [l, rr] = e.dataset.hc.split(',').map(Number), r = R(e); if(Math.abs((r.left + r.right) / 2 - (l + rr) / 2) > 1.5) notes.push({kind:'off-center', text:e.textContent.trim().slice(0, 20)}); });
    card.querySelectorAll('[data-lines]:not(.fill)').forEach(e => { const n = +e.dataset.lines, s = stat(e);
      if(s.n !== n || s.last < 0.85) notes.push({kind:'write-up-lines', slot:'copy.text', lines:s.n, last:+s.last.toFixed(2), text:e.textContent.trim().slice(0, 30)}); });
    card.querySelectorAll('img[data-photo]').forEach(im => { if(!im.naturalWidth) return; const r = R(im);
      const ppi = Math.min(im.naturalWidth / (r.width / 96), im.naturalHeight / (r.height / 96));
      if(ppi < 299) issues.push({kind:'photo-under-300ppi', slot:'photo.' + im.dataset.role, ppi:Math.round(ppi)}); });
    if((D.paid || D.mode === 'print') && card.querySelector('[data-placeholder]') && (D.agent||{}).headshotWanted) issues.push({kind:'headshot-placeholder', slot:'agent.headshot'});
    if(!front && !(D.brand || {}).returnAddress) issues.push({kind:'missing-return-address', slot:'brand.returnAddress'});
    return {issues, notes};
  }

  // 6 x 11: the same design on the wider card. Fronts stretch evenly. On backs the mail side (postage, address block,
  // barcode strip and anything above the address block) keeps its size and moves right; the design side grows from
  // 528 to 720 px, so photos get wider and the seller pitch picks more sentences to fill its planned lines.
  function widen(card, front){
    const dx = WIDE - W0, kF = WIDE / W0, kL = (528 + dx) / 528;
    const at = el => { const c = card.getBoundingClientRect(), r = el.getBoundingClientRect();
      return {l:r.left - c.left, r:r.right - c.left, t:r.top - c.top, b:r.bottom - c.top}; };
    const orig = new Map(front ? [] : [...card.children].filter(e => e.tagName === 'IMG').map(e => [e, at(e)]));
    card.style.width = WIDE + 'px';
    [...card.children].forEach(el => {
      if(el.tagName === 'SCRIPT' || getComputedStyle(el).position !== 'absolute') return;
      const cr = card.getBoundingClientRect(), er = el.getBoundingClientRect();   // (SVG has no offsetLeft)
      const l = er.left - cr.left, w = er.width, t = er.top - cr.top, r = l + w, s = el.style;
      if(s.right && s.right !== 'auto' && !s.left) return;   // pinned to the right edge: it stays there
      let nl, nr;
      if(front){ nl = l * kF; nr = r * kF;
        // contact lines fit a set width (data-maxw): the block moves with the card but keeps its width
        if(el.matches('[data-cl],[data-clb]') || el.querySelector('[data-cl],[data-clb]')){ if(l + w / 2 > W0 / 2) nl = nr - w; else nr = nl + w; } }
      else if(el.hasAttribute('data-z') || l >= 528){ nl = l + dx; nr = r + dx; }
      else if(r <= 532){ nl = l * kL; nr = (t >= 500 && Math.abs(r - 408) < 1) ? 408 + dx : Math.min(r * kL, r > 520 ? 528 + dx - 8 : 1e9); }
      else { nl = l * kL; nr = r + dx; }
      if(s.width === 'max-content'){ s.left = nl + 'px'; s.right = 'auto'; return; }   // sizes itself to its text (fonts load later)
      // circles and other round shapes keep their size; only their center moves (an empty box filled later is not round)
      const br = getComputedStyle(el).borderTopLeftRadius;
      if(el.offsetHeight > 2 && w > 2 && (br.indexOf('%') >= 0 ? parseFloat(br) >= 40 : parseFloat(br) >= Math.min(w, el.offsetHeight) / 2 - 1)){ const c = (nl + nr) / 2; nl = c - w / 2; nr = c + w / 2; }
      s.left = nl + 'px'; s.width = (nr - nl) + 'px'; s.right = 'auto'; s.boxSizing = 'border-box';
      if(el.tagName.toLowerCase() === 'svg'){   // drawn frames and waves follow the new width
        const nw = nr - nl; el.setAttribute('width', nw);
        if(el.getAttribute('viewBox')) el.setAttribute('preserveAspectRatio', 'none');
        else el.querySelectorAll('rect').forEach(rc => { const x = +rc.getAttribute('x'), rw = +rc.getAttribute('width');
          if(x < 60 && x + rw > w - 60) rc.setAttribute('width', rw + nw - w); });
      }
    });
    evenRows(orig);
  }

  // A back photo row that runs up to the photo under the return address keeps one even gap on the wider card: the
  // 6 x 9 gaps stay as drawn and the row's photos share the new width (owner 10/25: no wider gap before the mail side).
  function evenRows(orig){
    const imgs = [...orig.keys()], O = e => orig.get(e), px = v => parseFloat(v);
    const ov = (a, b) => Math.min(a.b, b.b) - Math.max(a.t, b.t) > 20;
    const side = imgs.filter(e => O(e).l < 528), mail = imgs.filter(e => O(e).l >= 528);
    const grp = new Map(side.map(e => [e, [e]]));
    side.forEach(a => side.forEach(b => {                    // neighbors in a row, or stacked in one column
      const A = O(a), B = O(b), g = B.l - A.r;
      if(a === b || grp.get(a) === grp.get(b)) return;
      if((ov(A, B) && g > -1 && g < 40) || (Math.abs(A.l - B.l) < 1 && Math.abs(A.r - B.r) < 1)){
        const m = grp.get(a).concat(grp.get(b)); m.forEach(e => grp.set(e, m)); }
    }));
    const rows = [...new Set(grp.values())].map(row => {
      const spans = [];
      row.forEach(e => { const o = O(e); if(!spans.some(s => Math.abs(s.l - o.l) < 1)) spans.push({l:o.l, r:o.r}); });
      spans.sort((a, b) => a.l - b.l);
      return {row, spans, inner:spans.slice(1).map((s, i) => s.l - spans[i].r)};
    });
    const lay = ({row, spans, inner}, x1) => {               // the 6 x 9 gaps stay; the photos share the room left
      const x0 = px(row.find(e => Math.abs(O(e).l - spans[0].l) < 1).style.left);
      const room = x1 - x0 - inner.reduce((a, b) => a + b, 0), drawn = spans.reduce((a, s) => a + s.r - s.l, 0);
      let x = x0;
      spans.forEach((s, i) => { const w = (s.r - s.l) * room / drawn;
        row.filter(e => Math.abs(O(e).l - s.l) < 1).forEach(e => { e.style.left = x + 'px'; e.style.width = w + 'px'; });
        x += w + (inner[i] || 0); });
    };
    const ends = [];                                         // drawn right edge -> new right edge
    rows.forEach(R => {
      const last = R.spans[R.spans.length - 1];
      const m = mail.find(e => R.row.some(r => ov(O(r), O(e))) && O(e).l - last.r > -1 && O(e).l - last.r < 40);
      if(!m) return;
      const g = O(m).l - last.r;
      if(g > 12 || R.inner.some(i => Math.abs(i - g) > 0.5)) return;   // only rows drawn with one thin even gap
      lay(R, px(m.style.left) - g); ends.push([last.r, px(m.style.left) - g]); R.done = 1;
    });
    rows.forEach(R => {                                      // a row drawn flush with one of those rows stays flush
      if(R.done || R.spans.length < 2) return;
      const hit = ends.find(([r]) => Math.abs(r - R.spans[R.spans.length - 1].r) < 1);
      if(hit) lay(R, hit[1]);
    });
  }


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
  // 6 x 11 rule (10/24, as on the Just Sold library): the whole house fits its frame's height. A wider frame can't show the
  // whole house from a 3:2 photo, so the frame narrows to the width that does, keeping the side on the card edge (or the
  // outer side), and a room photo fills the freed space at the row's gap. Frames that would leave under 90 px stay and
  // are reported (house-cut). Runs after the photos load; returns the new photos so the page waits for them too.
  function houseFit(card, D, pick, side){
    const W = card.offsetWidth, P = D.photos || {}, added = [], c = card.getBoundingClientRect(), k = c.width / W;
    const R = el => { const r = el.getBoundingClientRect(); return {l:(r.left - c.left) / k, r:(r.right - c.left) / k, t:(r.top - c.top) / k, b:(r.bottom - c.top) / k}; };
    let n = 0;
    [...card.querySelectorAll('img[data-photo]')].forEach(im => {
      const hb = (P[im.dataset.photo] || {}).house; if(!hb || !im.naturalWidth || im.parentElement !== card) return;
      if(getComputedStyle(im).borderRadius.indexOf('50%') >= 0) return;
      const ew = im.clientWidth, eh = im.clientHeight, nw = im.naturalWidth, nh = im.naturalHeight, hh = hb.bottom - hb.top;
      if(eh / nh >= ew / nw) return;                          // the frame's height already shows the whole photo height
      if(eh * nw / (nh * ew) >= hh) return;                   // the house already fits
      const w2 = Math.floor(eh * nw / (nh * Math.min(1, hh + 0.03))), w1 = Math.floor(eh * nw / (nh * Math.min(1, hh + 0.01)));
      const a = R(im), others = [...card.querySelectorAll('img[data-photo]')].filter(o => o !== im).map(o => ({o, q:R(o)}))
        .filter(({q}) => Math.min(a.b, q.b) - Math.max(a.t, q.t) > 20);
      if(a.l >= 528 + W - W0 - 1){ im.style.width = w1 + 'px'; return; }   // under the return address: keeps the address block's left edge
      const keepRight = a.r >= W - 1 || (a.l > 1 && a.l + ew / 2 > W / 2);
      const gapOf = q => keepRight ? a.l - q.r : q.l - a.r;
      const nb = others.filter(({q}) => gapOf(q) >= -1 && gapOf(q) < 40);
      const g = nb.length ? Math.max(4, Math.min(...nb.map(({q}) => gapOf(q)))) : 8, free = ew - w2 - g;
      const shrink = w => { im.style.width = w + 'px'; if(keepRight) im.style.left = (a.l + ew - w) + 'px'; };
      if(free < 90){
        // the photo beside it (and anything stacked with it) takes the space, so the row keeps its gap
        const beside = nb.filter(({q}) => q.t >= a.t - 2 && q.b <= a.b + 2);
        if(beside.length && beside.length === nb.length){ const d = ew - w1; shrink(w1);
          beside.forEach(({o, q}) => { if(keepRight) o.style.width = (q.r - q.l + d) + 'px'; else { o.style.left = (q.l - d) + 'px'; o.style.width = (q.r - q.l + d) + 'px'; } }); }
        else if(!nb.length && ew - w1 <= 24) shrink(w1);          // a few px narrower, nothing beside it
        return; }
      const xl = keepRight ? a.l : a.l + w2 + g;
      shrink(w2);
      const role = 'x' + side[0] + (++n), p = pick.pick(role);
      const x = document.createElement('img'); x.alt = ''; x.style.cssText = im.style.cssText; x.dataset.role = role;
      Object.assign(x.style, {left:xl + 'px', top:a.t + 'px', width:free + 'px', height:eh + 'px', objectPosition:'center'});
      if(p.id){ x.dataset.photo = p.id; x.src = p.src; } else x.dataset.missing = '1';
      im.after(x); added.push(x);
    });
    return added;
  }

  // 6 x 11 changes to single designs, made after widen() (same shape as the Just Sold library's WIDE11)
  const WIDE11 = {
    M19: {back:{run(h){    // the wide top photo 6 px taller so the whole house fits its height (the tab and the text below keep their places)
      h.box(h.q('photo:family'), null, null, null, 218); }}},
    M40: {front:{run(h){   // three photo columns, the middle one narrow enough to show the whole house; the 8 px black edge stays 8 px
      const col = (roles, l, w) => roles.forEach(r => h.box(h.q('photo:' + r), l, null, w));
      col(['living'], 8, 333); col(['front', 'lawn'], 349, 300); col(['kitchen', 'primary'], 657, 391);
      h.parts().filter(e => { const r = h.rect(e); return r.w < 14 && r.h > 100 && r.t >= 400; })
        .forEach(e => { const r = h.rect(e); h.box(e, r.l < 100 ? 0 : 1048, null, 8); }); }}},
  };

  // Page scripts from the approved front drawings, run after the contact lines are set
  const HOOKS = {
    // M28: the address's capital letters center top to bottom in the space above the facts line
    M28: [(card, R, RR) => { const a = card.querySelector('#adr'), f = card.querySelector('#fct'); if(!a || !f) return;
      const ink = e => { const r = document.createRange(); r.selectNodeContents(e); return RR(r.getBoundingClientRect()); };
      const ft = ink(f).top + 3, ar = ink(a), capH = ar.height * 0.72, capTop = ar.top + (ar.height - capH) / 2, want = ft / 2 - capH / 2;
      const p = a.parentElement; p.style.top = (parseFloat(p.style.top) + want - capTop) + 'px'; }],
    // M49: the block's widest line ends on the 24 px right margin; the logo shares the block's left edge
    M49: [(card, R) => { const k = card.querySelector('#blk'); if(k) k.style.left = (card.offsetWidth - 24 - R(k).width) + 'px'; }],
  };

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

  // ---------------------------------------------------------------- the agent's own text changes
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
  function overlaps(card, e){
    const a = e.getBoundingClientRect(), k = card.getBoundingClientRect().width / card.offsetWidth;
    return [...card.querySelectorAll('[data-spot], img')].filter(o => o !== e && !o.contains(e) && !e.contains(o) && getComputedStyle(o).display !== 'none' && (() => {
      const b = o.getBoundingClientRect(); return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 * k && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2 * k; })());
  }
  function applyEdits(card, side, edits, fonts){
    const done = [];
    spotsOf(card).forEach((e, i) => {
      const id = side + ':' + i, ed = edits[id]; e.dataset.spot = id; if(!ed) return;
      e._before = overlaps(card, e);
      const each = f => [e, ...e.querySelectorAll('*')].forEach(f);
      if(ed.text != null && !LOCKED(e)){ e.classList.remove('fill'); delete e.dataset.alts; delete e.dataset.cl; delete e.dataset.clb;
        e.innerHTML = String(ed.text).replace(/[&<>]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;'})[c]).replace(/\n/g, '<br>'); }
      if(ed.font && fonts.indexOf(ed.font) >= 0) each(x => x.style.fontFamily = x === e ? `'${ed.font}', sans-serif` : 'inherit');
      if(ed.color && /^#[0-9a-f]{3,8}$/i.test(ed.color)){ e.style.color = ed.color; e.querySelectorAll('*').forEach(x => x.style.color = 'inherit'); }
      const k = Math.min(SIZE_MAX, Math.max(SIZE_MIN, +ed.size || 1));
      if(k !== 1) each(x => { const cs = getComputedStyle(x); x.style.fontSize = (parseFloat(cs.fontSize) * k) + 'px';
        if(/px$/.test(cs.lineHeight)) x.style.lineHeight = (parseFloat(cs.lineHeight) * k) + 'px'; });
      e.dataset.edited = '1'; done.push(e);
    });
    return done;
  }
  function editChecks(card, edited){
    const issues = [];
    edited.forEach(e => {
      if(e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).whiteSpace === 'nowrap') return;   // reported as overflow already
      const before = e._before || [];
      const hit = overlaps(card, e).find(o => before.indexOf(o) < 0 && !o.closest('[data-hs]') && (o.dataset.spot || o.tagName === 'IMG'));
      if(hit) issues.push({kind:'text-overlap', slot:e.dataset.spot, text:e.textContent.trim().slice(0, 30)}); });
    return issues;
  }
  function spotInfo(card){
    return spotsOf(card).map(e => { const cs = getComputedStyle(e);
      return {id:e.dataset.spot, text:e.innerText, font:(cs.fontFamily.split(',')[0] || '').replace(/['"]/g, ''), color:cs.color,
              pt:+(parseFloat(cs.fontSize) * 0.75).toFixed(1), edited:!!e.dataset.edited, locked:LOCKED(e)}; });
  }

  // ---------------------------------------------------------------- public: draw one side
  function draw(doc, host, D, side, opts){
    opts = opts || {};
    const v = values(D);
    const hs = !!(D.agent || {}).headshot || !!(D.agent || {}).headshotPlaceholder || !!opts.headshot;
    const long = opts.long != null ? opts.long : isLong(doc, v, hs);
    const tpl = chooseTemplate(doc, side, hs, long);
    if(!tpl) throw new Error('no template for ' + side);
    const frag = tpl.content.cloneNode(true);
    const card = frag.querySelector('#card');
    card.removeAttribute('id'); card.classList.add('jl-card');
    // the drawings ran on a bare page: the host page's line spacing and text settings must not leak in
    Object.assign(card.style, {lineHeight: card.style.lineHeight || 'normal', textAlign: card.style.textAlign || 'left', letterSpacing: card.style.letterSpacing || 'normal'});
    const did = ((doc.title || '').match(/M\d\d/i) || [''])[0].toUpperCase();
    // photos are assigned across the whole card (front first, then back) so a photo never shows up twice
    const roles = rolesIn([chooseTemplate(doc, 'front', hs, long), chooseTemplate(doc, 'back', hs, long)]);
    const wide0 = (opts.size || '6x9') === '6x11';
    if(wide0) roles.push('xf1', 'xf2', 'xb1', 'xb2');   // room photos houseFit() may add on the wider card (front, back)
    ['front', 'back'].forEach(s => (((wide0 && WIDE11[did]) || {})[s] || {}).roles && WIDE11[did][s].roles.forEach(r => { if(roles.indexOf(r) < 0) roles.push(r); }));
    const assigned = assignPhotos(D, roles);
    const filled = fill(card, D, v, assigned);
    host.appendChild(card);
    const wide = (opts.size || '6x9') === '6x11', fix = wide ? (WIDE11[did] || {}) : {};
    if(wide){ widen(card, side === 'front');
      if(fix[side] && fix[side].run) fix[side].run(helpers(card, photoPicker(D, assigned), v, filled), {hs, long}); }
    const fonts = fontsOf(doc);
    if(hs && !(D.agent || {}).headshot) card.querySelectorAll('[data-hs]').forEach(el => el.dataset.placeholder = '1');
    const imgs = [...card.querySelectorAll('img')].filter(i => i.getAttribute('src'));
    // load every face the card uses before measuring (copy fitting depends on the real letter widths)
    const faces = new Set();
    [card, ...card.querySelectorAll('*')].forEach(el => { const cs = getComputedStyle(el);
      faces.add(`${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}`); });
    const loaded = list => Promise.all(list.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    return loaded(imgs)
      .then(() => wide ? loaded(houseFit(card, D, photoPicker(D, assigned), side)) : 0)
      .then(() => Promise.all([...faces].map(f => document.fonts.load(f).catch(() => null))))
      .then(() => document.fonts.ready)
      .then(() => { const edited = applyEdits(card, side, D.textEdits || {}, fonts);
        const r = layout(card, D, side === 'front', did); r.issues.push(...editChecks(card, edited)); if(opts.print) forPrint(card);
        // a name that won't fit this design: one plain message for the agent (shorten the mailer name or pick another design)
        if(r.issues.some(c => c.slot === 'agent.name' || (/overflow|safe-area|mail-zone/.test(c.kind) && c.text &&
            [v.agentName, v.agentFirst, v.agentLast].filter(x => x && x.length > 2).some(x => c.text.toLowerCase().indexOf(x.toLowerCase().slice(0, 12)) >= 0))))
          r.issues.unshift({kind:'name-too-long', slot:'agent.mailerName', name:v.agentName});
        // a name the rule let through that still runs past its column (wide capitals): use the long-name layout if there is one
        if(!long && opts.long == null && r.issues.some(c => c.kind === 'name-too-long') && doc.querySelector(`template[data-side="${side}"][data-long="1"]`)){
          card.remove(); return draw(doc, host, D, side, Object.assign({}, opts, {long:true})); }
        return {card, issues:filled.filter(x => x.kind !== 'photo-stand-in').concat(r.issues), notes:filled.filter(x => x.kind === 'photo-stand-in').concat(r.notes),
                variant:{side, headshot:hs, longName:long}, fonts, spots:spotInfo(card), sizeRange:[SIZE_MIN, SIZE_MAX]}; });
  }

  window.JLLib = {values, draw, poolAlts,
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
    window.brochureReady = draw(document, page, D, side, {print, size:D.piece.size}).then(r => {
      if(print) page.style.background = getComputedStyle(r.card).backgroundColor;
      window.proofNotes = r.notes;
      document.body.dataset.version = (r.variant.headshot ? 'headshot' : 'no-headshot') + (r.variant.longName ? '-long-name' : '');
      window.brochureCheck = () => r.issues; window.brochureSpots = () => ({fonts:r.fonts, spots:r.spots});
      return true;
    });
  });
})();
