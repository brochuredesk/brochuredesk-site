/* Just Listed + Just Sold announcement library (test library, 10/22/2026).
   Postcards (6x9 and 6x11, front and back) and social posts/stories ported from the approved designs in
   docs/briefs/approved-designs-handoff/ (the Python there is the design spec; this is the template system version).

   card.html loads this file, the two postcard design files (jl-mail.js, js-mail.js) and the socials (socials-data.js, socials.js).
   Each design registers itself with ANN.design(id, spec) and builds its HTML from data only:
     listing   address, city, state, zip, beds, baths, sqft, yearBuilt
     agent     name, nar (REALTOR(R) toggle), phone, email, web, headshot (url or null)
     brand     brokerage, address (return address), logo / logoOnDark / logoKnockout, logos {black, gold, white, ...}
     photos    {id: {src, w, h, tags, room, house: {left, top, right, bottom}}}; house = the whole-house box
     companion.justListed  writer copy for Just Listed (see copy-example.json)
     companion.justSold    agent inputs + writer copy for Just Sold (see copy-example.json)
   Rules kept from the handoff (docs/briefs/approved-designs-handoff/briefs, the two approved-to-code docs):
     no price, QR, photo numbers or "virtually staged" (the neighborhood may appear in the copy, the owner 10/26/2026); whole house in every front-of-house photo;
     no photo twice on one mailer; brokerage logo on every postcard front (except JL-M02, JL-M08); write-up cut to fit
     from one master; long agent names shrink to the 18 pt floor, then compact rows, then a hyphen break.
   Every check runs in window.brochureCheck() (the renderer collects it into checks.json). */
