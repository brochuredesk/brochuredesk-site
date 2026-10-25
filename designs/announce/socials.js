/* Just Listed + Just Sold social posts (1080 x 1350) and stories (1080 x 1920), approved 10/24/2026.
   The layouts are compiled from the approved generator (docs/design/socials-final/generator) into socials-data.js by
   scripts/build_socials.py; this file fills them in from data and fits real copy into the approved footprint.
     - two versions per design, picked automatically: agent.headshot set -> the agent-photo layout, else the no-photo one
     - specialty cards (JS-S16, S32, S35, S41, S44, S48-days, S50): companion.justSold.specialty = 'hide' (or piece.plain)
       draws the plain version. Days default to 6; offers read "Multiple offers received" unless the agent typed a count
       and the seller OK'd it (offersOk). JS-S16: companion.justSold.side = 'seller' (default) | 'buyer'.
     - copy: listing (street without Street/Road/Avenue/Drive/Boulevard, city, state, beds, baths, sq ft, year), agent
       (name on mailers when set, REALTOR(R) for NAR members, phone, email, web), the writer's Just Listed copy, and the
       Just Sold playbook lines each design was approved with.
     - every text spot is editable: data.textEdits = {"<spot>": {text, font, color, size}} (fonts from the design's own
       list, size 0.8 to 1.3 of the design's size). window.socialSpots() lists the spots for the editor.
   Fitting: a block whose copy grew past its sample footprint and now runs into other text, the logo, the headshot, its
   own box or the edge margin shrinks (the web line goes first), then a nowrap line may break at a space. The logo is
   kept centered on the contact block where the design centers it. annlib.js runs the checks. */
