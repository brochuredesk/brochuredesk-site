// Free preview on the homepage: the visitor's photos and facts, drawn in our design sets right in their browser.
// Nothing is uploaded or sent anywhere; photos are shrunk on the visitor's own computer.
// Copy isn't written before sign-in, so it shows as faint lines (copyPending), with sample agent branding.
(function(){
  const $ = s => document.querySelector(s);
  const MAX_PHOTOS = 16;
  const SAMPLE_AGENT = {name:'Avery Morgan', designation:'REALTOR®', nar:false, phone:'713.555.0123', phoneLabel:'Call / Text',
    email:'avery@yourbrokerage.com', web:'yourbrokerage.com', qrLabel:'Scan for details', headshot:null, qr:'/designs/qr.png'};
  const SAMPLE_BRAND = {brokerage:'Your Brokerage', accent:'#1f4e5f', paper:'#f3f0ea', ink:'#232323', muted:'#5a5a5a',
    phone:'713.555.0100', web:'yourbrokerage.com', officeLabel:'Office', logo:'/designs/sample-logo.svg'};

  const sec = $('#try'), form = $('#try-form'), grid = $('#try-photos'), out = $('#try-out');
  let photos = [], designs = [], design = null, logo = null, drawn = false, fonts = {}, fontKey = '';
  const IVORY_FOLD = $('#try-fold').innerHTML;

  // ---------- Matrix link: the automatic path ----------
  // Reading the link and the photos is shared with the team pages (designs/shared/engine.js).
  const E = window.BDEngine, MSG = E.MSG;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mxIn = $('#mx-link'), mxStatus = $('#mx-status'), mxErr = $('#mx-err'), mxGo = $('#mx-go');
  let designsReady = Promise.resolve(), busy = false;

  const say = t => { mxStatus.innerHTML = t ? '<i aria-hidden="true"></i><span></span>' : ''; if(t) mxStatus.lastChild.textContent = t; };
  const fail = code => {
    say(''); $('#mx-err-text').textContent = MSG[code] || MSG.network;
    mxErr.hidden = false; $('#mx-links').hidden = true;
    $('#mx-retry').hidden = !E.RETRY.includes(code);
    $('#mx-retry').focus({preventScroll:true});
  };
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
  // A link handed over in the address (?link=...) starts the preview right away.
  try {
    const handed = new URLSearchParams(location.search).get('link');
    if (handed && /^https:\/\/matrix\.harmls\.com\//i.test(handed)) {
      history.replaceState(null, '', location.pathname);
      openSection(); mxIn.value = handed; setTimeout(runMatrix, 0);
    }
  } catch (_) {}
  $('#mx-retry').onclick = runMatrix;
  $('#mx-manual').onclick = manual; $('#mx-err-manual').onclick = manual;

  const setField = (n, v) => { form.elements[n].value = v == null ? '' : v; };

  async function runMatrix(){
    if(busy) return;
    const link = mxIn.value.trim();
    mxErr.hidden = true;
    const bad = E.localCheck(link);
    if(bad){ fail(bad); return; }
    busy = true; mxGo.disabled = true; $('#mx-retry').disabled = true;
    try {
      const j = await E.readMatrix(link, say), urls = j.photos.map(p => p.url);
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
  const shrink = E.shrink;
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
    const copy = E.pendingCopy(L, ids);
    // a design may set its own sample brokerage and agent lines (sample: true lets sample branding pass the checks)
    const S = design.sample || {};
    const brand = Object.assign({}, SAMPLE_BRAND, S.brokerage ? {brokerage: S.brokerage, logo: S.logo, web: S.web} : {}, logo ? {logo} : {},
                                Object.keys(fonts).some(k => fonts[k]) ? {fonts} : {});
    const agent = Object.assign({}, SAMPLE_AGENT, S.qrLabel ? {qrLabel: S.qrLabel, web: S.agentWeb || SAMPLE_AGENT.web} : {});
    return {template: design.id, sample: true, brand, agent, listing: L,
            openHouse: null, mailVendor: null, photos: P, companion: {fineprint: E.FINE_PRINT}, copy, copyPending: true};
  }

  // ---------- drawing ----------
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
    const spec = await E.pieces(design.id);
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
      await E.drawSheet(s, design, p, data, fitNote);
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
