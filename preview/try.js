// Free preview on the homepage: the visitor's photos and facts, drawn in our design sets right in their browser.
// Nothing is uploaded or sent anywhere; photos are shrunk on the visitor's own computer.
// Copy isn't written before sign-in, so it shows as faint lines (copyPending), with sample agent branding.
(function(){
  const $ = s => document.querySelector(s);
  const MAX_PHOTOS = 16, PHOTO_W = 900;
  const FINE_PRINT = 'Information deemed reliable but not guaranteed.';
  const SAMPLE_AGENT = {name:'Avery Morgan', designation:'REALTOR®', nar:false, phone:'713.555.0123', phoneLabel:'Call / Text',
    email:'avery@yourbrokerage.com', web:'yourbrokerage.com', qrLabel:'Scan for details', headshot:null, qr:'/designs/qr.png'};
  const SAMPLE_BRAND = {brokerage:'Your Brokerage', accent:'#1f4e5f', paper:'#f3f0ea', ink:'#232323', muted:'#5a5a5a',
    phone:'713.555.0100', web:'yourbrokerage.com', officeLabel:'Office', logo:'/designs/sample-logo.svg'};

  const sec = $('#try'), form = $('#try-form'), grid = $('#try-photos'), out = $('#try-out');
  let photos = [], designs = [], design = null, logo = null, tplCache = {}, drawn = false, fonts = {}, fontKey = '';
  const IVORY_FOLD = $('#try-fold').innerHTML;

  // ---------- Matrix link: the automatic path ----------
  // A small server reader (Supabase Edge Function) fetches the one Matrix page and the listing photos for us, because
  // browsers can't read Matrix pages directly. It only ever talks to HAR's Matrix servers, never har.com.
  const FN = 'https://depwvwewbmxspoxidxrx.supabase.co/functions/v1/matrix-listing';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mxIn = $('#mx-link'), mxStatus = $('#mx-status'), mxErr = $('#mx-err'), mxGo = $('#mx-go');
  let designsReady = Promise.resolve(), busy = false;

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
  const say = t => { mxStatus.innerHTML = t ? '<i aria-hidden="true"></i><span></span>' : ''; if(t) mxStatus.lastChild.textContent = t; };
  const fail = code => {
    say(''); $('#mx-err-text').textContent = MSG[code] || MSG.network;
    mxErr.hidden = false; $('#mx-links').hidden = true;
    $('#mx-retry').hidden = !['blocked','unreachable','network','slow-down','not-found'].includes(code);
    $('#mx-retry').focus({preventScroll:true});
  };
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
  function openSection(){
    sec.hidden = false;
    sec.scrollIntoView({behavior: reduce() ? 'auto' : 'smooth'});
  }
  function showForm(){ form.hidden = false; $('#mx-links').hidden = false; }
  function manual(){ openSection(); mxErr.hidden = true; say(''); showForm(); setTimeout(() => $('#try-drop').focus({preventScroll:true}), 300); }

  document.querySelectorAll('[data-start]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const link = f.querySelector('input').value.trim();
    openSection();
    if(link){ mxIn.value = link; runMatrix(); } else setTimeout(() => mxIn.focus({preventScroll:true}), 400);
  }));
  $('#mx-form').addEventListener('submit', e => { e.preventDefault(); runMatrix(); });
  $('#mx-retry').onclick = runMatrix;
  $('#mx-manual').onclick = manual; $('#mx-err-manual').onclick = manual;

  const setField = (n, v) => { form.elements[n].value = v == null ? '' : v; };
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
  async function getPhoto(url){
    const r = await fetch(`${FN}?photo=${encodeURIComponent(url)}`);
    if(!r.ok) throw new Error('photo');
    const blob = await r.blob(), bmp = await createImageBitmap(blob);
    if(isCollage(bmp)) return null;
    return shrink(blob);
  }

  async function runMatrix(){
    if(busy) return;
    const link = mxIn.value.trim();
    mxErr.hidden = true;
    const bad = localCheck(link);
    if(bad){ fail(bad); return; }
    busy = true; mxGo.disabled = true; $('#mx-retry').disabled = true;
    try {
      say('Reading your listing…');
      let j;
      try {
        const r = await fetch(`${FN}?link=${encodeURIComponent(link)}`);
        j = await r.json();
      } catch(e) { throw {code: 'network'}; }
      if(!j.ok) throw {code: j.error};
      const want = Math.min(MAX_PHOTOS, j.photos.length);
      say(`Found ${j.totalPhotos} photo${j.totalPhotos === 1 ? '' : 's'}, picking the best ${want}…`);
      // the best 16, plus a few spares to stand in if one turns out to be a collage; they go back in listing order
      const cand = j.photos.concat(j.spares || []), got = []; let next = 0, done = 0;
      const worker = async () => {
        while(next < cand.length && got.filter(Boolean).length < MAX_PHOTOS){
          const i = next++;
          try { const u = await getPhoto(cand[i].url); got[i] = u && {n: cand[i].n, u}; } catch(e) { got[i] = null; }
          done++; if(done <= want) say(`Getting photo ${Math.min(done, want)} of ${want}…`);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      const keep = got.filter(Boolean).slice(0, MAX_PHOTOS).sort((a, b) => a.n - b.n), urls = keep.map(k => k.u);
      if(!urls.length) throw {code: 'unreadable'};
      photos.forEach(u => URL.revokeObjectURL(u)); photos = urls;
      const l = j.listing;
      ['address','city','zip','neighborhood'].forEach(n => setField(n, l[n === 'zip' ? 'zip' : n]));
      setField('beds', l.beds); setField('baths', l.baths); setField('half', l.halfBaths); setField('sqft', l.sqft); setField('year', l.year);
      say('Laying out your brochure…');
      showPhotos(); showForm();
      await designsReady; await draw();
      say(`Done. ${urls.length} photo${urls.length === 1 ? '' : 's'} from your listing. Change anything below and press Show my preview.` + (j.listingCount > 1 ? ' That link had more than one listing, so we used the first.' : ''));
      out.scrollIntoView({behavior: reduce() ? 'auto' : 'smooth'});
    } catch(e) { fail(e && e.code); }
    finally { busy = false; mxGo.disabled = false; $('#mx-retry').disabled = false; }
  }

  // ---------- photos ----------
  async function shrink(file){
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, PHOTO_W / bmp.width), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .84));
    return URL.createObjectURL(blob);
  }
  async function addFiles(list){
    const files = [...list].filter(f => /^image\//.test(f.type));
    const room = MAX_PHOTOS - photos.length;
    $('#try-photo-note').textContent = files.length > room ? `The set uses up to ${MAX_PHOTOS} photos, so we kept the first ${MAX_PHOTOS}.` : '';
    for(const f of files.slice(0, Math.max(0, room))){
      try { photos.push(await shrink(f)); } catch(e) { $('#try-photo-note').textContent = `We couldn't open ${f.name}. Try a JPG or PNG.`; }
    }
    showPhotos();
  }
  function showPhotos(){
    grid.innerHTML = photos.map((u, i) => `<figure class="thumb"><img src="${u}" alt="Photo ${i+1}">${i === 0 ? '<span class="cover">Cover</span>' : `<button type="button" data-cover="${i}">Make cover</button>`}<button type="button" class="x" data-x="${i}" aria-label="Remove photo ${i+1}">×</button></figure>`).join('');
    $('#try-count').textContent = photos.length ? `${photos.length} of ${MAX_PHOTOS}` : '';
    if(drawn) draw();
  }
  grid.addEventListener('click', e => {
    const x = e.target.dataset.x, c = e.target.dataset.cover;
    if(x !== undefined){ URL.revokeObjectURL(photos[x]); photos.splice(+x, 1); showPhotos(); }
    if(c !== undefined){ photos.unshift(photos.splice(+c, 1)[0]); showPhotos(); }
  });
  dropzone($('#try-drop'), $('#try-files'), addFiles);

  // ---------- logo ----------
  dropzone($('#try-logo-drop'), $('#try-logo-file'), list => {
    const f = list[0]; if(!f || !/^image\//.test(f.type)) return;
    const r = new FileReader();
    r.onload = () => { logo = r.result; $('#try-logo-thumb').src = logo; $('#try-logo-drop').hidden = true; $('#try-logo-ok').hidden = false; draw(); };
    r.readAsDataURL(f);
  });
  $('#try-logo-remove').onclick = () => { logo = null; $('#try-logo-file').value = ''; $('#try-logo-drop').hidden = false; $('#try-logo-ok').hidden = true; draw(); };

  function dropzone(zone, input, onFiles){
    input.addEventListener('change', () => onFiles(input.files));
    zone.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); input.click(); } });
    ['dragenter','dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave','drop'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', e => onFiles(e.dataTransfer.files));
  }

  // ---------- designs ----------
  designsReady = fetch('/designs/designs.json').then(r => r.json()).then(list => {
    designs = list; design = list[0];
    $('#try-designs').innerHTML = list.map((d, i) => `<label class="dcard"><input type="radio" name="design" value="${d.id}"${i ? '' : ' checked'}><img src="${d.thumb}" alt="" width="900" height="1165" loading="lazy"><span>${d.name}</span></label>`).join('');
    $('#try-designs').addEventListener('change', e => { design = designs.find(d => d.id === e.target.value); fonts = {}; if(drawn) draw(); });
  });

  // ---------- facts -> data for the templates ----------
  const num = v => { const n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; };
  function buildData(){
    const v = id => form.elements[id].value.trim();
    const year = num(v('year'));
    const L = {address: v('address'), neighborhood: v('neighborhood'), city: v('city'), state: 'Texas', zip: v('zip'),
               beds: num(v('beds')), baths: num(v('baths')), halfBaths: num(v('half')), sqft: num(v('sqft')), yearBuilt: year};
    const ids = photos.map((_, i) => 'p' + String(i).padStart(2, '0'));
    const P = {}; ids.forEach((id, i) => P[id] = {src: photos[i], tags: ''});
    const rest = ids.length > 1 ? ids.slice(1) : ids; let n = 0;
    const slot = () => rest[n++ % rest.length];
    const stats = [];
    if(L.beds) stats.push(`${L.beds} Bedroom${L.beds !== 1 ? 's' : ''}`);
    if(L.baths) stats.push(`${L.baths} Full` + (L.halfBaths ? ` + ${L.halfBaths} Half` : '') + ' Baths');
    if(L.sqft) stats.push(`${L.sqft.toLocaleString('en-US')} Sq Ft`);
    if(year) stats.push(`Built in ${year}`);
    const place = [L.neighborhood, [L.city, L.state].filter(Boolean).join(', ')].filter(Boolean).join(' / ');
    const feat = () => ({photo: slot(), caption: '', title: '', body: ''}), tile = () => ({photo: slot(), title: '', body: ''});
    const copy = {
      front: {photo: ids[0], location: place},
      insideTop: {kicker: '', title: '', stats: stats.slice(0, 4), intro: '', features: [feat(), feat()], tiles: [tile(), tile(), tile(), tile()]},
      insideBottom: {kicker: '', title: '', features: [feat(), feat(), feat()], tiles: [tile(), tile(), tile()]},
      back: {kicker: '', title: '', variant: 'photos', plans: [{photo: slot(), label: ''}, {photo: slot(), label: ''}], planDisclosures: [],
             feature: {photo: ids[ids.length - 1], title: '', body: ''}, locationTitle: '', locationBody: '', footnote: FINE_PRINT}};
    // a design may set its own sample brokerage and agent lines (sample: true lets sample branding pass the checks)
    const S = design.sample || {};
    const brand = Object.assign({}, SAMPLE_BRAND, S.brokerage ? {brokerage: S.brokerage, logo: S.logo, web: S.web} : {}, logo ? {logo} : {},
                                Object.keys(fonts).some(k => fonts[k]) ? {fonts} : {});
    const agent = Object.assign({}, SAMPLE_AGENT, S.qrLabel ? {qrLabel: S.qrLabel, web: S.agentWeb || SAMPLE_AGENT.web} : {});
    return {template: design.id, sample: true, brand, agent, listing: L,
            openHouse: null, mailVendor: null, photos: P, companion: {fineprint: FINE_PRINT}, copy, copyPending: true};
  }

  // ---------- drawing ----------
  async function tpl(file){
    const key = design.id + '/' + file;
    if(!tplCache[key]) tplCache[key] = fetch(`/designs/${key}`).then(r => r.text());
    return tplCache[key];
  }
  const SLOT = '<script id="brochure-data" type="application/json">{}</' + 'script>';
  function srcdoc(html, data, panel){
    const hide = panel ? `.page:not([data-page="${panel}"]){display:none!important}` : '';
    const base = `/designs/${design.id}/`;
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
  const ro = new ResizeObserver(es => es.forEach(e => fit(e.target)));

  // fold-over panels come from the design (four landscape panels for Ivory, four upright ones for others)
  function foldPanels(p){
    const grid = $('#try-fold');
    const html = p && p.panels ? p.panels.map(x => `<figure><div class="sheet" data-piece="foldover" data-panel="${x.id}" data-label="Fold-over, ${x.label.toLowerCase()}"></div><figcaption>${x.label}</figcaption></figure>`).join('') : IVORY_FOLD;
    if(grid.dataset.for !== design.id){ grid.innerHTML = html; grid.dataset.for = design.id; grid.classList.toggle('portrait', !!(p && p.panels)); }
  }

  // font picker, for designs that have an approved font list
  async function fontBox(){
    const box = $('#try-fonts-box');
    box.hidden = !design.fonts || !window.FontPicker;
    if(box.hidden || fontKey === design.id) return;
    fontKey = design.id;
    const [spec, catalog] = await Promise.all([fetch(`/designs/${design.id}/fonts.json`).then(r => r.json()), fetch('/fonts/pool/catalog.json').then(r => r.json())]);
    FontPicker.mount($('#try-fonts'), {spec, catalog, fontBase: '/fonts/pool/', value: fonts, onChange: v => { fonts = v; draw(); }});
  }

  // after a font change, re-run the fit check in the pieces: anything too long would go back to the writer
  function fitNote(){
    const fit = $('#try-fit'); if(!fit) return;
    const frames = [...out.querySelectorAll('iframe')];
    let long = 0;
    for(const f of frames){ try { const w = f.contentWindow; if(w.brochureCheck) long += w.brochureCheck().filter(c => c.kind === 'overflow').length; } catch(e) {} }
    const changed = Object.values(fonts).some(Boolean);
    fit.textContent = !changed ? 'These are the design\'s original fonts.' : long ? 'With these fonts some lines run long. Before your proof, our writer shortens them so everything fits.' : 'Everything still fits with these fonts.';
  }

  async function draw(){
    if(!design || !photos.length) return;
    const data = buildData();
    const spec = await fetch(`/designs/${design.id}/pieces.json`).then(r => r.json());
    const by = Object.fromEntries(spec.pieces.map(p => [p.id, p]));
    out.hidden = false;   // templates measure their text as they lay out, so they must draw while visible
    foldPanels(by.foldover);
    fontBox();
    out.querySelectorAll('.tryset').forEach(t => { t.hidden = false; const n = t.querySelector('.soon'); if(n) n.remove(); });
    out.querySelectorAll('figure').forEach(f => f.hidden = false);
    const sheets = out.querySelectorAll('.sheet');
    let pending = [];
    for(const s of sheets){
      const p = by[s.dataset.piece];
      if(!p){ s.closest('figure').hidden = true;
        const set = s.closest('.tryset');
        if(![...set.querySelectorAll('figure')].some(f => !f.hidden) && !set.querySelector('.soon')){ set.insertAdjacentHTML('beforeend', '<p class="soon">The rest of this design\'s set is on the way.</p>'); set.querySelector('.two,.three').hidden = true; }
        continue; }
      const grid = s.closest('.two,.three'); if(grid) grid.hidden = false;
      const html = await tpl(p.file);
      const d = p.kind === 'foldover' ? Object.assign({}, data, {mode: 'proof'}) : Object.assign({}, data, {mode: 'email', piece: p});
      let fr = s.querySelector('iframe');
      if(!fr){ fr = document.createElement('iframe'); fr.title = s.dataset.label; fr.setAttribute('scrolling', 'no'); fr.tabIndex = -1;
        fr.addEventListener('load', () => { const doc = fr.contentDocument, w = fr.contentWindow;
          Promise.resolve(w.brochureReady).then(() => doc.fonts ? doc.fonts.ready : 0).then(() => { fit(s); fitNote(); }); fit(s); });
        s.appendChild(fr); ro.observe(s); }
      fr.srcdoc = srcdoc(html, d, s.dataset.panel);
    }
    $('#try-title').textContent = `${data.listing.address} in ${design.name}`;
    drawn = true;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const note = $('#try-note');
    if(!photos.length){ note.textContent = 'Add at least one photo. The first one goes on the cover.'; $('#try-drop').focus(); return; }
    if(!form.elements.address.value.trim()){ note.textContent = 'Add the street address.'; form.elements.address.focus(); return; }
    note.textContent = '';
    await draw();
    out.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  });

  $('#try-go').onclick = () => { $('#try-go-note').textContent = "Sign-up opens soon. When it does, you'll pick up right here."; };
})();