(function(){
  const A = window.ANN = {};
  const DESIGNS = {};
  A.design = (id, spec) => { DESIGNS[id] = Object.assign({id}, spec); };
  A.designs = () => DESIGNS;

  // ---------- fonts (files in fonts/pool; the renderer stages pages in templates/announce/) ----------
  const FONTS = {'allura':[400], 'anton':[400], 'archivo':[300,400,500,600,700,800,900], 'bebas-neue':[400],
    'bodoni-moda':[400,500,600,700], 'cormorant-garamond':[300,400,500,600,700], 'figtree':[300,400,500,600,700,800,900],
    'great-vibes':[400], 'josefin-sans':[300,400,500,600,700], 'jost':[300,400,500,600,700,800,900], 'lato':[100,300,400,700,900],
    'libre-baskerville':[400,500,600,700], 'marcellus':[400], 'montserrat':[300,400,500,600,700,800,900],
    'mrs-saint-delafield':[400], 'oswald':[300,400,500,600,700], 'pinyon-script':[400], 'playfair-display':[400,500,600,700,800,900],
    'tenor-sans':[400], 'italianno':[400], 'parisienne':[400], 'cinzel':[400,500,600,700], 'dm-serif-display':[400]};
  A.SCRIPTS = ['allura','great-vibes','pinyon-script','mrs-saint-delafield','italianno','parisienne'];
  const isScript = ff => A.SCRIPTS.some(s => String(ff).toLowerCase().includes(s));
  function fontCSS(base){
    let css = '';
    for(const [f, ws] of Object.entries(FONTS)) for(const w of ws)
      css += `@font-face{font-family:'${f}';src:url(${base}${f}-latin-${w}-normal.woff2);font-weight:${w};font-style:normal}\n`;
    return css;
  }

  // ---------- helpers ----------
  const esc = A.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const up = s => String(s).toUpperCase().replace(/&([A-Z]+);/g, (m, e) => '&' + e.toLowerCase() + ';');
  A.U = up;   // uppercase text that may hold HTML entities (&amp; &reg; &middot;)
  // width of a line of text in a CSS font ("600 24px 'jost'"), for designs that pick a layout by name length
  const cv = document.createElement('canvas').getContext('2d');
  A.textWidth = (text, font) => { cv.font = font; return cv.measureText(String(text).replace(/&[a-z]+;/g, 'x')).width; };
  const r1 = v => Math.round(v * 10) / 10;

  // ---------- data ----------
  const SUFFIX = /\s+(street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd|court|ct|circle|cir|place|pl|way|terrace|ter|trail|trl|parkway|pkwy|highway|hwy|loop|row|bend|cove|cv|square|sq|run|path|pass|point|pt|crossing|xing)\.?$/i;
  // Just Sold wording from the brief's playbook (just-sold-library-build.md). The agent picks a headline and a CTA or types
  // their own; anything left empty falls back to these. No AI writes Just Sold copy: it sells the agent, not the house.
  A.PLAYBOOK = {
    ctaHead: 'Thinking about selling?', ctaNext: 'Your home could be next.', ctaShort: 'Call today to schedule a private home consultation.',
    cta: "Curious what your home is worth in today's market? Let's set a time to talk.",
    ctas: ["Thinking about selling? Let's talk.", 'Call today to schedule a private home consultation.',
      "Curious what your home is worth in today's market? Let's set a time to talk.", 'Yours could be next.',
      'Your home could be next.', "I'm ready to help sell yours.", 'This home sold. Is yours next?', 'Looking to buy or sell? I can help with both.'],
    master: ['I just helped sell {address}.', "If you've wondered what your home would sell for today, I'd be glad to pull recent sales near you and walk you through them.",
      "I'll walk you through it in person, along with a plan for pricing, prep and marketing.", "There's no cost and no obligation to list.", 'Call or text me any time.'],
    drop: [3, 4, 5],
    letter: "I just helped sell the home at {address}. If you've been wondering what your home would sell for today, I'd be glad to pull recent sales near you and walk you through them. There's no cost and no obligation to list. When you're ready, call or text me.",
    offerList: ['Go over recent sales near you', 'Walk through your house with you', 'Give you a price range and what it takes to get there', "Tell you what's worth fixing and what isn't", 'You decide if and when to list'],
    listLabel: "How I'd start", nohsLines: ['Recent sales near you', 'A plan before you list', 'No obligation to list']
  };
  function soldDefaults(js, addr){
    const out = Object.assign({}, js), fill = v => typeof v === 'string' ? v.replace(/\{address\}/g, addr) : Array.isArray(v) ? v.map(fill) : v;
    for(const k of ['ctaHead', 'ctaNext', 'ctaShort', 'cta', 'master', 'drop', 'letter', 'offerList', 'listLabel', 'nohsLines'])
      if(out[k] == null || (Array.isArray(out[k]) && !out[k].length) || out[k] === '') out[k] = fill(A.PLAYBOOK[k]);
    return out;
  }

  function setup(D){
    A.D = D;
    const P = D.piece || {}, L = D.listing || {}, ag = D.agent || {}, b = D.brand || {}, C = D.companion || {};
    A.piece = P; A.mode = D.mode || 'email'; A.print = A.mode === 'print';
    A.card = P.card || (String(P.design || '').startsWith('JS-') ? 'sold' : 'listed');
    A.size = P.size || '6x9'; A.side = P.side || 'front';
    A.social = A.size === 'post' || A.size === 'story';
    A.W = {'6x9': 864, '6x11': 1056, post: 1080, story: 1080}[A.size];
    A.H = {'6x9': 576, '6x11': 576, post: 1350, story: 1920}[A.size];
    A.wide = A.size === '6x11';
    A.bleed = A.print && !A.social ? 12 : 0;   // 0.125 in at 96 px/in
    // listing
    const street = String(L.address || '').trim();
    A.addr = esc(street);
    A.addrShort = esc(street.replace(SUFFIX, ''));   // street number + name, no suffix (owner note M07)
    A.city = esc([L.city, L.state].filter(Boolean).join(', '));
    A.cityZip = esc([L.city, [L.state, L.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '));
    A.cityOnly = esc(L.city || '');
    A.beds = esc(L.beds); A.baths = esc(L.baths);
    A.halfBaths = +L.halfBaths || 0;
    A.sqft = L.sqft ? Number(L.sqft).toLocaleString('en-US') : '';
    A.built = esc(L.yearBuilt || '');
    const fb = A.halfBaths ? `${A.baths} Full, ${A.halfBaths} Half Baths` : `${A.baths} Full Baths`;
    A.FACTS = `${A.beds} Beds &nbsp;|&nbsp; ${A.baths}${A.halfBaths ? '.' + 5 : ''} Baths &nbsp;|&nbsp; ${A.sqft} Sq Ft`;
    A.FACTS_UP = up(`${A.beds} Bedrooms &nbsp;&middot;&nbsp; ${fb} &nbsp;&middot;&nbsp; ${A.sqft} Sq Ft`).replace(/&NBSP;/g,'&nbsp;').replace(/&MIDDOT;/g,'&middot;');
    A.FACTS_DOT = `${A.beds} Bedrooms &nbsp;&middot;&nbsp; ${fb} &nbsp;&middot;&nbsp; ${A.sqft} Sq Ft`;
    A.FACTS_SHORT = `${A.beds} BEDS &nbsp;&middot;&nbsp; ${A.baths}${A.halfBaths ? '.5' : ''} BATHS &nbsp;&middot;&nbsp; ${A.sqft} SQ FT`;
    A.hood = String(L.neighborhood || '');   // the writer may use it in the copy (optional, the owner 10/26/2026)
    // agent
    const name = String(ag.name || '').trim();
    A.name = esc(name);
    A.first = esc(name.split(/\s+/)[0] || '');
    A.last = esc(name.split(/\s+/).slice(1).join(' '));
    A.title = ag.nar === false ? '' : 'REALTOR&reg;';   // REALTOR(R) only for NAR members
    A.phone = esc(ag.phone); A.email = esc(ag.email); A.web = esc(ag.web || '');
    A.headshot = ag.headshot || null; A.hasHeadshot = !!A.headshot;
    A.broker = esc(b.brokerage || ''); A.brokerAddr = esc(b.address || '');
    // copy (writer output and agent inputs; nothing here is invented by the template)
    const jl = C.justListed || {}, js = soldDefaults(C.justSold || {}, String(L.address || '').trim());
    A.jl = jl; A.js = js;
    A.lead = esc(jl.lead); A.about = esc(jl.about); A.aboutShort = esc(jl.aboutShort); A.blurb = esc(jl.blurb);   // two sentences for two-line write-ups
    A.hook = esc(jl.hook); A.hookTail = esc(jl.hookTail);
    A.features = (jl.features || []).map(esc); A.featuresShort = (jl.featuresShort || []).map(esc);
    A.callLine = esc(jl.callLine || '');
    A.head = esc(js.headline || 'Just Sold');
    A.ctaHead = esc(js.ctaHead); A.cta = esc(js.cta); A.ctaShort = esc(js.ctaShort); A.ctaNext = esc(js.ctaNext);
    A.letter = esc(js.letter); A.offerList = (js.offerList || []).map(esc); A.listLabel = esc(js.listLabel || '');
    A.nohsLines = (js.nohsLines || []).map(esc);
    // agent toggles (Just Sold): print only what the agent picked; offer counts need the seller's OK (Texas)
    A.days = js.days ? +js.days : null;
    A.daysLine = A.days ? `Sold in ${A.days} Day${A.days === 1 ? '' : 's'}` : '';
    A.offersLine = js.offers ? (js.offersOk && /^\d+$/.test(String(js.offers)) ? `${js.offers} Offers Received` : 'Multiple Offers Received') : '';
    A.sellSide = js.side || null;   // 'seller' | 'buyer' | 'both' | null (never A.side: that is front/back)
    A.sideLine = {seller: 'Represented the Seller', buyer: 'Represented the Buyer', both: 'Represented the Buyer and Seller'}[A.sellSide] || '';
    A.status = A.card === 'sold' ? A.head : 'Just Listed';
    const hw = String(js.headline || 'Just Sold').trim().split(/\s+/);
    A.headSplit = [esc(hw.slice(0, -1).join(' ') || hw[0]), esc(hw.length > 1 ? hw[hw.length - 1] : '')];   // ["Just", "Sold"], ["Another Home", "Sold"]
    A.listedAndSold = js.headline === 'Listed & Sold';
    A.issues = []; A.notes = [];
  }
  A.copyIssue = (slot, detail) => A.issues.push({slot, kind: 'missing-copy', detail});

  // master write-up cut to fit: every sentence goes in; the page drops the least important (drop order) until it fits
  A.writeup = (card) => {
    const c = (card || A.card) === 'sold' ? A.js : A.jl, M = c.master || [], drop = c.drop || [];
    if(!M.length) A.copyIssue('writeup', 'companion.' + (card === 'sold' ? 'justSold' : 'justListed') + '.master is empty');
    return M.map((s, i) => { const k = drop.indexOf(i + 1); return `<span data-p="${k < 0 ? 99 : k}">${esc(s)} </span>`; }).join('');
  };
  A.caption = id => esc(((A.jl.captions || {})[id]) || '');
  A.room = id => { const p = (A.D.photos || {})[id] || {}; return esc(p.room || String(p.tags || '').split(',')[0].replace(/^\w/, c => c.toUpperCase())); };

  // ---------- photos: roles -> listing photos, whole-house placement ----------
  // Designs ask for a role ("front", "kitchen", ...). The writer or agent can set companion.<card>.photoRoles;
  // otherwise the role matches a photo id, then its tags, then the next unused photo of the right kind.
  const ROLE_TAGS = {
    front: /front exterior|front of (the )?house|exterior front|street view/i,
    family: /side angle|corner|angled|side exterior/i,
    lawn: /back ?yard|patio|rear exterior|deck|yard|pool/i,
    kitchen: /kitchen/i, kitchen2: /kitchen|breakfast bar/i, dining: /dining/i, living: /living|family room|great room|den/i,
    primary: /primary bed|master bed|primary suite/i, nook: /nook|breakfast/i, office: /bath|office/i,
    bedroom2: /bedroom/i, study: /study|office|bedroom/i, hall: /entry|hall|foyer/i
  };
  const EXTERIOR_ROLES = ['front', 'family'];
  A.order = () => (A.D.photoOrder || Object.keys(A.D.photos || {}));
  A.isHouse = id => { const p = (A.D.photos || {})[id]; return !!(p && p.house); };
  const isExterior = id => A.isHouse(id) || /exterior|yard|patio|deck|pool|twilight/i.test(((A.D.photos || {})[id] || {}).tags || '');
  A.used = new Set();
  A.resolve = (role) => {
    const P = A.D.photos || {}, ids = A.order(), roles = ((A.card === 'sold' ? A.js : A.jl).photoRoles) || {};
    const free = id => id && P[id] && !A.used.has(id);
    if(free(roles[role])) return roles[role];
    if(free(role)) return role;
    const re = ROLE_TAGS[role];
    if(re){ const m = ids.find(id => free(id) && re.test(P[id].tags || '') && (!EXTERIOR_ROLES.includes(role) || A.isHouse(id))); if(m) return m; }
    if(EXTERIOR_ROLES.includes(role)){ const m = ids.find(id => free(id) && A.isHouse(id)); if(m) return m; }
    return ids.find(id => free(id) && !isExterior(id)) || ids.find(free) || null;
  };
  const ar = id => { const p = (A.D.photos || {})[id] || {}; return p.w && p.h ? p.w / p.h : 1.5; };
  A.houseFits = (id, w, h) => {
    const p = (A.D.photos || {})[id]; if(!p || !p.house) return true;
    const a = w / h, PA = ar(id), [vx, vy] = a >= PA ? [1, PA / a] : [a / PA, 1], H = p.house;
    return (H.right - H.left) <= vx + 0.005 && (H.bottom - H.top) <= vy + 0.005;
  };
  // where the photo sits in its slot: the whole house centered and kept in frame (handoff house_pos)
  function housePos(id, w, h){
    const p = (A.D.photos || {})[id] || {}, H = p.house, a = w / h, PA = ar(id);
    const [vx, vy] = a >= PA ? [1, PA / a] : [a / PA, 1];
    const axis = (lo, hi, v) => {
      if(v >= 0.999) return 0.5;
      let s = (lo + hi) / 2 - v / 2; s = Math.min(Math.max(s, 0), 1 - v);
      if(hi - lo <= v){ s = Math.min(Math.max(s, hi - v), lo); s = Math.min(Math.max(s, 0), 1 - v); }
      return s / (1 - v);
    };
    if(!H){ const fx = p.focusX != null ? p.focusX / 100 : 0.5, fy = p.focusY != null ? p.focusY / 100 : 0.5; return [fx, fy]; }
    return [axis(H.left, H.right, vx), axis(H.top, H.bottom, vy)];
  }
  // A.ph(role, x, y, w, h, style, pos): a photo slot. A role whose house won't fit the slot takes the angled exterior if
  // that fits; social slots fall back to an interior (owner note 10/21). pos ("50% 30%") only for interiors.
  // keep (socials): use the design's pos for a front-of-house photo too, when the whole house stays in frame with it
  A.ph = (role, x, y, w, h, st, pos, keep) => {
    let id = A.resolve(role);
    if(id && A.isHouse(id) && !A.houseFits(id, w, h)){
      const alt = A.order().find(q => q !== id && !A.used.has(q) && A.isHouse(q) && A.houseFits(q, w, h));
      if(alt) id = alt;
      else if(A.social){ const keep = id; A.used.add(keep); id = A.resolve('living'); A.used.delete(keep); }
    }
    if(!id){ A.issues.push({slot: role, kind: 'empty-photo-slot'}); return `<div class="a" data-photo="" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${st||''}"></div>`; }
    A.used.add(id); A.lastPhoto = id;   // A.caption(A.lastPhoto) / A.room(A.lastPhoto) right after a slot
    const p = A.D.photos[id], PA = ar(id);
    const [cw, ch] = w / h >= PA ? [w, w / PA] : [h * PA, h];
    let [fx, fy] = housePos(id, w, h);
    if(pos && !p.house){ const m = String(pos).match(/(-?[\d.]+)%\s+(-?[\d.]+)%/); if(m){ fx = +m[1] / 100; fy = +m[2] / 100; } else if(pos === 'center'){ fx = fy = .5; } }
    if(pos && p.house && keep){
      const m = String(pos).match(/(-?[\d.]+)%\s+(-?[\d.]+)%/), H = p.house, vx = w / cw, vy = h / ch;
      if(m){ const px = +m[1] / 100, py = +m[2] / 100, l = px * (1 - vx), t = py * (1 - vy);
        if(H.left >= l + .01 && H.right <= l + vx - .01 && H.top >= t + .01 && H.bottom <= t + vy - .01){ fx = px; fy = py; } }
    }
    const ox = -(cw - w) * fx, oy = -(ch - h) * fy;
    const hb = p.house ? ` data-house="${p.house.left},${p.house.top},${p.house.right},${p.house.bottom}"` : '';
    return `<div class="a ph" data-photo="${esc(id)}"${hb} data-cw="${r1(cw)}" data-ch="${r1(ch)}" data-ox="${r1(ox)}" data-oy="${r1(oy)}" ` +
      `style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background-image:url('${esc(p.src)}');background-repeat:no-repeat;` +
      `background-size:${r1(cw)}px ${r1(ch)}px;background-position:${r1(ox)}px ${r1(oy)}px;${st||''}"></div>`;
  };
  // the photo's url, for designs that place it with an <img> or a mask
  A.photoSrc = role => { const id = A.resolve(role); if(!id) return ''; A.used.add(id); return A.D.photos[id].src; };

  // ---------- brokerage logo ----------
  // kind: the colorway the design was approved with (black | gold | white | forest | color). An agent's own logo kit
  // maps it: dark-ink kinds use brand.logo, white uses the knockout (or on-dark) version. Never a white box.
  A.LSCALE = 1;
  const logoSrc = kind => {
    const b = A.D.brand || {}, k = b.logos || {};
    if(k[kind]) return k[kind];
    if(kind === 'white' || kind === 'gold-on-dark') return b.logoKnockout || b.logoOnDark || null;
    return b.logo || null;
  };
  A.logoSrc = logoSrc;
  A.logo = (kind, x, y, h, st) => {
    const src = logoSrc(kind);
    if(!src){ A.issues.push({slot: 'logo.' + kind, kind: 'logo-version-missing', detail: 'this spot needs the ' + kind + ' version of the logo'}); return ''; }
    if(A.LSCALE !== 1){
      const w0 = h * 10 / 3, h2 = r1(h * A.LSCALE);
      x -= (h2 * 10 / 3 - w0) / 2; y -= (h2 - h) / 2; h = h2;
      if(h * 10 / 3 < 400) x = Math.min(Math.max(x, 14), A.W - 14 - h * 10 / 3);
    }
    // the designs were approved with a 10:3 logo file whose artwork fills the middle 94% x 70%; logos reach templates
    // trimmed (renderer trim_logo), so each sits inside that same artwork box, kept to its own shape
    const bw = h * 10 / 3 * 0.94, bh = h * 0.696;
    return `<img class="a logo" alt="" src="${esc(src)}" style="left:${r1(x + h * 10 / 3 * 0.033)}px;top:${r1(y + h * 0.153)}px;width:${r1(bw)}px;height:${r1(bh)}px;object-fit:contain;object-position:left center;${st||''}">`;
  };
  A.logoi = (kind, h, st) => {
    const src = logoSrc(kind);
    if(!src){ A.issues.push({slot: 'logo.' + kind, kind: 'logo-version-missing'}); return ''; }
    return `<img class="logo" alt="" src="${esc(src)}" style="height:${r1(h * 0.696)}px;max-width:${r1(h * 10 / 3 * 0.94)}px;object-fit:contain;display:block;margin:${r1(h * 0.153)}px 0;${st||''}">`;
  };

  // ---------- layout primitives (same as the handoff's t / box / ic) ----------
  A.t = (x, y, w, html, st) => `<div class="a" style="left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}${st||''}">${html}</div>`;
  A.box = (x, y, w, h, bg, st) => `<div class="a" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${bg};${st||''}"></div>`;
  A.flexc = (h, inner, align, just) => `<div style="height:${h}px;display:flex;flex-direction:column;justify-content:${just||'center'};align-items:${align||'center'}">${inner}</div>`;
  const IC = {
    bed: '<path d="M3 18v-7h18v7M3 14h18M6 11V8h5v3M13 11V8h5v3"/>',
    bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/>',
    area: '<path d="M4 4h16v16H4zM4 9h5M15 20v-5h5"/>',
    home: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>',
    pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    year: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
    phone: '<path d="M6 3h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'
  };
  A.ic = (k, size, color, sw) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw||1.5}" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle">${IC[k]}</svg>`;

  // agent headshot (never a stock face). With none on file the slot returns '' and the design closes up.
  A.headshotImg = (x, y, w, h, st) => A.hasHeadshot
    ? `<img class="a hs" alt="" src="${esc(A.headshot)}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;object-fit:cover;object-position:center 20%;${st||''}">` : '';
  // three plain lines that fill the headshot's space on a no-headshot front (handoff nohs_list, the owner JS-M12)
  A.nohsList = (x, y, w, ink, chk, font, size, center, rules) => {
    if(A.hasHeadshot) return '';
    const lines = A.nohsLines.length ? A.nohsLines : [];
    if(!lines.length) A.copyIssue('justSold.nohsLines', 'three lines for the no-headshot front');
    const rows = lines.map(s => `<div style="display:flex;gap:9px;align-items:center;margin-top:7px">${A.ic('check',16,chk,2.2)}<span>${s}</span></div>`).join('');
    const rl = m => rules ? `<div style="height:1px;background:${rules};margin:${m}"></div>` : '';
    let body = `<div style="font:600 ${size||14.5}px '${font}';color:${ink}">${rows}</div>`;
    if(center) body = `<div style="display:flex;justify-content:center">${body}</div>`;
    return `<div class="a" style="left:${x}px;top:${y}px;width:${w}px">${rl('0 30px 12px')}${body}${rl('14px 30px 0')}</div>`;
  };

  // ---------- postcard back ----------
  const DISCLAIMER_JL = 'Information deemed reliable but not guaranteed. If your property is currently listed with a broker, please disregard this notice. It is not intended to solicit listed property.';
  const DISCLAIMER_JS = 'If your property is currently listed with a broker, please disregard this notice. It is not intended to solicit listed property.';
  const NAME_MIN = 24;   // 18 pt floor for the agent's name on the back card

  // mail panel: right 386 px (4.02 in) of the back. The address, postage and barcode zones come from the mail vendor's
  // profile (data.mailVendor); until one is picked the zones are drawn as guides on proofs and left clear in print.
  A.mailpanel = (x, ink, font) => {
    const W = A.W, w = W - x, guide = !A.print;
    let h = `<div class="a" data-mail="1" style="left:${x}px;top:0;width:${w}px;height:576px;background:#fff"></div>`;
    h += A.t(x + 22, 26, 200, `<div class="fine" style="font:600 8.5px '${font}';letter-spacing:.5px;color:${ink}">${up(A.broker)}</div>` +
      `<div class="fine" style="font:400 8.5px '${font}';color:${ink};margin-top:2px">${A.brokerAddr}</div>`);
    if(!A.brokerAddr) A.issues.push({slot: 'brand.address', kind: 'missing-copy', detail: 'brokerage return address for the mail panel'});
    if(guide){
      h += `<div class="a guide" style="left:${W-118}px;top:22px;width:96px;height:66px;border:1px dashed #b9b9b9;font:500 8px '${font}';color:#999;text-align:center;padding-top:18px;line-height:1.35">POSTAGE<br>mail vendor</div>`;
      h += A.t(x + 70, 300, 290, [0,1,2,3].map(() => '<div style="height:1px;background:#d8d8d8;margin-bottom:22px"></div>').join('') +
        `<div class="guide" style="font:500 8px '${font}';color:#aaa;letter-spacing:.6px">MAILING ADDRESS AREA &middot; FILLED BY THE MAIL VENDOR</div>`);
    }
    return h;
  };

  // agent card (handoff agentcard + CARD_JS): first name over last name, REALTOR(R) under, phone/email/web right.
  A.agentcard = (x, y, w, d) => {
    const ink = d.ink || '#1d1d1d', acc = d.acc || ink, fd = d.fd, fb = d.fb, hs = A.hasHeadshot && d.headshot !== false && d.headshot;
    const ns = Math.min((d.name_size || 30) + ((d.name_w || 400) >= 600 ? 2 : 6), 30);
    const photo = hs ? `<div class="ac-ph" style="flex:none;width:80px;height:104px;border-radius:6px;overflow:hidden;margin-right:14px;box-shadow:0 0 0 1px rgba(0,0,0,.08)"><img src="${esc(A.headshot)}" style="width:100%;height:100%;object-fit:cover;object-position:center 20%;display:block"></div>` : '';
    const [phone_sz, mail_sz] = hs ? [19, 11.5] : [24, 13];
    const name = `<div class="ac-nm" data-role="agent-name" style="font:${d.name_w||400} ${ns}px/1.15 '${fd}';color:${ink};white-space:nowrap"><div><span>${A.first}</span></div><div><span>${A.last}</span></div></div>`;
    const under = `<div class="ac-sc" style="display:none;margin-top:5px"><div style="display:flex;align-items:baseline;gap:14px;white-space:nowrap">` +
      (A.title ? `<span style="font:600 11.5px '${fb}';letter-spacing:2.2px;color:${acc}">${up(A.title).replace('&REG;','&reg;')}</span>` : '') +
      `<span style="font:700 16px '${fb}';color:${ink};letter-spacing:.3px">${A.phone}</span></div>` +
      `<div style="font:400 11.5px '${fb}';color:${ink};margin-top:3px;white-space:nowrap">${A.email}${A.web ? ' &nbsp;&middot;&nbsp; ' + A.web : ''}</div></div>`;
    return A.t(x, y - 3, w,
      `<div class="ac" data-ns="${ns}" data-min="${NAME_MIN}" style="display:flex;align-items:center;height:110px">${photo}` +
      `<div class="ac-l" style="flex:1 1 auto;min-width:0;padding-right:16px">${name}` +
      (A.title ? `<div class="ac-ti" style="font:600 12px '${fb}';letter-spacing:2.4px;color:${acc};margin-top:6px">REALTOR&reg;</div>` : '<div class="ac-ti"></div>') + `${under}</div>` +
      `<div class="ac-dv" style="width:1px;align-self:stretch;margin:3px 0;background:${acc};opacity:.45"></div>` +
      `<div class="ac-r" style="flex:none;padding-left:16px"><div style="font:700 ${phone_sz}px '${fb}';color:${ink};letter-spacing:.3px">${A.phone}</div>` +
      `<div style="font:400 ${mail_sz}px/1.5 '${fb}';color:${ink};margin-top:5px">${A.email}${A.web ? '<br>' + A.web : ''}</div></div></div>`);
  };
  function fitCards(){
    document.querySelectorAll('.ac').forEach(c => {
      const nm = c.querySelector('.ac-nm'), ln = [...nm.querySelectorAll('span')], L = c.querySelector('.ac-l'), mn = +c.dataset.min;
      let ns = +c.dataset.ns;
      const fits = () => ln.every(x => x.getBoundingClientRect().width <= nm.clientWidth + 0.5) && L.scrollHeight <= c.clientHeight;
      const fit = () => { let s = ns; nm.style.fontSize = s + 'px'; while(!fits() && s > mn){ s -= 0.5; nm.style.fontSize = s + 'px'; } return fits(); };
      if(fit()) return;
      if(c.querySelector('.ac-ph')){
        c.classList.add('stk'); c.querySelector('.ac-dv').style.display = 'none'; c.querySelector('.ac-r').style.display = 'none';
        c.querySelector('.ac-ti').style.display = 'none'; c.querySelector('.ac-sc').style.display = 'block'; L.style.paddingRight = '0';
        ns = Math.min(ns, 26); if(fit()) return;
      }
      ln.forEach(x => { if(x.textContent.includes('-')) x.innerHTML = x.innerHTML.replace('-', '-<br>'); });
      if(!fit()) A.issues.push({slot: 'agent.name', kind: 'overflow', detail: 'the agent name does not fit the back card at 18 pt'});
    });
  }

  // which photos the front of this design uses (so the back never repeats one): build the front as a string first
  function frontUsed(spec){
    const keep = {issues: A.issues, side: A.side};
    A.used = new Set(); A.side = 'front';
    try{ spec.front(A); } catch(e){}
    const used = new Set(A.used);
    A.issues = keep.issues; A.side = keep.side;
    return used;
  }

  // when the front shows no whole-house exterior, the back's first photo becomes the front of the house (handoff fixb)
  const needFront = ps => (A.frontIds && ![...A.frontIds].some(A.isHouse) && !ps.some(r => ['front', 'family'].includes(r))) ? ['front'].concat(ps.slice(1)) : ps;
  // back logo: inside the 0.25 in safe zone and clear of the status line at 96 px
  const backLogo = (kind, h) => A.logo(kind, 30, 24, Math.min(h || 68, 64 / A.LSCALE));
  const disclaimer = (text, size, cw, fb, ink, op) => `<div class="a fine" style="left:30px;bottom:24px;width:${cw + 14}px;font:400 ${size}px/1.35 '${fb}';color:${ink};opacity:${op}">${text}</div>`;

  // Just Listed back (handoff common.back): big logo, "JUST LISTED --- 2614 CALDER", photos/list/story, agent card,
  // disclaimer, mail panel. d: bg, ink, acc, fd, fd2, fb, logo, logo_h, variant (photos|list|story), label, band, photos, ...
  A.backListed = d => {
    const W = A.W, mx = W - 386, cw = mx - 60;   // left content column width (418 at 6x9)
    const bg = d.bg || '#fff', ink = d.ink || '#1d1d1d', acc = d.acc || ink, fb = d.fb;
    let fd = d.fd; if(isScript(fd)) fd = d.fd2 || fb;
    const v = d.variant || 'photos', label = esc(d.label || 'About this home');
    const lab = d.label_st || `font:600 10.5px '${fb}';letter-spacing:2.6px;color:${acc};text-transform:uppercase`;
    let h = '';
    if(d.band) h += `<div class="a" style="left:0;top:0;width:${mx}px;height:576px;background:${d.band}"></div>`;
    h += backLogo(d.logo || 'black', d.logo_h);
    h += A.t(30, 96, cw, `<div style="display:flex;align-items:center;white-space:nowrap;font-family:'${fb}'"><span style="font-weight:700;font-size:17px;letter-spacing:2.6px;color:${ink}">JUST LISTED</span>` +
      `<span style="flex:1;height:1.5px;background:${ink};opacity:.35;margin:0 14px"></span><span style="font-weight:500;font-size:17px;letter-spacing:3px;color:${ink};opacity:.62">${up(A.addrShort)}</span></div>`);
    const ps = needFront(d.photos || ['primary', 'lawn']);
    if(v === 'photos'){
      const n = ps.length, gap = 18, pw = (cw - gap * (n - 1)) / n;
      ps.forEach((role, i) => {
        const x = 30 + i * (pw + gap), slot = A.ph(role, r1(x), 130, r1(pw), 104, d.ph_st || '');
        const id = (slot.match(/data-photo="([^"]*)"/) || [])[1];
        if(!A.caption(id)) A.copyIssue('justListed.captions.' + id, 'caption for the back photo');
        h += slot + A.t(r1(x), 238, r1(pw), `<div style="font:600 12px '${fb}';color:${ink}">${A.room(id)}</div><div style="font:400 11px/1.4 '${fb}';color:${ink};opacity:.85;margin-top:1px">${A.caption(id)}</div>`);
      });
      h += A.t(30, 292, cw, `<div style="${lab}">${label}</div><div data-fit="404" style="font:400 12.5px/1.55 '${fb}';color:${ink};margin-top:6px">${A.writeup('listed')}</div>`);
    } else if(v === 'list'){
      const stack = [ps[0], 'kitchen', 'primary', 'living', 'lawn', 'nook', 'dining', 'bedroom2', 'study', 'office', 'hall'];
      let k = 0;
      for(const role of stack){ if(k >= 3) break; if(k && A.used.has(role)) continue; const s = A.ph(role, 30, 130 + k * 94, 190, 88, d.ph_st || ''); if(s.includes('data-photo=""')) continue; h += s; k++; }
      if(A.features.length < 7) A.copyIssue('justListed.features', '7-8 bullets so the list column is full');
      const items = A.features.map(f => `<div style="display:flex;gap:9px;align-items:baseline;margin-bottom:6px"><span style="width:6px;height:6px;background:${acc};flex:none;transform:translateY(-2px)"></span><span>${f}</span></div>`).join('');
      h += A.t(240, 130, cw - 208, `<div style="${lab}">${label}</div><div style="font:400 12.5px/1.32 '${fb}';color:${ink};margin-top:10px">${items}</div>`);
      h += A.t(240, 384, cw - 208, `<div style="font:600 10.75px '${fb}';letter-spacing:1px;white-space:nowrap;color:${acc}">${A.FACTS_SHORT}</div>`);
    } else {
      h += A.t(30, 140, cw, `<div style="${lab}">${label}</div><div data-fit="374" style="font:${d.story_font || `400 14.5px/1.66 '${fb}'`};color:${ink};margin-top:10px">${A.writeup('listed')}</div>` +
        `<div style="font:600 13.5px '${fb}';color:${acc};margin-top:12px;letter-spacing:1.5px">${A.FACTS_UP}</div>`);
    }
    h += `<div class="a" style="left:30px;top:412px;width:${cw}px;height:1px;background:${d.rule || acc};opacity:.6"></div>`;
    h += A.agentcard(30, 420, cw, {fd, fb, ink, acc, name_size: d.name_size || 30, name_w: d.name_w || 400, headshot: A.headshot});
    h += disclaimer(DISCLAIMER_JL, 8, cw, fb, ink, .7);
    h += A.mailpanel(mx, '#333', fb);
    return {html: h, bg, font: fb, color: ink};
  };

  // Just Sold back (handoff just-sold common.back): sells the agent. variant cta | list | letter.
  A.backSold = d => {
    const W = A.W, mx = W - 386, cw = mx - 60;
    const bg = d.bg || '#fff', ink = d.ink || '#1d1d1d', acc = d.acc || ink, fb = d.fb, fd = d.fd;
    const fd2 = isScript(fd) ? (d.fd2 || fb) : fd;
    const v = d.variant || 'cta', hsz = d.hs || 25;
    const hd = d.head_st || `font:${d.hw || 500} ${hsz}px/1.15 '${fd2}';color:${ink}`;
    let h = '';
    if(d.band) h += A.box(0, 0, mx, 576, d.band);
    h += backLogo(d.logo || 'black', d.logo_h);
    h += A.t(30, 96, cw, `<div data-addrline style="display:flex;align-items:center;gap:14px;white-space:nowrap;font:700 17px '${fb}';letter-spacing:2.6px;color:${ink}"><span>${up(A.head)}</span><span style="flex:1;height:1.5px;background:${acc};opacity:.7"></span><span data-short="${up(A.addrShort)}" style="font-weight:600;color:${acc}">${up(A.addr)}</span></div>`);
    const ps = needFront(d.photos || ['kitchen', 'lawn']);
    if(!A.ctaHead) A.copyIssue('justSold.ctaHead', 'seller call to action');
    if(v === 'cta'){
      const pw = (cw - 10) / 2;
      ps.slice(0, 2).forEach((role, i) => { h += A.ph(role, r1(30 + i * (pw + 10)), 128, r1(pw), 118, d.ph_st || ''); });
      h += A.t(30, 262, cw, `<div style="${hd}">${A.ctaHead}</div><div data-fit="392" style="font:400 13px/1.55 '${fb}';color:${ink};margin-top:8px">${A.writeup('sold')}</div>`);
    } else if(v === 'list'){
      const stack = [ps[0], 'kitchen', 'living', 'primary', 'lawn', 'nook', 'dining', 'kitchen2', 'bedroom2', 'office', 'study', 'hall'];
      let k = 0;
      for(const role of stack){ if(k >= 3) break; if(k && A.used.has(role)) continue; const s = A.ph(role, 30, 128 + k * 96, 180, 88, d.ph_st || ''); if(s.includes('data-photo=""')) continue; h += s; k++; }
      if(!A.offerList.length) A.copyIssue('justSold.offerList', 'the steps list for the back');
      const items = A.offerList.map(f => `<div style="display:flex;gap:9px;align-items:baseline;margin-bottom:7px"><span style="width:6px;height:6px;background:${acc};flex:none;transform:translateY(-2px)"></span><span>${f}</span></div>`).join('');
      h += A.t(228, 126, cw - 196, `<div style="${hd};font-size:${Math.min(hsz, 23)}px">${A.ctaHead}</div><div style="font:600 12px '${fb}';letter-spacing:1.4px;color:${acc};margin:9px 0 9px">${up(A.listLabel)}</div>` +
        `<div style="font:400 12.5px/1.32 '${fb}';color:${ink}">${items}</div>`);
    } else {
      h += A.ph(ps[0], 30, 128, cw, 110, d.ph_st || '');
      if(!A.letter) A.copyIssue('justSold.letter', 'the "Hello, neighbor" note');
      h += A.t(30, 252, cw, `<div style="${hd};font-size:${Math.min(hsz, 23)}px">Hello, neighbor.</div><div style="font:400 13px/1.55 '${fb}';color:${ink};margin-top:6px">${A.letter}</div>` +
        `<div style="font:400 34px/1 '${d.sig || 'allura'}';color:${acc};margin-top:4px">${A.first}</div>`);
    }
    h += A.box(30, 402, cw, 1, d.rule || acc, 'opacity:.6');
    h += A.agentcard(30, 412, cw, {fd: fd2, fb, ink, acc, name_size: d.name_size || 30, name_w: d.name_w || 400, headshot: d.noHeadshotCard ? false : A.headshot});
    h += disclaimer(DISCLAIMER_JS, 8.5, cw, fb, ink, .75);
    h += A.mailpanel(mx, '#333', fb);
    return {html: h, bg, font: fb, color: ink};
  };

  // ---------- fitting passes (after fonts load) ----------
  function fitWriteups(){
    document.querySelectorAll('[data-fit]').forEach(el => {
      const lim = +el.dataset.fit + A.bleed, over = () => el.getBoundingClientRect().bottom - pgTop() > lim;
      const sp = [...el.querySelectorAll('span[data-p]')].sort((a, b) => a.dataset.p - b.dataset.p), hid = [];
      for(const x of sp){ if(!over()) break; if(sp.length - hid.length <= 2) break; x.style.display = 'none'; hid.push(x); }
      for(const x of hid.slice().reverse()){ x.style.display = ''; if(over()) x.style.display = 'none'; }
      if(over()) A.issues.push({slot: 'writeup', kind: 'overflow', detail: 'the write-up runs past its space even cut to two sentences'});
    });
  }
  function fitWidths(){   // front and social name lines: shrink a long name to fit its line
    document.querySelectorAll('[data-fitw]').forEach(el => {
      const mn = +el.dataset.fitw; let s = parseFloat(getComputedStyle(el).fontSize);
      while(el.scrollWidth > el.clientWidth + 0.5 && s > mn){ s -= 0.5; el.style.fontSize = s + 'px'; }
      // a very long name keeps shrinking past the design's own minimum, never under 12 pt (social: 22 px)
      const floor = A.social ? 22 : 16;
      if(el.scrollWidth > el.clientWidth + 0.5 && s > floor){
        while(el.scrollWidth > el.clientWidth + 0.5 && s > floor){ s -= 0.5; el.style.fontSize = s + 'px'; }
        A.notes.push({slot: 'agent.name', note: `long name set at ${r1(s * (A.social ? 1 : .75))}${A.social ? ' px' : ' pt'}`});
      }
    });
  }
  // the street address is the agent's data, never cut: a one-line address shrinks until it sits inside the color band it
  // starts in and inside the safe zone (floor: 60% of its size, never under 8 pt / 20 px)
  function fitAddresses(){
    const L = A.D.listing || {}, street = String(L.address || '').trim() || '\u0000';
    const name = String((A.D.agent || {}).name || '').trim();
    const forms = [street, street.replace(SUFFIX, '')].concat(name ? [name] : []), pg = document.querySelector('.pg').getBoundingClientRect();
    const bands = [...document.querySelectorAll('.pg > div.a')].filter(b => { const cs = getComputedStyle(b), c = rgba(cs.backgroundColor); return c && c.a > 0.5 && !b.textContent.trim() && cs.transform === 'none'; });
    for(const e of leaves()){
      const tx = e.textContent.trim();
      if(!forms.some(f => tx.includes(f) || tx.toUpperCase().includes(f.toUpperCase()))) continue;
      const cs = getComputedStyle(e);
      const r0 = textRect(e), band = bands.find(b => { const q = b.getBoundingClientRect(); return r0.left >= q.left - 1 && r0.left < q.right && r0.top >= q.top - 1 && r0.top < q.bottom; });
      const edge = A.social ? 34 : 24;
      let lim = pg.right - edge, low = pg.left + edge, top = pg.top + (A.size === 'story' ? 250 : edge), bot = pg.bottom - (A.size === 'story' ? 250 : edge);
      if(band){ const q = band.getBoundingClientRect(); lim = Math.min(lim, q.right - 6); low = Math.max(low, q.left + 6); top = Math.max(top, q.top); bot = Math.min(bot, q.bottom); }
      const box = e.getBoundingClientRect(); if(cs.overflow !== 'visible') lim = Math.min(lim, box.right);
      const f0 = parseFloat(cs.fontSize), floor = Math.max(f0 * .6, A.social ? 20 : 32 / 3);
      let f = f0;
      const over = () => { const r = textRect(e); return r.right > lim + .5 || r.left < low - .5 || r.top < top - .5 || r.bottom > bot + .5 || e.scrollWidth > e.clientWidth + 1; };
      while(over() && f > floor){ f -= 0.5; e.style.fontSize = f + 'px'; }
      if(over() && cs.whiteSpace === 'nowrap' || over()){   // still too long at the floor: let it break at a space or hyphen, then fit again
        e.style.whiteSpace = 'normal'; e.style.overflowWrap = 'normal'; f = Math.max(f0 * .8, floor); e.style.fontSize = f + 'px';
        while(over() && f > floor){ f -= 0.5; e.style.fontSize = f + 'px'; }
      }
      if(f < f0) A.notes.push({slot: name && tx.includes(name) ? 'agent.name' : 'listing.address', note: `long address set at ${r1(f * (A.social ? 1 : .75))}${A.social ? ' px' : ' pt'}`});
    }
  }
  function fitAddrLines(){   // Just Sold back top line: the street suffix drops when it won't fit
    document.querySelectorAll('[data-addrline]').forEach(el => {
      if(el.scrollWidth > el.clientWidth + 1){ const s = el.querySelector('[data-short]'); s.textContent = s.dataset.short; }
    });
  }
  // Just Sold: the seller CTA question is a touch larger than the agent's name (about 1.08x); supporting lines
  // stay smaller; tags and pills (data-nofit) and script never grow (handoff CTA_JS, keyed to the real copy).
  function bumpCTA(){
    if(A.card !== 'sold') return;
    const all = [...document.querySelectorAll('.pg *')];
    const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const nm = A.D.agent && A.D.agent.name; let ns = 0;
    for(const e of all){ if(nm && own(e).startsWith(nm)) ns = Math.max(ns, parseFloat(getComputedStyle(e).fontSize)); }
    if(!ns) return;
    const js = A.js, heads = [js.ctaHead, js.ctaNext].filter(Boolean), lines = [js.cta, js.ctaShort].filter(Boolean);
    for(const e of all){
      const tx = e.textContent.trim();
      if(!tx || e.closest('[data-nofit]') || tx === tx.toUpperCase() || isScript(getComputedStyle(e).fontFamily)) continue;
      if(e.querySelector('*') && !own(e)) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      const head = heads.some(s => tx === s || tx.startsWith(s)) && tx.length <= 42;
      const line = !head && lines.some(s => tx.includes(s));
      if(!head && !line) continue;
      const tg = head ? Math.min(Math.max(fs, ns * 1.08), 34 * (ns > 30 ? 1.4 : 1)) : Math.max(fs, Math.min(ns * 0.72, 17));
      if(tg > fs) e.style.fontSize = tg.toFixed(1) + 'px';
    }
  }
  // print: everything that touches a trim edge runs 0.125 in past it (photos keep the same crop inside the trim)
  function extendBleed(){
    const b = A.bleed; if(!b) return;
    for(const el of document.querySelectorAll('.pg .a')){
      const cs = getComputedStyle(el);
      if(cs.transform !== 'none') continue;
      const solid = (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || cs.backgroundImage !== 'none';
      if(!solid || el.tagName === 'IMG') continue;
      let x = parseFloat(el.style.left), y = parseFloat(el.style.top), w = el.offsetWidth, h = el.offsetHeight;
      if(isNaN(x) || isNaN(y)) continue;
      let ox = parseFloat(el.dataset.ox || 0), oy = parseFloat(el.dataset.oy || 0);
      if(x <= 0.5){ x -= b; w += b; ox += b; }
      if(y <= 0.5){ y -= b; h += b; oy += b; }
      if(parseFloat(el.style.left) + el.offsetWidth >= A.W - 0.5) w += b;
      if(parseFloat(el.style.top) + el.offsetHeight >= A.H - 0.5) h += b;
      el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
      if(el.dataset.cw) el.style.backgroundPosition = `${ox}px ${oy}px`;
    }
  }
  // type floor (CLAUDE.md quality bar): nothing under 8 pt on a postcard, fine print not under 6 pt
  function typeFloor(){
    if(A.social) return;
    for(const e of leaves()){
      const fs = parseFloat(getComputedStyle(e).fontSize), fine = !!e.closest('.fine'), min = fine ? 8 : 32 / 3;
      if(fs < min - 0.01){ e.style.fontSize = min + 'px'; A.notes.push({slot: e.textContent.trim().slice(0, 32), note: `raised from ${r1(fs * .75)} pt to the ${fine ? 6 : 8} pt floor`}); }
    }
  }
  // contrast: text on a solid color that reads under 4.5:1 (3:1 large) is darkened (or lightened on dark) just enough
  function fixContrast(){
    for(const e of leaves()){
      let m = measureContrast(e); if(!m || m.c >= m.need) continue;
      const f0 = rgba(getComputedStyle(e).color), css0 = e.style.color;
      // away from the background first (dark text darker, light text lighter), then the other way; the smallest change that reads
      const dirs = lum(f0) < lum(m.bg) ? [{r: 0, g: 0, b: 0}, {r: 255, g: 255, b: 255}] : [{r: 255, g: 255, b: 255}, {r: 0, g: 0, b: 0}];
      let done = false;
      for(const t of dirs){
        for(let k = 0.05; k <= 1.001; k += 0.05){
          const c = {r: f0.r + (t.r - f0.r) * k, g: f0.g + (t.g - f0.g) * k, b: f0.b + (t.b - f0.b) * k};
          e.style.color = `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${f0.a})`; m = measureContrast(e);
          if(m && m.c >= m.need){ done = true; break; }
        }
        if(done) break;
        e.style.color = css0;
      }
      if(done) A.notes.push({slot: e.textContent.trim().slice(0, 32), note: 'color adjusted for 4.5:1 contrast'});
    }
  }
  function logosInSafeZone(){
    if(A.social) return;
    const pg = document.querySelector('.pg').getBoundingClientRect();
    for(const lg of document.querySelectorAll('.pg img.logo')){
      const r = lg.getBoundingClientRect(), x = r.left - pg.left, y = r.top - pg.top, host = lg.classList.contains('a') ? lg : null;
      if(!host) continue;
      let dx = 0, dy = 0;
      if(x < 24) dx = 24 - x; else if(x + r.width > A.W - 24) dx = A.W - 24 - x - r.width;
      if(y < 24) dy = 24 - y; else if(y + r.height > A.H - 24) dy = A.H - 24 - y - r.height;
      if(dx || dy){ lg.style.left = (parseFloat(lg.style.left) + dx) + 'px'; lg.style.top = (parseFloat(lg.style.top) + dy) + 'px'; A.notes.push({slot: 'logo', note: 'moved inside the 0.25 in safe zone'}); }
    }
  }
  const pgTop = () => document.querySelector('.pg').getBoundingClientRect().top;

  // ---------- checks ----------
  const BANNED = [/strung with/i, /big jobs/i, /sit on one/i, /room for a full/i, /nestled/i, /\bboasts?\b/i, /stunning/i, /dream/i,
    /must[- ]see/i, /won'?t last/i, /oasis/i, /sanctuary/i, /retreat/i, /charm/i, /cozy/i, /perfect for/i, /ideal for/i,
    /entertain/i, /elevate/i, /seamless/i, /breathtaking/i, /—/, /rebuilt/i, /all-new/i, /pergola/i, /move-in ready/i, /turnkey/i,
    /\bgem\b/i, /haven/i, /whimsical/i, /curated/i, /thoughtfully/i, /meticulous/i, /perfect match/i, /happy buyer/i,
    /global luxury/i, /\$\s?\d/, /sold for/i, /sold at/i, /listed at/i, /\bDRE\b/, /unlock/i, /journey/i, /hassle/i, /navigate/i, /no[\s-]+pressure/i,
    /virtually staged/i, /private showing\./i, /\bQR\b/i, /\bphoto\s*#?\d/i, /\b(list|asking|sale|sales|sold|offer) price\b/i, /lorem/i, /\bTBD\b/, /\bxx+\b/i];
  const rgba = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if(!m) return null; const v = m[1].split(',').map(parseFloat); return {r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1}; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const leaves = () => [...document.querySelectorAll('.pg *')].filter(e => !e.childElementCount && e.textContent.trim() && !e.closest('.guide'));
  const textRect = e => { const rg = document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect(); };
  // script faces have tall line boxes; their ink sits in the middle ~60% (README: swash false alarms on JL-M01, JL-S12)
  const inkRect = e => { const r = textRect(e); if(!isScript(getComputedStyle(e).fontFamily)) return r; const k = r.height * .2; return {left: r.left, right: r.right, top: r.top + k, bottom: r.bottom - k, width: r.width, height: r.height - 2 * k}; };
  const solidAt = el => {
    const cs = getComputedStyle(el);
    if(el.tagName === 'IMG' || (el instanceof SVGElement && el.tagName !== 'svg')) return true;
    const bg = rgba(cs.backgroundColor);
    if(bg && bg.a >= 0.5) return true;
    const bi = cs.backgroundImage;
    if(bi && bi !== 'none'){
      if(/url\(/.test(bi)) return true;
      // gradients: a see-through gradient (any transparent or half-clear stop) doesn't hide the house (README, JL-M11)
      const stops = bi.match(/rgba?\([^)]+\)|transparent/g) || [];
      return stops.length > 0 && stops.every(s => s !== 'transparent' && (rgba(s) || {a: 1}).a >= 0.9);
    }
    return false;
  };

  function measureContrast(e){
    const cs = getComputedStyle(e), fg = rgba(cs.color); if(!fg) return null;
    const r = textRect(e); if(!r.width) return null;
    const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    let bg = null;
    for(const s of stack){ if(s === e || e.contains(s)) continue; const c = getComputedStyle(s); if((c.backgroundImage !== 'none' && /url\(|gradient/.test(c.backgroundImage)) || s.tagName === 'IMG') return null; const b = rgba(c.backgroundColor); if(b && b.a >= 0.9){ bg = b; break; } }
    if(!bg) return null;
    let op = 1; for(let p = e; p && p !== document.body; p = p.parentElement) op *= +getComputedStyle(p).opacity;
    const a = op * fg.a, eff = {r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a)};
    const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    return {c: contrast(eff, bg), need: big ? 3 : 4.5, bg};
  }

  function check(){
    const out = A.issues.slice(), pg = document.querySelector('.pg').getBoundingClientRect(), W = A.W, H = A.H;
    const add = (slot, kind, extra) => out.push(Object.assign({slot, kind}, extra || {}));
    const nameText = (A.D.agent || {}).name || '';
    const slotOf = e => { const tx = e.textContent.trim(); return tx === nameText || tx === A.first || tx === A.last ? 'agent.name' : (e.closest('[data-slot]') || {dataset: {}}).dataset.slot || tx.slice(0, 32); };
    const L = leaves();
    for(const e of L){
      const r = textRect(e), rel = {l: r.left - pg.left, t: r.top - pg.top, r: r.right - pg.left, b: r.bottom - pg.top};
      if(!r.width) continue;
      if(rel.r > W + 1 || rel.l < -1 || rel.b > H + 1 || rel.t < -1) add(slotOf(e), 'off-page');
      const cs = getComputedStyle(e);
      const fsz = parseFloat(cs.fontSize), vtol = Math.max(2, fsz * 0.2);   // line boxes run taller than the letters
      if((e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + vtol) && cs.overflow !== 'visible') add(slotOf(e), 'overflow', {text: e.textContent.trim().slice(0, 60)});
      // text cut off by a box above it that hides its overflow (a squeezed flex row, a clipped panel)
      for(let p = e.parentElement; p && !p.classList.contains('pg'); p = p.parentElement){
        if(getComputedStyle(p).overflow === 'visible') continue;
        const q = p.getBoundingClientRect(); if(r.bottom > q.bottom + vtol || r.top < q.top - vtol || r.right > q.right + 2 || r.left < q.left - 2) add(slotOf(e), 'overflow', {text: e.textContent.trim().slice(0, 60), detail: 'clipped by its box'});
        break;
      }
      if(!A.social){
        const ink = inkRect(e), il = ink.left - pg.left, it = ink.top - pg.top, ir = ink.right - pg.left, ib = ink.bottom - pg.top;
        if(il < 23.5 || it < 23.5 || ir > W - 23.5 || ib > H - 23.5) add(slotOf(e), 'outside-safe-zone', {detail: 'text within 0.25 in of the trim'});
        const pt = parseFloat(cs.fontSize) * 0.75, fine = !!e.closest('.fine');
        if(!fine && pt < 7.95) add(slotOf(e), 'type-too-small', {size: r1(pt)});
        if(fine && pt < 5.95) add(slotOf(e), 'fine-print-below-6pt', {size: r1(pt)});
        if(!fine && pt < 8.45) A.notes.push({slot: slotOf(e), note: 'under the 8.5 pt secondary-text target', size: r1(pt)});
      } else {
        if(A.size === 'story' && (r.top - pg.top < 250 || r.bottom - pg.top > H - 250)) add(slotOf(e), 'story-safe-zone', {detail: 'text in the top or bottom 250 px'});
        const tx = e.textContent.trim();
        if(A.size === 'post' && (tx === nameText || tx.includes((A.D.listing || {}).address || '\u0000')) && (r.left - pg.left < 33.75 || r.right - pg.left > W - 33.75)) add(slotOf(e), 'outside-grid-crop', {detail: 'address and agent name stay inside the middle 3:4'});
      }
    }
    // text never runs into a band it doesn't sit inside (handoff BLEED check)
    const bands = [...document.querySelectorAll('.pg > div.a')].filter(b => { const cs = getComputedStyle(b), c = rgba(cs.backgroundColor); return c && c.a > 0.5 && !b.textContent.trim() && !b.dataset.photo && !b.dataset.mail && cs.transform === 'none'; });
    for(const e of L){
      const r = inkRect(e); if(!r.width) continue;
      for(const b of bands){
        if(b.contains(e)) continue;
        const q = b.getBoundingClientRect(), ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if(ix > 2 && iy > 2){ const inside = r.top >= q.top - 1 && r.bottom <= q.bottom + 1 && r.left >= q.left - 1 && r.right <= q.right + 1; const rowIn = r.top >= q.top - 1 && r.bottom <= q.bottom + 1, startsIn = r.left >= q.left - 1 || r.right <= q.right + 1;
          // runs into it from above or below, or starts inside it and runs out its side
          if(!inside && (iy < r.height - 2 || (rowIn && startsIn && ix < r.width - 2))) add(slotOf(e), 'text-runs-into-band'); }
      }
    }
    // whole house: sample the house box; fail on a cut (over 2% outside the slot) or a cover (over 6%) (crop rule)
    for(const el of document.querySelectorAll('.pg [data-house]')){
      const [x0, y0, x1, y1] = el.dataset.house.split(',').map(Number);
      const r = el.getBoundingClientRect(), cw = +el.dataset.cw, ch = +el.dataset.ch, ecs = getComputedStyle(el);
      // a rounded or clipped slot (circle, arch): a point outside its shape is cut off, not covered
      const shaped = parseFloat(ecs.borderTopLeftRadius) > 0 || parseFloat(ecs.borderBottomRightRadius) > 0 || ecs.clipPath !== 'none';
      const bp = getComputedStyle(el).backgroundPosition.split(' ').map(parseFloat);
      let cut = 0, hit = 0, tot = 0, shapeCut = 0;
      for(let i = 0; i <= 14; i++) for(let j = 0; j <= 14; j++){
        const fx = x0 + .03 + (x1 - x0 - .06) * i / 14, fy = y0 + .03 + (y1 - y0 - .06) * j / 14;
        const px = r.left + bp[0] + fx * cw, py = r.top + bp[1] + fy * ch; tot++;
        if(px < r.left || px > r.right || py < r.top || py > r.bottom){ cut++; continue; }
        const top = document.elementFromPoint(px, py);
        if(!top || top === el) { if(!top) cut++; continue; }
        if(shaped && !el.contains(top) && !document.elementsFromPoint(px, py).includes(el)){ shapeCut++; continue; }
        if(!el.contains(top) && solidAt(top)) hit++;
      }
      // the house box is a rectangle: an arch or circle may trim its empty sky corners (up to 6%), never more
      if(cut > tot * .02 || shapeCut > tot * .06 || cut + shapeCut > tot * .08) add(el.dataset.photo, 'house-cut-off', {pct: Math.round((cut + shapeCut) / tot * 100)});
      if(hit > tot * .06) add(el.dataset.photo, 'house-covered', {pct: Math.round(hit / tot * 100)});
    }
    // photos: every slot filled and loaded, none twice on one mailer, the front of the house somewhere on every postcard
    const ids = [...document.querySelectorAll('.pg [data-photo]')].map(e => e.dataset.photo);
    ids.filter(i => !i).forEach(() => add('photo', 'empty-photo-slot'));
    const seen = {}; ids.filter(Boolean).forEach(i => seen[i] = (seen[i] || 0) + 1);
    Object.entries(seen).filter(([, n]) => n > 1).forEach(([i, n]) => add(i, 'photo-repeated', {times: n}));
    if(A.frontIds) ids.filter(i => A.frontIds.has(i)).forEach(i => add(i, 'photo-repeated', {detail: 'also on the front'}));
    (A.failedPhotos || []).forEach(s => add(s, 'photo-missing'));
    if(!A.social && A.side === 'back'){
      const all = new Set([...ids, ...(A.frontIds || [])]);
      if(![...all].some(i => A.isHouse(i))) add('photos', 'no-front-of-house', {detail: 'the front of the house belongs somewhere on every postcard'});
    }
    // logos: on every postcard front (except the two approved without), on every back and social piece; TREC size
    const logos = [...document.querySelectorAll('.pg img.logo')];
    const spec = DESIGNS[A.piece.design] || {};
    const needLogo = A.social || A.side === 'back' || (A.side === 'front' && !spec.noFrontLogo);
    if(needLogo && !logos.length) add('logo', 'logo-missing');
    let nameFs = 0;
    for(const e of L) if(e.textContent.trim() === nameText || e.closest('[data-role=agent-name]')) nameFs = Math.max(nameFs, parseFloat(getComputedStyle(e).fontSize));
    for(const lg of logos){
      const h = lg.getBoundingClientRect().height;
      if(nameFs && h < 0.5 * 0.7 * nameFs) add('logo', 'trec-logo-too-small', {detail: 'brokerage logo under half the agent name size'});
      if(!A.social && A.side === 'front' && h < 33.6 * (A.wide ? 1 : 1)) add('logo', 'logo-under-0.35in');
      const lr = lg.getBoundingClientRect();
      if(!A.social && (lr.left - pg.left < 23 || lr.top - pg.top < 23 || lr.right - pg.left > W - 23 || lr.bottom - pg.top > H - 23)) add('logo', 'outside-safe-zone');
      if(!lg.complete || !lg.naturalWidth) add('logo', 'logo-missing');
    }
    // contrast: text on a solid color reads at 4.5:1 (3:1 for large type); text over photos is the design's own shade
    for(const e of L){ const m = measureContrast(e); if(m && m.c < m.need - 0.05) add(slotOf(e), 'low-contrast', {ratio: r1(m.c), need: m.need}); }
    if(A.social && spec.own) socialChecks(add, pg);
    // copy: banned phrases, price, placeholders
    const vis = L.map(e => e.textContent).join(' \n ');
    // Just Sold sells the agent: never a free estimate, never the sold home's features (owner rules 10/24/2026)
    if(A.card === 'sold'){
      const m = vis.match(/free (home value |home )?(estimate|evaluation)|when you call/i);
      if(m) add('copy', 'banned-phrase', {text: m[0]});
      const f = A.social && spec.own && vis.match(/\b(roof|wiring|plumbing|siding|counters?|patio|pool|remodel\w*|updated|bedrooms?|baths?|sq\.? ?ft|square feet)\b/i);
      if(f) add('copy', 'sold-home-features', {text: f[0]});
    }
    for(const re of BANNED){ const m = vis.match(re); if(m) add('copy', 'banned-phrase', {text: vis.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' ')}); }
    if(A.print){
      if(document.querySelector('.pg .guide')) add('mail', 'placeholder');
      if((A.D.agent || {}).headshotSample && document.querySelector('.pg img.hs, .pg .ac-ph')) add('agent.headshot', 'sample-headshot-on-paid-piece');
      if((A.D.brand || {}).sample) add('brand', 'sample-branding-on-paid-piece');
    }
    return out;
  }

  // the artwork inside a logo image (object-fit: contain), relative to the page
  A.logoArt = (lg, pg) => {
    const b = lg.getBoundingClientRect(), nw = lg.naturalWidth || b.width, nh = lg.naturalHeight || b.height;
    const k = Math.min(b.width / nw, b.height / nh), w = nw * k, h = nh * k, op = getComputedStyle(lg).objectPosition.split(' ').map(parseFloat);
    const l = b.left + (b.width - w) * (op[0] / 100), t = b.top + (b.height - h) * ((op[1] == null ? 50 : op[1]) / 100);
    return {l: l - pg.left, t: t - pg.top, r: l + w - pg.left, b: t + h - pg.top, w, h};
  };
  // the 10/24 socials (socials.js): text never touches other text, 30 px from every edge, stories keep text, logo and
  // agent out of the top and bottom 250 px, logo 70 px or taller and centered on the contact block where the design
  // centers it, photos side by side line up top and bottom
  function socialChecks(add, pg){
    const W = A.W, H = A.H, story = A.size === 'story', lines = [];
    document.querySelectorAll('.pg [data-slot]').forEach(b => {
      const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n;
      while((n = tw.nextNode())){
        if(!n.textContent.trim() || !n.parentElement.getClientRects().length) continue;
        const g = document.createRange(); g.selectNodeContents(n);
        for(const q of g.getClientRects()){
          if(q.width < 2 || q.height < 2) continue;
          lines.push({b: b.dataset.slot, x: q.left - pg.left, y: q.top - pg.top + q.height * .18, w: q.width, h: q.height * .64, t: n.textContent.trim().slice(0, 40)});
        }
      }
    });
    const seen = new Set();
    for(let i = 0; i < lines.length; i++){
      const a = lines[i];
      if(a.x < 29.5 || a.x + a.w > W - 29.5 || a.y < 29.5 || a.y + a.h > H - 29.5) add(a.t, 'too-close-to-edge', {detail: 'text within 30 px of the edge'});
      for(let j = i + 1; j < lines.length; j++){
        const b = lines[j]; if(a.b === b.b) continue;
        if(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h){
          const k = a.t + '|' + b.t; if(!seen.has(k)){ seen.add(k); add(a.t, 'text-overlap', {text: a.t, other: b.t}); }
        }
      }
    }
    const R = e => { const r = e.getBoundingClientRect(); return {l: r.left - pg.left, t: r.top - pg.top, r: r.right - pg.left, b: r.bottom - pg.top, w: r.width, h: r.height}; };
    // text never runs into a box, band, photo, logo or headshot it didn't sit on in the approved layout (4 px clear)
    if(A.sv){
      const hit = (a, o, g) => a.l < o.r + g && o.l < a.r + g && a.t < o.b + g && o.t < a.b + g;
      const shapes = [...document.querySelectorAll('.pg > div:not([data-slot]), .pg img.logo, .pg img.hs')].filter(e => {
        const cs = getComputedStyle(e), bg = cs.backgroundColor;
        return e.offsetWidth > 4 && e.offsetHeight > 4 && cs.transform === 'none' && cs.clipPath === 'none' && (e.tagName === 'IMG' || (bg && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(bg)) || cs.backgroundImage !== 'none');
      }).map(e => e.tagName === 'IMG' && e.classList.contains('logo') ? Object.assign(A.logoArt(e, pg), {img: 1}) : R(e));
      document.querySelectorAll('.pg [data-slot]').forEach(b => {
        const q = A.sv.blocks[+b.dataset.slot]; if(!q) return;
        const s = {l: q[0], t: q[1], r: q[0] + q[2], b: q[1] + q[3]};
        const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n; const ls = [];
        while((n = tw.nextNode())){
          if(!n.textContent.trim() || !n.parentElement.getClientRects().length) continue;
          const g = document.createRange(); g.selectNodeContents(n);
          for(const x of g.getClientRects()) if(x.width >= 2) ls.push({l: x.left - pg.left, t: x.top - pg.top, r: x.right - pg.left, b: x.bottom - pg.top, tx: n.textContent.trim().slice(0, 40)});
        }
        for(const o of shapes){
          if(hit(s, o, 4) || (o.l <= s.l && o.r >= s.r && o.t <= s.t && o.b >= s.b)) continue;   // the design put it there
          const x = ls.find(a => hit(a, o, o.img ? 2 : 3)); if(x) add(x.tx, 'text-runs-into-box', {text: x.tx});
        }
      });
    }
    for(const lg of document.querySelectorAll('.pg img.logo')){
      const r = A.logoArt(lg, pg);
      if(r.h < 69.5) add('logo', 'logo-under-70px', {size: Math.round(r.h)});
      if(story && (r.t < 250 || r.b > H - 250)) add('logo', 'story-safe-zone', {detail: 'logo in the top or bottom 250 px'});
      if(r.l < 29.5 || r.r > W - 29.5 || r.t < 29.5 || r.b > H - 29.5) add('logo', 'too-close-to-edge');
    }
    for(const hs of document.querySelectorAll('.pg img.hs')){
      const r = R(hs); if(story && (r.t < 250 || r.b > H - 250)) add('agent.headshot', 'story-safe-zone', {detail: 'headshot in the top or bottom 250 px'});
    }
    const v = A.sv, lg = document.querySelector('.pg img.logo');
    if(v && v.logoWithContact && lg){
      const rs = v.agent.map(i => document.querySelector(`.pg [data-slot="${i}"]`)).filter(Boolean).map(e => { const g = document.createRange(); g.selectNodeContents(e); const q = g.getBoundingClientRect(); return {t: q.top - pg.top, b: q.bottom - pg.top}; });
      const r = R(lg), c = (Math.min(...rs.map(x => x.t)) + Math.max(...rs.map(x => x.b))) / 2;
      if(rs.length && Math.abs(r.t + r.h / 2 - c) > 6) add('logo', 'logo-not-centered', {detail: 'logo not centered top to bottom with the contact block', off: Math.round(r.t + r.h / 2 - c)});
    }
    const ps = [...document.querySelectorAll('.pg > .ph[data-photo]')].filter(e => e.dataset.photo && getComputedStyle(e).transform === 'none').map(e => Object.assign(R(e), {id: e.dataset.photo}));
    for(let i = 0; i < ps.length; i++) for(let j = i + 1; j < ps.length; j++){
      const a = ps[i], b = ps[j], ov = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if(a.l < b.r - 1 && b.l < a.r - 1) continue;   // one above the other, not a row
      if(ov < .6 * a.h || ov < .6 * b.h || Math.min(a.h, b.h) < .85 * Math.max(a.h, b.h)) continue;   // a stack beside a big photo isn't a row
      if(Math.abs(a.t - b.t) > 2 || Math.abs(a.b - b.b) > 2) add(a.id + ' / ' + b.id, 'photos-not-aligned', {detail: 'photos in a row line up top and bottom'});
    }
  }

  // ---------- page ----------
  function preload(){
    const srcs = [...document.querySelectorAll('.pg [data-photo]')].map(e => (e.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1]).filter(Boolean);
    A.failedPhotos = [];
    return Promise.all(srcs.map(s => new Promise(res => { const i = new Image(); i.onload = () => res(); i.onerror = () => { A.failedPhotos.push(s); res(); }; i.src = s; })))
      .then(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
  }

  A.run = function(){
    const D = JSON.parse(document.getElementById('brochure-data').textContent || '{}');
    if(!D.listing){ document.body.textContent = 'No data injected.'; return; }
    setup(D);
    const st = document.createElement('style');
    st.textContent = fontCSS(D.fontBase || '../../fonts/pool/') +
      `*{margin:0;padding:0;box-sizing:border-box}.a{position:absolute}body{-webkit-font-smoothing:antialiased;background:#888}` + (A.card === 'sold' ? 'div{text-wrap:pretty}' : '') + `` +
      `.page{position:relative;overflow:hidden}.pg{position:absolute;overflow:hidden}`;
    document.head.appendChild(st);
    const spec = DESIGNS[A.piece.design];
    if(!spec){ document.body.textContent = 'Unknown design ' + A.piece.design; return; }
    // each photo's own shape (MLS photos are 3:2, 4:3 or anything else); the whole-house placement depends on it
    const sizes = Object.values(D.photos || {}).filter(p => p.src && !(p.w && p.h)).map(p => new Promise(res => {
      const i = new Image(); i.onload = () => { p.w = i.naturalWidth; p.h = i.naturalHeight; res(); }; i.onerror = () => res(); i.src = p.src; }));
    const loads = sizes.concat(Object.entries(FONTS).flatMap(([f, ws]) => ws.map(w => document.fonts.load(`${w} 20px '${f}'`).catch(() => null))))
      .concat(spec.prepare ? [spec.prepare(D)] : []);
    window.brochureReady = Promise.all(loads).then(() => {
      A.LSCALE = spec.lscale || 1;
      let r;
      if(A.social) r = spec.render(A);
      else if(A.side === 'front'){ A.used = new Set(); r = spec.front(A); }
      else { A.frontIds = frontUsed(spec); A.used = new Set(A.frontIds); r = (spec.card === 'sold' ? A.backSold : A.backListed)(typeof spec.back === 'function' ? spec.back(A) : spec.back); }
      const b = A.bleed, PW = A.W + 2 * b, PH = A.H + 2 * b;
      document.body.innerHTML = `<div class="page" style="width:${PW}px;height:${PH}px;background:${r.bg || '#fff'}"><div class="pg" style="left:${b}px;top:${b}px;width:${A.W}px;height:${A.H}px;` +
        `background:${r.bg || '#fff'};font-family:'${r.font || 'montserrat'}';color:${r.color || '#1d1d1d'};${b ? 'overflow:visible' : ''}">${r.html}</div></div>` + (r.css ? `<style>${r.css}</style>` : '') +
        (A.print ? `<style>@page{size:${PW}px ${PH}px;margin:0}@media print{body{background:none}}</style>` : '');
      window.pieceSize = {W: PW * 0.75, H: PH * 0.75, bleed: b * 0.75};
      return preload().then(() => document.fonts.ready).then(() => {
        // designs that fit their own copy (spec.own: the 10/24 socials) skip the postcard fitting passes
        if(!spec.own){ typeFloor(); fitWidths(); fitAddrLines(); fitAddresses(); fitWriteups(); fitCards(); bumpCTA(); fitWriteups(); }
        if(spec.own && spec.after) spec.after(A);   // own fitting first, so contrast is judged at the fitted size
        fixContrast(); logosInSafeZone();
        if(!spec.own && spec.after) spec.after(A);
        // checks run when asked (after the host has sized this page's frame; a page inside a small frame can't measure
        // what's on screen) on the trim-size render; print only adds bleed
        const baseIssues = A.issues.slice(), baseNotes = A.notes.length;
        extendBleed();
        window.photoPlacements = () => A.social ? [] : [...document.querySelectorAll('.pg [data-photo]')].filter(e => e.dataset.photo)
          .map(e => ({src: (e.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1], w: +e.dataset.cw / 96, h: +e.dataset.ch / 96}));
        window.proofNotes = A.notes;
        window.brochureCheck = () => { if(A.print) return []; A.issues = baseIssues.slice(); A.notes.length = baseNotes; return check(); };
      });
    });
  };
})();
