/* Master copy set -> any design (brief master-copy-design-switch-10-24, 10/25/2026). No model calls.
   At Finalize the writer saves one master set per listing (package-ai 'write', master-set prompt):
     headline, intro, feature, location        {title?, long, short}
     sections [{room, photos: [ids], title, question, body, caption: each {long, short}}]   (question: Q&A designs)
     summaryQuestion {long, short}; highlights [short lines] (checklists, "built in" lists); checklist {q, lead};
     callout {kind, q, big} (one standout fact the listing states, else empty); nearby [{place, dist, kind}] (listing only)
     flyer {heading, kicker, body: {long, short}}, postcard {eyebrow, notes: {long, short}, master: [sentences]}
     facts {beds, baths, halfBaths, sqft, yearBuilt, stories, garage, lotSize}   (every number is checked against these)
   MasterFit.fit(master, example, opts) fills a design's copy in the exact shape of its example copy. Each slot's budget is
   the length of that slot's example text (the design was drawn for it). The longest saved version within the budget
   wins; words are never cut and type never shrinks. A slot no version fits is listed in `refits` (one small writer call
   each, package-ai 'refit'); until then it carries the short version and the proof flags it.
   opts: ids (photo ids in the agent's arrangement, first = cover), extra (more listing photos, used before any repeat), roomOf(id), base (the design's draft: fixed fields
   like stats and location), slack (default 1.06). Works in the browser (window.MasterFit) and in Node (tests). */