(function(){
  const A = window.ANN, S = window.SOCIALS;
  if(!A || !S) return;
  const DROP = /\s+(street|st|road|rd|avenue|ave|drive|dr|boulevard|blvd)\.?$/i;   // Circle, Court, Lane stay
  const STATES = {alabama:'AL', alaska:'AK', arizona:'AZ', arkansas:'AR', california:'CA', colorado:'CO', connecticut:'CT', delaware:'DE',
    florida:'FL', georgia:'GA', hawaii:'HI', idaho:'ID', illinois:'IL', indiana:'IN', iowa:'IA', kansas:'KS', kentucky:'KY', louisiana:'LA',
    maine:'ME', maryland:'MD', massachusetts:'MA', michigan:'MI', minnesota:'MN', mississippi:'MS', missouri:'MO', montana:'MT', nebraska:'NE',
    nevada:'NV', 'new hampshire':'NH', 'new jersey':'NJ', 'new mexico':'NM', 'new york':'NY', 'north carolina':'NC', 'north dakota':'ND',
    ohio:'OH', oklahoma:'OK', oregon:'OR', pennsylvania:'PA', 'rhode island':'RI', 'south carolina':'SC', 'south dakota':'SD', tennessee:'TN',
    texas:'TX', utah:'UT', vermont:'VT', virginia:'VA', washington:'WA', 'west virginia':'WV', wisconsin:'WI', wyoming:'WY', 'district of columbia':'DC'};
  const sentences = s => String(s || '').match(/[^.!?]+[.!?]+(?=\s|$)/g) || (s ? [String(s)] : []);
  const esc = A.esc, U = s => A.U(esc(s));

  // ---------- data -> the fields the layouts use ----------
  function values(){
    const D = A.D, L = D.listing || {}, ag = D.agent || {}, jl = A.jl, js = A.js;
    const street = String(L.address || '').trim().replace(DROP, '');
    const st = /^[A-Z]{2}$/.test(String(L.state || '')) ? L.state : (STATES[String(L.state || '').trim().toLowerCase()] || L.state || '');
    const name = String(ag.mailerName || ag.name || '').trim(), parts = name.split(/\s+/);
    const city = String(L.city || '');
    const days = js.days ? +js.days : 6, dd = days + (days === 1 ? ' day' : ' days');
    const count = js.offersOk && /^\d+$/.test(String(js.offers || '')) && +js.offers > 1 ? +js.offers : 0;
    const offers = count ? `${count} offers received` : 'Multiple offers received';
    const buyer = js.side === 'buyer';
    const tail = String(jl.hookTail || '');
    const v = {
      name, NAME: name.toUpperCase(), first: parts[0] || '', last: parts.slice(1).join(' '),
      realtor: ag.nar === false ? '' : 'REALTOR®', phone: ag.phone || '', email: ag.email || '', web: ag.web || '',
      street, STREET: street.toUpperCase(), city, CITY: city.toUpperCase(), st,
      beds: L.beds == null ? '' : String(L.beds), baths: L.baths == null ? '' : String(L.baths) + (+L.halfBaths ? '.5' : ''),
      bathsFull: L.baths == null ? '' : String(L.baths), sqft: L.sqft ? Number(L.sqft).toLocaleString('en-US') : '', built: L.yearBuilt || '',
      days: dd, DAYS: dd.toUpperCase(), offers, Offers: offers.replace(/\b\w/g, c => c.toUpperCase()),
      'jl.blurb': jl.blurb || jl.aboutShort || jl.lead, 'jl.lead': jl.lead, 'jl.hook': jl.hook, 'JL.HOOK': String(jl.hook || '').toUpperCase(),
      'jl.hookTail': jl.hookTail, 'jl.hookFull': jl.hook && jl.hookTail ? jl.hook + ' ' + jl.hookTail : jl.hook,
      'jl.about': jl.about, 'jl.aboutShort': jl.aboutShort, 'jl.aboutRest': sentences(jl.about).slice(1).join(' ').trim() || jl.aboutShort,
      'jl.what': tail.replace(/^in an?\s+/i, '') || jl.hook,
      'jl.call': String(jl.callLine || 'Call or text for a private showing').trim().replace(/[.!]+$/, ''),   // no period (owner rule)
      'js.sideLine': buyer ? 'Represented the Buyer' : 'Represented the Seller',
      'js.sidePara': buyer
        ? `I represented the buyers on this one, from the first showing to the last signature at closing. If you’re thinking about selling in ${city}, I’d be glad to walk your home with you and go over your timing.`
        : `I represented the sellers on this one, from pricing and prep to the last signature at closing. If you’re thinking about selling in ${city}, I’d be glad to walk your home with you and go over your timing.`
    };
    // list bullets: the writer's short features that aren't facts (the facts print on their own), then short long-form ones
    const fl = (jl.featuresShort || []).filter(f => !/\d/.test(f));
    for(const f of jl.features || []) if(f.length <= 30 && !fl.some(x => x.toLowerCase() === f.toLowerCase())) fl.push(f);
    fl.forEach((f, i) => { v['jl.f' + i] = f; });
    return v;
  }
  const OPTIONAL = new Set(['realtor', 'web', 'last']);

  // ---------- one design ----------
  function photo(q){
    const st = (q.st ? q.st + ';' : '') + (q.top ? '' : 'z-index:0;');
    return A.ph(q.role, q.x, q.y, q.w, q.h, st, q.pos, true);
  }
  function logo(q){
    const src = A.logoSrc(q.kind), [x, y, w, h] = q.r;
    if(!src){ A.issues.push({slot: 'logo.' + q.kind, kind: 'logo-version-missing', detail: 'this spot needs the ' + q.kind + ' version of the logo'}); return ''; }
    const pos = x + w >= 1080 - 80 ? 'right center' : x <= 80 ? 'left center' : 'center';
    return `<img class="a logo" alt="" src="${esc(src)}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;object-fit:contain;object-position:${pos};${q.st || ''}">`;
  }
  const version = R => {
    const plain = R.specialty && (A.piece.plain === true || A.js.specialty === 'hide' || A.js.plain === true);
    return (plain ? 'p' : '') + (A.hasHeadshot ? '1' : '0');
  };

  for(const R of S.designs){
    A.design(R.id, {card: R.set, own: true, social: R.kind,
      prepare(){   // the design's faces (italics and a few weights aren't in the local pool) from the canvas's own font link
        if(!document.querySelector('link[data-socials]')){
          const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = S.fonts; l.dataset.socials = '1';
          document.head.appendChild(l);
          A.fontsLink = new Promise(res => { l.onload = l.onerror = res; setTimeout(res, 4000); });
        }
        return A.fontsLink.then(() => Promise.all(R.fonts.map(f => document.fonts.load(f.replace(/ (\D[^]*)$/, " 40px '$1'")).catch(() => null))));
      },
      render(A){
        const key = version(R), v = R.v[key], vals = values();
        A.sv = v; A.srec = R; A.skey = key;
        const html = v.html
          .replace(/\{\{PH:(\d+)\}\}/g, (m, i) => photo(v.photos[+i]))
          .replace(/\{\{LOGO:(\d+)\}\}/g, (m, i) => logo(v.logos[+i]))
          .replace(/\{\{HS\}\}/g, esc(A.headshot || ''))
          .replace(/\{\{([\w.]+)\}\}/g, (m, k) => {
            const x = vals[k];
            if((x == null || x === '') && !OPTIONAL.has(k)) A.copyIssue(k.startsWith('jl.') || k.startsWith('JL.') ? 'justListed.' + k.slice(3) : k, 'needed by this design');
            const e = esc(x == null ? '' : x);
            return k === 'web' && e ? `<span data-web="1">${e}</span>` : e;
          });
        return {html, bg: v.bg, font: 'Montserrat', color: '#1d1d1d'};
      },
      after(A){ decorative(); applyEdits(R); fit(); centerLogo(); edgeLogos(); fit(); centerLogo(); edgeLogos(); spots(R); }
    });
  }

  // ---------- agent text edits (same contract as the postcard library) ----------
  const families = R => [...new Set(R.fonts.map(f => f.replace(/^(italic )?\d+ /, '')))];
  function applyEdits(R){
    const ed = A.D.textEdits || {}, fams = families(R);
    for(const [id, e] of Object.entries(ed)){
      const el = document.querySelector(`.pg [data-e="${id}"]`); if(!el || !e) continue;
      const cs = getComputedStyle(el), f0 = parseFloat(cs.fontSize);
      if(e.text != null){
        const kids = [...el.childNodes], other = kids.some(n => n.nodeType === 1 && n.tagName !== 'BR' && n.tagName !== 'SPAN');
        if(other){ const t = kids.find(n => n.nodeType === 3 && n.textContent.trim()); if(t) t.textContent = ' ' + e.text + ' '; }
        else el.innerHTML = esc(e.text).replace(/\n/g, '<br>');
      }
      if(e.font && fams.includes(e.font)) el.style.fontFamily = `'${e.font}'`;
      if(e.color && /^#[0-9a-f]{6}$/i.test(e.color)) el.style.color = e.color;
      if(e.size) el.style.fontSize = (f0 * Math.min(Math.max(+e.size, 0.8), 1.3)).toFixed(1) + 'px';
      el.dataset.edited = '1';
    }
  }
  function spots(R){
    const list = [...document.querySelectorAll('.pg [data-e]')].map(el => {
      const cs = getComputedStyle(el);
      return {id: el.dataset.e, text: [...el.childNodes].map(n => n.nodeType === 3 ? n.textContent : n.tagName === 'BR' ? '\n' : n.textContent).join('').replace(/[ \t]+/g, ' ').trim(),
        font: cs.fontFamily.split(',')[0].replace(/['"]/g, ''), color: cs.color, size: parseFloat(cs.fontSize)};
    }).filter(s => s.text);
    window.socialSpots = () => ({spots: list, fonts: families(R)});
  }

  // ---------- fitting ----------
  const pgRect = () => document.querySelector('.pg').getBoundingClientRect();
  function rel(r){ const P = pgRect(); return {l: r.left - P.left, t: r.top - P.top, r: r.right - P.left, b: r.bottom - P.top, w: r.width, h: r.height}; }
  // the union of the text itself (element boxes run the full column width); own: only the element's own text
  function textRect(el, own){
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while((n = tw.nextNode())){
      if(!n.textContent.trim() || (own && n.parentElement !== el) || !n.parentElement.getClientRects().length) continue;
      const g = document.createRange(); g.selectNodeContents(n);
      for(const q of g.getClientRects()){ if(q.width < 1) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    }
    return l > r ? {l: 0, t: 0, r: 0, b: 0, w: 0, h: 0} : rel({left: l, top: t, right: r, bottom: b, width: r - l, height: b - t});
  }
  const box = a => ({l: a[0], t: a[1], r: a[0] + a[2], b: a[1] + a[3], w: a[2], h: a[3]});
  const hits = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  const visible = el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';

  function fit(){
    const v = A.sv, W = A.W, H = A.H, story = A.size === 'story';
    const blocks = [...document.querySelectorAll('.pg [data-slot]')];
    const others = () => [...document.querySelectorAll('.pg img.logo, .pg img.hs')].map(e => ({el: e, r: rel(e.getBoundingClientRect())}));
    // what each block already touched on the approved sample (line boxes run taller than letters; that is not a fault)
    const sampleObs = v.logos.map(q => box(q.r)).concat((v.shots || []).map(box));
    const near = (L, o, g) => L.some(q => q.l < o.r + g && o.l < q.r + g && q.t < o.b + g && o.t < q.b + g);
    // boxes, bands and photos stay where the design put them: a block may not grow onto one it wasn't on in the sample
    const shapes = [...document.querySelectorAll('.pg > div:not([data-slot])')].filter(e => {
      const cs = getComputedStyle(e), bg = cs.backgroundColor;
      return e.offsetWidth > 4 && e.offsetHeight > 4 && cs.transform === 'none' && cs.clipPath === 'none' && ((bg && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(bg)) || cs.backgroundImage !== 'none');
    }).map(e => rel(e.getBoundingClientRect()));
    const before = blocks.map((b, i) => {
      const s = box(v.blocks[i]);
      return {s, blocks: new Set(v.blocks.map((q, j) => j !== i && hits(s, box(q)) ? j : -1).filter(j => j >= 0)),
              obs: sampleObs.map(o => near([s], o, 4)), shapes: shapes.map(o => near([s], o, 4) || (o.l <= s.l && o.r >= s.r && o.t <= s.t && o.b >= s.b))};
    });
    // the same test the checks use: each line's ink (the middle 64% of its line box), against other blocks' lines
    const M = story ? 31 : 35, top = story ? 251 : 31, bot = story ? H - 251 : H - 31;   // posts: name and address stay in the middle 3:4
    const lines = (el, full) => {   // full: the whole line box (against boxes, logos and headshots: no touching)
      const out = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
      while((n = tw.nextNode())){
        if(!n.textContent.trim() || !n.parentElement.getClientRects().length) continue;
        const g = document.createRange(); g.selectNodeContents(n);
        for(const q of g.getClientRects()) if(q.width >= 2 && q.height >= 2){ const r = rel(q), k = full ? 0 : .18; out.push({l: r.l, r: r.r, t: r.t + r.h * k, b: r.b - r.h * k}); }
      }
      return out;
    };
    const fault = i => {
      const b = blocks[i]; if(!visible(b)) return false;
      const r = textRect(b), s = before[i].s;
      if(!b.dataset.touched && r.w <= s.w + 2 && r.h <= s.h + 2 && r.l >= s.l - 2 && r.t >= s.t - 2) return false;   // untouched and no bigger than the sample
      const L = lines(b);
      const lo = Math.min(M, s.l), hi = Math.max(W - M, s.r), t0 = Math.min(top, s.t), b0 = Math.max(bot, s.b);
      if(L.some(q => q.l < lo - .5 || q.r > hi + .5 || q.t < t0 - .5 || q.b > b0 + .5)) return true;
      if(r.h > s.h * 1.2 + 4 && !b.dataset.wrapped) return true;   // a paragraph keeps about its sample height
      for(let j = 0; j < blocks.length; j++){
        if(j === i || !visible(blocks[j])) continue;
        const M2 = lines(blocks[j]);
        if(L.some(p => M2.some(q => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b))) return true;
      }
      const F = lines(b, true);
      for(let k = 0; k < shapes.length; k++){ if(before[i].shapes[k]) continue; if(near(F, shapes[k], 4)) return true; }
      const os = others();
      for(let k = 0; k < os.length; k++){ if(before[i].obs[k]) continue; if(near(F, os[k].r, 4)) return true; }
      return false;
    };
    const leavesOf = b => [...b.querySelectorAll('[data-e]')].concat(b.matches('[data-e]') ? [b] : []).filter(e => !e.dataset.edited);
    const grown = (b, i) => leavesOf(b).filter(e => { const s = v.leaves[+e.dataset.e]; if(!s) return true; const r = textRect(e, true); return r.w > s[3] + 1 || r.h > s[4] + 1; });
    // a line that was one line on the sample (a name, an address) stays one line: it shrinks first, breaks last
    document.querySelectorAll('.pg [data-e]').forEach(e => {
      const q = v.leaves[+e.dataset.e]; if(!q || e.dataset.edited) return;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if(q[4] <= q[5] * 1.7 && textRect(e, true).h > fs * 1.7 && !e.querySelector('br')) e.style.whiteSpace = 'nowrap';
    });
    for(let pass = 0; pass < 3; pass++){
      let changed = false;
      blocks.forEach((b, i) => {
        if(!fault(i)) return;
        changed = true; b.dataset.touched = '1';
        let ls = grown(b, i); if(!ls.length) ls = leavesOf(b);
        const f0 = new Map(ls.map(e => [e, parseFloat(e.dataset.f0 || getComputedStyle(e).fontSize)]));
        ls.forEach(e => { e.dataset.f0 = f0.get(e); if(!e.dataset.lh0){ const lh = getComputedStyle(e).lineHeight; e.dataset.lh0 = /px$/.test(lh) ? parseFloat(lh) : 0; } });
        const floor = e => Math.min(f0.get(e), Math.max(f0.get(e) * 0.5, 20));
        const shrinkTo = k => { ls.forEach(e => {   // a set line height shrinks with the type
          const f = Math.max(floor(e), f0.get(e) * k), lh = +e.dataset.lh0;
          e.style.fontSize = f.toFixed(1) + 'px'; if(lh) e.style.lineHeight = (lh * f / f0.get(e)).toFixed(1) + 'px'; }); };
        let k = parseFloat(b.dataset.k || 1);
        // a feature list gives up its last lines first (at least two stay), so the type keeps the design's size
        let feats = [...b.querySelectorAll('[data-feat]')].filter(visible);
        while(fault(i) && feats.length > 2){
          const f = feats.pop(), br = f.previousElementSibling && f.previousElementSibling.tagName === 'BR' ? f.previousElementSibling : null;
          f.style.display = 'none'; if(br) br.style.display = 'none';
          A.notes.push({slot: 'justListed.features', note: 'a feature line left off to make room'});
        }
        while(fault(i) && k > 0.85){ k -= 0.02; shrinkTo(k); }
        const web = b.querySelector('[data-web]');
        if(fault(i) && web && web.style.display !== 'none'){   // the web line goes before the name gets small
          web.style.display = 'none';
          const t = web.previousSibling; if(t && t.nodeType === 3) t.textContent = t.textContent.replace(/[\s ]*[|·•][\s ]*$/, '');
          const host = web.closest('[data-e]'); if(host && !host.textContent.trim()) host.style.display = 'none';
          A.notes.push({slot: 'agent.web', note: 'website left off to make room'});
        }
        while(fault(i) && k > 0.5){ k -= 0.02; shrinkTo(k); }
        if(fault(i)){   // still too long: let a nowrap line break at a space, then fit again
          const nw = ls.filter(e => getComputedStyle(e).whiteSpace === 'nowrap' || getComputedStyle(e.parentElement).whiteSpace === 'nowrap');
          if(nw.length){
            const k1 = k, ws = nw.map(e => e.style.whiteSpace); nw.forEach(e => { e.style.whiteSpace = 'normal'; }); b.dataset.wrapped = '1'; k = 0.85; shrinkTo(k);
            while(fault(i) && k > 0.5){ k -= 0.02; shrinkTo(k); }
            if(fault(i)){ nw.forEach((e, n) => { e.style.whiteSpace = ws[n]; }); delete b.dataset.wrapped; k = k1; shrinkTo(k); }   // breaking didn't help: one line
          }
        }
        b.dataset.k = k;
        const txt = b.textContent.trim().slice(0, 40);
        if(k < 0.995) A.notes.push({slot: txt, note: `set at ${Math.round(k * 100)}% to fit`});
      });
      if(!changed) break;
    }
  }
  // a faded photo used as a texture (under 50% opacity) isn't showing the house: no whole-house test for it
  function decorative(){
    document.querySelectorAll('.pg [data-house]').forEach(e => { if(+getComputedStyle(e).opacity < .5) e.removeAttribute('data-house'); });
  }
  // a logo's artwork stays 34 px inside every edge (stories: out of the top and bottom 250 px)
  function edgeLogos(){
    const pg = document.querySelector('.pg'), P = pg.getBoundingClientRect(), story = A.size === 'story';
    for(const lg of pg.querySelectorAll('img.logo')){
      const r = A.logoArt(lg, P), m = 34, top = story ? 252 : m, bot = A.H - (story ? 252 : m);
      let dx = 0, dy = 0;
      if(r.l < m) dx = m - r.l; else if(r.r > A.W - m) dx = A.W - m - r.r;
      if(r.t < top) dy = top - r.t; else if(r.b > bot) dy = bot - r.b;
      if(dx) lg.style.left = (parseFloat(lg.style.left) + dx).toFixed(1) + 'px';
      if(dy) lg.style.top = (parseFloat(lg.style.top) + dy).toFixed(1) + 'px';
    }
  }
  // where the design centers the logo on the contact block, keep it there after the agent lines were fitted
  function centerLogo(){
    const v = A.sv; if(!v.logoWithContact || !v.agent.length) return;
    const lg = document.querySelector('.pg img.logo'); if(!lg) return;
    const rs = v.agent.map(i => document.querySelector(`.pg [data-slot="${i}"]`)).filter(Boolean).map(textRect);
    if(!rs.length) return;
    const c = (Math.min(...rs.map(r => r.t)) + Math.max(...rs.map(r => r.b))) / 2, r = rel(lg.getBoundingClientRect());
    const dy = c - (r.t + r.h / 2);
    if(Math.abs(dy) > 0.5) lg.style.top = (parseFloat(lg.style.top) + dy).toFixed(1) + 'px';
  }
})();
