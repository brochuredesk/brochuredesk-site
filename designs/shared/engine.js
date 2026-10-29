/* BrochureDesk set engine, shared by the public preview and the team pages.
   Reads a Matrix listing link through our small server reader and draws a design set from the real templates
   in the visitor's browser. Nothing here knows about any team; brand and agent come in as data.

     BDEngine.localCheck(link)                       -> '' or an error code (checked before anything is sent)
     BDEngine.readMatrix(link, say)                  -> {listing, photos:[{n, src, url}], totalPhotos, listingCount}; throws {code}
     BDEngine.loadPhoto(src)                         -> blob URL (through the reader), or null for a collage
     BDEngine.shrink(fileOrBlob)                     -> blob URL, at most 900 px wide
     BDEngine.pendingCopy(listing, ids)              -> copy with faint lines where the writer's text goes
     BDEngine.drawSheets(root, design, data)         -> draws every .sheet[data-piece] inside root
*/
(function(){
  const FN = 'https://depwvwewbmxspoxidxrx.supabase.co/functions/v1/matrix-listing';
  const MAX_PHOTOS = 16, PHOTO_W = 900;
  const FINE_PRINT = 'Information deemed reliable but not guaranteed.';

  const MSG = {
    har: "That's a har.com link. HAR's site blocks automatic reading, and we don't work around that, so we need the Matrix link instead. It takes about a minute.",
    'other-site': "We can only read Matrix links right now, not Zillow or Realtor.com. Your Matrix link is quick to make, and you can also add photos yourself.",
    'not-matrix': "That doesn't look like a Matrix listing link. It should start with https://matrix.harmls.com/. Paste the link from the Matrix email, or see how to make one.",
    'not-a-link': "That doesn't look like a link yet. Paste the whole Matrix link, starting with https://.",
    blocked: "HAR's site asked us to prove we're a person, and we won't try to get past that. Give it a few minutes and try again, or add your photos instead.",
    unreadable: "We opened the link but couldn't find the listing on it. Check that it's a link to one listing, or add your photos instead.",
    'not-found': "That link didn't open a listing. It may have expired. Make a fresh one, or add your photos instead.",
    unreachable: "We couldn't reach Matrix just now. Try again in a moment, or add your photos instead.",
    'slow-down': "That's a lot of tries in a row. Wait a few minutes and try again, or add your photos instead.",
    network: "Something went wrong on our end while reading the link. Try again, or add your photos instead."
  };
  const RETRY = ['blocked','unreachable','network','slow-down','not-found'];

  // checked in the browser first, so a har.com link is never sent anywhere
  function localCheck(v){
    let u; try { u = new URL(v); } catch(e) { return 'not-a-link'; }
    if(!/^https?:$/.test(u.protocol)) return 'not-a-link';
    const h = u.hostname.toLowerCase();
    if(h === 'har.com' || h.endsWith('.har.com')) return 'har';
    if(/(^|\.)(zillow|realtor|redfin|trulia|homes|movoto)\.com$/.test(h)) return 'other-site';
    if(h !== 'matrix.harmls.com') return 'not-matrix';
    return '';
  }

  // A listing collage (one big photo plus small ones, thin light gutters) is kept out of the photo slots.
  function isCollage(bmp){
    const k = Math.min(1, 300 / Math.max(bmp.width, bmp.height)), w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(bmp.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', {willReadFrequently: true}); g.drawImage(bmp, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, L = (x, y) => { const i = (y * w + x) * 4; return .299 * d[i] + .587 * d[i+1] + .114 * d[i+2]; };
    const stat = vals => { const m = vals.reduce((a, b) => a + b, 0) / vals.length; return [m, Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length)]; };
    const gut = (n, at, lo, hi) => {
      const S = []; for(let i = 0; i < n; i++){ const v = []; for(let j = lo; j < hi; j++) v.push(at(i, j)); S.push(stat(v)); }
      const out = []; for(let i = Math.max(3, Math.floor(n * .08)); i < Math.min(n - 3, Math.floor(n * .92)); i++)
        if(S[i][0] > 195 && S[i][1] < 14 && [i - 3, i + 3].every(k => S[k][1] > 15 || S[i][0] - S[k][0] > 20)) out.push(i);
      return out;
    };
    const col = (i, j) => L(i, j), row = (i, j) => L(j, i);
    for(const x of gut(w, col, 0, h)) if(gut(h, row, x + 2, w).length || gut(h, row, 0, Math.max(0, x - 1)).length) return true;
    for(const y of gut(h, row, 0, w)) if(gut(w, col, y + 2, h).length || gut(w, col, 0, Math.max(0, y - 1)).length) return true;
    return false;
  }

  async function shrink(file){
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, PHOTO_W / bmp.width), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .84));
    return URL.createObjectURL(blob);
  }

  async function loadPhoto(src){
    const r = await fetch(`${FN}?photo=${encodeURIComponent(src)}&size=preview`);   // the reader's saved ~1024 px copy, never the full-size original
    if(!r.ok) throw new Error('photo');
    const blob = await r.blob(), bmp = await createImageBitmap(blob);
    if(isCollage(bmp)) return null;
    return shrink(blob);
  }

  // The small server reader (Supabase Edge Function) fetches the one Matrix page and the listing photos for us,
  // because browsers can't read Matrix pages directly. It only ever talks to HAR's Matrix servers, never har.com.
  async function readMatrix(link, say){
    say = say || (() => {});
    const bad = localCheck(link);
    if(bad) throw {code: bad};
    say('Reading your listing…');
    let j;
    try { const r = await fetch(`${FN}?link=${encodeURIComponent(link)}`); j = await r.json(); }
    catch(e) { throw {code: 'network'}; }
    if(!j.ok) throw {code: j.error};
    const want = Math.min(MAX_PHOTOS, j.photos.length);
    say(`Found ${j.totalPhotos} photo${j.totalPhotos === 1 ? '' : 's'}, picking the best ${want}…`);
    // the best 16, plus a few spares to stand in if one turns out to be a collage; they go back in listing order
    const cand = j.photos.concat(j.spares || []), got = []; let next = 0, done = 0;
    const worker = async () => {
      while(next < cand.length && got.filter(Boolean).length < MAX_PHOTOS){
        const i = next++;
        try { const u = await loadPhoto(cand[i].url); got[i] = u && {n: cand[i].n, src: cand[i].url, url: u}; } catch(e) { got[i] = null; }
        done++; if(done <= want) say(`Getting photo ${Math.min(done, want)} of ${want}…`);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    const photos = got.filter(Boolean).slice(0, MAX_PHOTOS).sort((a, b) => a.n - b.n);
    if(!photos.length) throw {code: 'unreadable'};
    return {listing: j.listing || {}, photos, totalPhotos: j.totalPhotos, listingCount: j.listingCount || 1};
  }

  // Copy isn't written yet, so the writer's slots show as faint lines; facts, photos and the contact card are real.
  function pendingCopy(L, ids){
    const rest = ids.length > 1 ? ids.slice(1) : ids; let n = 0;
    const slot = () => rest[n++ % rest.length];
    const stats = [];
    if(L.beds) stats.push(`${L.beds} Bedroom${L.beds !== 1 ? 's' : ''}`);
    if(L.baths) stats.push(`${L.baths} Full` + (L.halfBaths ? ` + ${L.halfBaths} Half` : '') + ' Baths');
    if(L.sqft) stats.push(`${Number(L.sqft).toLocaleString('en-US')} Sq Ft`);
    if(L.yearBuilt) stats.push(`Built in ${L.yearBuilt}`);
    const place = [L.neighborhood, [L.city, L.state].filter(Boolean).join(', ')].filter(Boolean).join(' / ');
    const feat = () => ({photo: slot(), caption: '', title: '', body: ''}), tile = () => ({photo: slot(), title: '', body: ''});
    return {
      front: {photo: ids[0], location: place},
      insideTop: {kicker: '', title: '', stats: stats.slice(0, 4), intro: '', features: [feat(), feat()], tiles: [tile(), tile(), tile(), tile()]},
      insideBottom: {kicker: '', title: '', features: [feat(), feat(), feat()], tiles: [tile(), tile(), tile()]},
      back: {kicker: '', title: '', variant: 'photos', plans: [{photo: slot(), label: ''}, {photo: slot(), label: ''}], planDisclosures: [],
             feature: {photo: ids[ids.length - 1], title: '', body: ''}, locationTitle: '', locationBody: '', footnote: FINE_PRINT}};
  }

  // ---------- drawing ----------
  const tplCache = {}, specCache = {};
  function tpl(designId, file){
    const key = designId + '/' + file;
    if(!tplCache[key]) tplCache[key] = fetch(`/designs/${key}`).then(r => r.text());
    return tplCache[key];
  }
  function pieces(designId){
    if(!specCache[designId]) specCache[designId] = fetch(`/designs/${designId}/pieces.json`).then(r => r.json());
    return specCache[designId];
  }
  const SLOT = '<script id="brochure-data" type="application/json">{}</' + 'script>';
  function srcdoc(designId, html, data, panel){
    const hide = panel ? `.page:not([data-page="${panel}"]){display:none!important}` : '';
    const base = `/designs/${designId}/`;
    return html.replace('<head>', `<head><base href="${base}">`)
      .replace(/(href|src)="(?!https?:|\/|data:|blob:|#)([^"]+\.(?:css|js))"/g, `$1="${base}$2"`)
      .replace(SLOT, SLOT.replace('{}', JSON.stringify(data).replace(/<\//g, '<\\/')))
      .replace('</head>', `<style>html{-webkit-text-size-adjust:100%;text-size-adjust:100%}html,body{background:transparent!important;margin:0!important;overflow:hidden}.page{margin:0!important;box-shadow:none!important}${hide}</style></head>`);
  }
  function fit(sheet){
    const fr = sheet.querySelector('iframe'), doc = fr && fr.contentDocument;
    const pg = doc && doc.querySelector(sheet.dataset.panel ? `.page[data-page="${sheet.dataset.panel}"]` : '.page');
    if(!pg || !pg.offsetWidth) return;
    const w = pg.offsetWidth, h = pg.offsetHeight, k = sheet.clientWidth / w;
    fr.style.width = w + 'px'; fr.style.height = h + 'px'; fr.style.transform = `scale(${k})`;
    sheet.style.height = (h * k) + 'px';
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(es => es.forEach(e => fit(e.target))) : null;

  // Draws one sheet. onFit runs after the piece has laid out in its real fonts.
  async function drawSheet(sheet, design, piece, data, onFit){
    const html = await tpl(design.id, piece.file);
    const d = piece.kind === 'foldover' ? Object.assign({}, data, {mode: 'proof'}) : Object.assign({}, data, {mode: 'email', piece});
    let fr = sheet.querySelector('iframe');
    if(!fr){
      fr = document.createElement('iframe'); fr.title = sheet.dataset.label || piece.label; fr.setAttribute('scrolling', 'no'); fr.tabIndex = -1;
      fr.addEventListener('load', () => { const doc = fr.contentDocument, w = fr.contentWindow;
        Promise.resolve(w.brochureReady).then(() => doc.fonts ? doc.fonts.ready : 0).then(() => { fit(sheet); sheet._onFit && sheet._onFit(); }); fit(sheet); });
      sheet.appendChild(fr); ro && ro.observe(sheet);
    }
    sheet._onFit = onFit;
    fr.srcdoc = srcdoc(design.id, html, d, sheet.dataset.panel);
  }

  // Draws every .sheet[data-piece] inside root; a piece the design doesn't have hides its figure.
  async function drawSheets(root, design, data, onFit){
    const spec = await pieces(design.id);
    const by = Object.fromEntries(spec.pieces.map(p => [p.id, p]));
    for(const s of root.querySelectorAll('.sheet[data-piece]')){
      const p = by[s.dataset.piece], fig = s.closest('figure');
      if(fig) fig.hidden = !p;
      if(p) await drawSheet(s, design, p, data, onFit);
    }
    return spec;
  }

  window.BDEngine = {FN, MSG, RETRY, MAX_PHOTOS, FINE_PRINT, localCheck, isCollage, shrink, loadPhoto, readMatrix, pendingCopy,
                     tpl, pieces, srcdoc, fit, drawSheet, drawSheets};
})();