(function(root){
  const KEEP = /^(location|stats|variant|footnote|planDisclosures|flyerPhotos|eyebrowFixed|fineprint|stat\d|noteCorner)$/;
  // the room a design's example photo name asks for ("front", "patio", "primary-vanity", "lawn"...)
  const HINTS = [[/front|cover|curb|street/, 'front exterior'], [/family|side|exterior|angle/, 'side exterior'], [/patio|deck|porch/, 'patio'],
    [/lawn|yard|garden/, 'backyard'], [/pool/, 'pool'], [/garage/, 'garage'], [/primary-(vanity|shower|bath)|office/, 'primary bath'],
    [/primary/, 'primary bedroom'], [/kitchen/, 'kitchen'], [/nook|breakfast/, 'breakfast area'], [/dining/, 'dining room'],
    [/living/, 'living room'], [/bedroom|study/, 'bedroom'], [/bath|shower|vanity/, 'bathroom'], [/hall|entry|foyer/, 'entry'],
    [/game|media/, 'game room'], [/laundry|utility/, 'laundry room']];
  const hintOf = name => { const m = HINTS.find(([rx]) => rx.test(String(name || '').toLowerCase())); return m ? m[1] : ''; };
  const near = {'front exterior': ['side exterior', 'back exterior'], 'side exterior': ['front exterior', 'back exterior'], patio: ['backyard', 'back exterior'],
    backyard: ['patio', 'back exterior'], 'primary bath': ['bathroom'], bathroom: ['primary bath'], 'primary bedroom': ['bedroom'], bedroom: ['primary bedroom', 'study'],
    'breakfast area': ['kitchen', 'dining room'], 'dining room': ['breakfast area', 'living room'], 'living room': ['family room'], entry: ['living room']};
  const at = (o, path) => path.reduce((v, k) => v == null ? v : v[k], o);
  const len = s => String(s || '').length;

  function fit(master, example, opts){
    opts = opts || {};
    const ids = opts.ids || [], slack = opts.slack || 1.06;
    const roomOf = opts.roomOf || (() => ''), base = opts.base || {};
    const heading = opts.heading || (r => r ? r.charAt(0).toUpperCase() + r.slice(1) : '');
    const refits = [], used = [], placed = new Set(), taken = new Set();
    // a photo spot gets a photo of the room it was drawn for (or the nearest kind), never one already placed until
    // every photo is used once; then it falls back to the agent's order
    // opts.extra: more listing photos (the picker's lower box) used before any photo repeats
    const all = ids.concat((opts.extra || []).filter(id => !ids.includes(id)));
    const photoFor = name => {
      const want = hintOf(name), free = all.filter(id => !taken.has(id));
      const pool = free.length ? free : ids;
      const pickBy = room => room && pool.find(id => roomOf(id) === room);
      const id = pickBy(want) || (near[want] || []).map(pickBy).find(Boolean) || pool[0];
      taken.add(id); return id;
    };
    let first = true;
    const sectionFor = (photo, room) => (master.sections || []).find(s => (s.photos || []).includes(photo))
      || (master.sections || []).find(s => s.room && s.room === room) || null;
    // the longest saved version that fits the slot's budget; none fits: listed for a refit, short version meanwhile
    function pick(v, budget, path, label, key){
      if(v == null) return '';
      if(typeof v === 'string') v = {long: v, short: v};
      const limit = Math.max(8, Math.round(budget * slack));
      // a line already placed in this design isn't used twice (two photos of one room): the other version, else a refit
      const ok = [v.long, v.short].filter(Boolean).filter(t => len(t) <= limit && !placed.has(t)).sort((a, b) => len(b) - len(a));
      if(ok.length){ used.push(path); if(len(ok[0]) > 16) placed.add(ok[0]); return ok[0]; }
      refits.push({path, budget, label, key, versions: [v.long, v.short].filter(Boolean)});
      const t = [v.short, v.long].find(x => x && !placed.has(x)) || '';
      if(len(t) > 16) placed.add(t);
      return t;
    }
    function walk(ex, path, group){
      const key = path[path.length - 1], b = at(base, path);
      // fixed fields come from the design's draft (the listing's own facts); a layout switch like 'variant' keeps the
      // example's value; nothing else of the example house ever shows
      if(typeof key === 'string' && KEEP.test(key)) return b !== undefined ? b : /^(variant|noteCorner)$/.test(key) ? ex : typeof ex === 'string' ? '' : Array.isArray(ex) ? [] : ex;
      if(Array.isArray(ex)){
        if(ex.every(x => typeof x === 'string') && /photos$/i.test(key)) return b !== undefined ? b : [];
        // short lists: the master highlights that fit the example's longest line, as many as the example has
        if(/^(items|builtIn|highlights|checks)$/.test(key)){
          const cap = Math.round(Math.max(...ex.map(len), 12) * slack);
          return (master.highlights || []).filter(t => len(t) <= cap).slice(0, ex.length);
        }
        if(key === 'nearby') return (master.nearby || []).filter(x => x && x.place).slice(0, ex.length)
          .map(x => ({dist: String(x.dist || ''), place: String(x.place), kind: String(x.kind || '')}));
        return ex.map((x, i) => walk(x, path.concat(i), group));
      }
      if(ex && typeof ex === 'object'){
        if('walls' in ex || ('rooms' in ex && 'w' in ex)) return b !== undefined ? b : null;   // a drawn plan comes from the plan data
        if(key === 'callout'){   // one standout fact; none stated by the listing: the design leaves the callout out
          const c = master.callout || {}, big = String(c.big || '');
          if(big && len(big) <= Math.round(len(ex.big) * slack)) return {kind: String(c.kind || ''), q: String(c.q || ''), big};
          // nothing special stated: a plain fact from the fact sheet (draft wording)
          const F = master.facts || {};
          if(F.yearBuilt) return {kind: 'year', q: 'When was it built?', big: String(F.yearBuilt)};
          if(F.sqft) return {kind: 'size', q: 'How big is it?', big: `${Number(F.sqft).toLocaleString('en-US')} sq ft`};
          return {kind: '', q: '', big: ''};
        }
        const o = {}, g = {rooms: [], key};
        if('photo' in ex){
          o.photo = first ? ids[0] : photoFor(ex.photo); if(first) taken.add(ids[0]); first = false;
          g.room = roomOf(o.photo); g.section = key === 'feature' ? null : sectionFor(o.photo, g.room);
          if(group) group.rooms.push(g.room);
        }
        if(key === 'feature' && master.feature) g.section = {title: master.feature.title, body: master.feature, caption: master.feature.title};
        for(const [k, x] of Object.entries(ex)) if(k !== 'photo') o[k] = walk(x, path.concat(k), g);
        // a section's kicker names the rooms placed in it (never the example house's own words)
        if(typeof o.kicker === 'string') o.kicker = g.rooms.length ? [...new Set(g.rooms.filter(Boolean).map(heading))].slice(0, 2).join(' + ') : (at(base, path.concat('kicker')) || '');
        return o;
      }
      if(typeof ex !== 'string') return ex;
      const budget = len(ex), p = path.join('.'), S = group && group.section, M = master;
      if(group && 'room' in group && !S && /^(title|q|name|label|caption|body|a|detail|notes)$/.test(key)){
        // a photo whose room the master set doesn't cover: written to this slot's length in the refit step
        refits.push({path: p, budget, label: key, key: group.room || 'room', versions: []}); return '';
      }
      if(S){
        if(key === 'q') return pick(S.question || S.title, budget, p, 'question', S.room);
        if(/^(title|name|label)$/.test(key)) return pick(S.title, budget, p, 'title', S.room);
        if(key === 'caption') return pick(S.caption, budget, p, 'caption', S.room);
        if(key === 'lead') return '';
        if(/^(body|a|detail|notes)$/.test(key)) return pick(S.body, budget, p, 'body', S.room);
      }
      const inFlyer = path.includes('listing') && path.includes('companion'), inCard = path.includes('postcard');
      if(inFlyer && key === 'heading') return pick(M.flyer && M.flyer.heading, budget, p, 'flyer heading', 'flyer');
      if(inFlyer && key === 'kicker') return pick(M.flyer && M.flyer.kicker, budget, p, 'flyer kicker', 'flyer');
      if(inFlyer && key === 'body') return pick(M.flyer && M.flyer.body, budget, p, 'flyer body', 'flyer');
      if(inCard && key === 'eyebrow') return pick(M.postcard && M.postcard.eyebrow, budget, p, 'postcard eyebrow', 'postcard');
      if(inCard && key === 'notes') return pick(M.postcard && M.postcard.notes, budget, p, 'postcard notes', 'postcard');
      if(key === 'kicker') return b || '';
      if(group && group.key === 'checklist' && key === 'q') return pick(master.checklist && master.checklist.q, budget, p, 'checklist question', 'checklist');
      if(group && group.key === 'checklist' && key === 'lead') return pick(master.checklist && master.checklist.lead, budget, p, 'checklist lead', 'checklist');
      if(key === 'q') return pick(M.summaryQuestion || M.headline, budget, p, 'question', 'summary');
      if(/^(title|heading)$/.test(key)) return pick(M.headline, budget, p, 'headline', 'headline');
      if(/^(intro|summary|a)$/.test(key)) return pick(M.intro, budget, p, 'intro', 'intro');
      if(key === 'locationTitle') return (M.location && M.location.title) || 'Location';
      if(key === 'locationBody') return pick(M.location, budget, p, 'location', 'location');
      if(b !== undefined) return b;
      return '';
    }
    const copy = walk(example.copy || {}, ['copy']), companion = walk(example.companion || {}, ['companion']);
    return {copy, companion, refits, fitted: used.length};
  }
  // put a refit's text in place (path as fit() reported it: "copy.insideTop.features.0.body")
  function place(out, path, text){
    const parts = path.split('.'); let o = out;
    for(let i = 0; i < parts.length - 1; i++){ if(o == null) return; o = o[parts[i]]; }
    if(o && typeof o[parts[parts.length - 1]] === 'string') o[parts[parts.length - 1]] = text;
  }
  // how many photo spots a design's example copy has (a switch adds listing photos when the package has fewer)
  function photoSpots(example){
    let n = 0;
    (function walk(v){ if(Array.isArray(v)) v.forEach(walk); else if(v && typeof v === 'object'){ if(typeof v.photo === 'string') n++; Object.values(v).forEach(walk); } })(example && example.copy);
    return n;
  }
  const api = {fit, place, photoSpots};
  if(typeof module === 'object' && module.exports) module.exports = api; else root.MasterFit = api;
})(typeof window !== 'undefined' ? window : globalThis);
