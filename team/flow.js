/* Team pages after sign-in: everything under /<team address>/... draws inside the team's shell (header, colors, fonts),
   which 404.html sets from the team's own record. Nothing about any team lives in this file.

     TeamFlow.mount(ctx, route)   ctx = {sb, code, team, me, profile, main, nav(path)}; route = path parts after the address

   Routes: new, package/<id>, orders, receipts, printer, help. Anything else shows the not-found page in the team's look.
   A team agent is never asked for a logo or brand colors: those come from the team's brand kit. */
(function(){
  const E = window.BDEngine;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => { const n = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; };
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DAYS_VISIBLE = 60;    // past orders stay on the list (and downloadable) for 60 days

  // The five copy styles (docs/context/voice.md). Labels describe the feel, never a type of buyer.
  const STYLES = [
    {id: 'luxury', name: 'Luxury', note: 'Materials, craftsmanship and design details, in short, confident sentences.'},
    {id: 'modern', name: 'Modern & Urban', note: 'The commute, what\'s walkable, nearby dining and coffee, the home office, low upkeep.'},
    {id: 'spread', name: 'Room to Spread Out', note: 'The yard, flex rooms, storage and the kitchen as the hub of the house.'},
    {id: 'easy', name: 'Easy Living', note: 'One story or the primary bedroom down, low upkeep, a quiet street.'},
    {id: 'classic', name: 'Classic', note: 'Clean, polished and fact-forward. A safe choice for any house.'}
  ];
  // A first guess from the facts we have (no price on any piece, so price isn't used); one click changes it.
  function suggestStyle(L){
    if((L.sqft || 0) >= 4000) return 'luxury';
    if(L.stories === 1 || (!L.stories && (L.sqft || 0) && L.sqft < 1800 && (L.beds || 0) <= 3)) return 'easy';
    if((L.stories || 0) >= 3 && (L.sqft || 0) < 2600) return 'modern';
    if((L.beds || 0) >= 4) return 'spread';
    return 'classic';
  }
  const styleName = id => (STYLES.find(s => s.id === id) || {}).name || '';

  // ---------- the team's brand kit ----------
  // Logo, brokerage name, office address and phone, and brand colors all come from the team record. When one is
  // missing the agent sees that the kit is being finished, and the team admin is told what's missing.
  const svgUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(/xmlns=/.test(svg) ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
  function kitOf(team){
    const b = team.brand || {}, k = b.kit || {};
    const colors = (k.colors && k.colors.length ? k.colors : [b.primary, b.deep, b.ink].filter(Boolean).map((hex, i) => ({hex, name: ['Team color', 'Deep', 'Dark'][i]})))
      .filter(c => c && /^#[0-9a-f]{3,8}$/i.test(c.hex || ''));
    const kit = {brokerage: k.brokerage || '', logo: k.logo || (b.logoColor ? svgUrl(b.logoColor) : ''),
                 address: (k.address && k.address.length ? k.address : b.office) || [], phone: k.phone || b.phone || '', web: k.web || '', colors};
    kit.missing = [['logo', kit.logo], ['brokerage name', kit.brokerage], ['office address', kit.address.length], ['office phone', kit.phone], ['brand colors', colors.length]]
      .filter(x => !x[1]).map(x => x[0]);
    return kit;
  }
  const kitNoted = new Set();
  function reportKitGap(ctx, kit){
    if(!kit.missing.length || kitNoted.has(ctx.code)) return;
    kitNoted.add(ctx.code);
    ctx.sb.rpc('report_kit_gap', {p_code: ctx.code, p_missing: kit.missing}).then(() => {}, () => {});
  }
  const kitNotice = () => `<div class="fl-kit" role="status"><b>Your team's brand kit is being finished.</b>
    <p>Your pieces use the team logo, brokerage and colors, and a few of those aren't in yet. We've let your team admin know. Your listing is saved here, so come back once it's ready.</p></div>`;

  // ---------- data for the templates ----------
  function pieceData(ctx, design, accent, L, photoUrls, kit){
    const p = ctx.profile || {};
    const ids = photoUrls.map((_, i) => 'p' + String(i).padStart(2, '0'));
    const P = {}; ids.forEach((id, i) => P[id] = {src: photoUrls[i], tags: ''});
    if(p._photo) P.headshot = {src: p._photo, tags: ''};
    const brand = {brokerage: kit.brokerage, logo: kit.logo, accent, paper: '#f3f0ea', ink: '#232323', muted: '#5a5a5a',
                   phone: kit.phone, web: kit.web, officeLabel: 'Office'};
    const agent = {name: p.display_name || '', designation: 'REALTOR®', nar: !!p.nar, phone: p.cell || '', phoneLabel: 'Call / Text',
                   email: p.preferred_email || '', web: kit.web, qr: '/designs/qr.png', qrLabel: 'Scan for details', headshot: p._photo ? 'headshot' : null};
    return {template: design.id, sample: false, brand, agent, listing: Object.assign({state: 'Texas'}, L),
            openHouse: null, mailVendor: null, photos: P, companion: {fineprint: E.FINE_PRINT}, copy: E.pendingCopy(L, ids), copyPending: true};
  }

  // the set, in the same groups the public preview's try-it set shows
  function setMarkup(spec){
    const fold = spec.pieces.find(p => p.id === 'foldover');
    const panels = fold && fold.panels ? fold.panels : [{id: 'front', label: 'Front'}, {id: 'back', label: 'Back'}, {id: 'top', label: 'Inside, top'}, {id: 'bottom', label: 'Inside, bottom'}];
    const fig = (piece, label, panel) => `<figure><div class="sheet" data-piece="${piece}"${panel ? ` data-panel="${panel}"` : ''} data-label="${esc(label)}"></div><figcaption>${esc(label)}</figcaption></figure>`;
    return `<div class="fl-set">
      <h3>11 x 17 fold-over brochure</h3><div class="fl-grid two${fold && fold.panels ? ' portrait' : ''}">${panels.map(x => fig('foldover', x.label, x.id)).join('')}</div>
      <h3>Open House flyer, 8.5 x 11</h3><div class="fl-grid three">${fig('open-house-v1', 'Open House. You set the date and time later.')}</div>
      <h3>Just Listed postcard</h3><div class="fl-grid two">${fig('postcard-6x11-front', '6 x 11, front')}${fig('postcard-6x11-back', '6 x 11, back')}${fig('postcard-6x9-front', '6 x 9, front')}${fig('postcard-6x9-back', '6 x 9, back')}</div>
      <h3>Just Sold postcard</h3><div class="fl-grid two">${fig('just-sold-6x11-front', '6 x 11, front. Yours to pick up after the sale.')}${fig('just-sold-6x11-back', '6 x 11, back')}${fig('just-sold-6x9-front', '6 x 9, front')}${fig('just-sold-6x9-back', '6 x 9, back')}</div></div>`;
  }
  async function drawSet(box, design, data){
    const spec = await E.pieces(design.id);
    if(box.dataset.for !== design.id){ box.innerHTML = setMarkup(spec); box.dataset.for = design.id; }
    box.hidden = false;   // templates measure their text as they lay out, so they must draw while visible
    await E.drawSheets(box, design, data);
  }

  let designList = null;
  const designs = () => designList || (designList = fetch('/designs/designs.json').then(r => r.json()).then(l => l.filter(d => !d.test)));

  // ---------- photos saved with a package ----------
  async function savedPhotoUrls(ctx, pkg){
    const out = [];
    for(const ph of (pkg.photos || [])){
      try {
        if(ph.path){ const {data} = await ctx.sb.storage.from('package-files').createSignedUrl(ph.path, 3600); if(data && data.signedUrl) out.push(data.signedUrl); }
        else if(ph.src){ const u = await E.loadPhoto(ph.src); if(u) out.push(u); }
      } catch(_) {}
    }
    return out;
  }

  // ---------- new package: listing, design and colors, writing style ----------
  function newPackage(ctx){
    const kit = kitOf(ctx.team);
    const q = new URLSearchParams(location.search);
    const st = {link: q.get('link') || '', listing: null, photos: [], files: [], design: null, accent: kit.colors[0] && kit.colors[0].hex, style: null, manual: q.get('manual') === '1'};
    if(st.link) history.replaceState(null, '', location.pathname);

    ctx.main.innerHTML = `
      <section class="hello"><h1>New listing package</h1><p>Check the listing, pick a design, and we write and lay out the whole set.</p></section>
      <ol class="fl-steps" aria-label="Steps"><li data-s="1" class="now">Listing</li><li data-s="2">Design</li><li data-s="3">Writing style</li><li>Proof</li><li>Printer</li><li>Pay</li></ol>
      <section class="fl-card" id="flListing" aria-labelledby="flH1">
        <h2 id="flH1">Your listing</h2>
        <form class="fl-link" id="flLinkForm" novalidate>
          <label for="flLink">Matrix listing link</label>
          <div class="linkbox"><input id="flLink" type="url" inputmode="url" autocomplete="off" placeholder="Paste your Matrix listing link"><button type="submit" id="flGo">Go</button></div>
          <p class="fl-hint"><button type="button" class="fl-a" data-mx-help>How do I create a Matrix link?</button> <button type="button" class="fl-a" id="flManual">No Matrix link? Add photos instead</button></p>
        </form>
        <div class="fl-status" id="flStatus" role="status" aria-live="polite"></div>
        <div class="fl-err" id="flErr" role="alert" hidden><p id="flErrText"></p><div class="row"><button type="button" class="btn" id="flRetry">Try again</button><button type="button" class="btn line" id="flErrManual">Add photos instead</button></div></div>
        <div id="flManualBox" hidden>
          <label class="fl-drop" id="flDrop" tabindex="0"><b>Click to add photos</b> or drag them here<small>Up to 16. The first one goes on the cover.</small><input type="file" id="flFiles" accept="image/*" multiple hidden></label>
          <label class="fl-lbl" for="flDocs">Draft listing printout, if you have one</label>
          <p class="fl-hint">A PDF or screenshots of the listing, so our writers can get to know the house.</p>
          <input type="file" id="flDocs" accept="application/pdf,image/*" multiple>
          <p class="fl-hint" id="flPhotoNote" role="status"></p>
        </div>
        <div id="flConfirm" hidden>
          <figure class="fl-cover"><img id="flCoverImg" alt="Cover photo"></figure>
          <div class="fl-thumbs" id="flThumbs"></div>
          <form class="fl-facts" id="flFacts" novalidate>
            <label class="full">Street address<input name="address" autocomplete="off"></label>
            <label class="half">City<input name="city" autocomplete="off"></label>
            <label class="half">ZIP<input name="zip" inputmode="numeric" autocomplete="off"></label>
            <label class="full">Neighborhood<input name="neighborhood" autocomplete="off"></label>
            <label>Bedrooms<input name="beds" inputmode="numeric"></label>
            <label>Full baths<input name="baths" inputmode="numeric"></label>
            <label>Half baths<input name="halfBaths" inputmode="numeric"></label>
            <label>Stories<input name="stories" inputmode="numeric"></label>
            <label>Square feet<input name="sqft" inputmode="numeric"></label>
            <label>Year built<input name="yearBuilt" inputmode="numeric"></label>
            <label class="full">Anything our writers should know?<textarea name="notes" rows="3" placeholder="New roof in 2024, pool resurfaced, seller is leaving the playset"></textarea></label>
          </form>
          <p class="fl-note" id="flFactsNote" role="status"></p>
          <div class="row"><button type="button" class="btn" id="flToDesign">Yes, that's my listing</button></div>
        </div>
      </section>
      <section class="fl-card" id="flDesign" aria-labelledby="flH2" hidden>
        <h2 id="flH2">Design and colors</h2>
        <div id="flDesignBody"></div>
      </section>
      <section class="fl-card" id="flStyle" aria-labelledby="flH3" hidden>
        <h2 id="flH3">Writing style</h2>
        <p class="fl-hint">We suggest one from the listing. Pick another with one click; the copy is written in that style.</p>
        <div class="fl-styles" id="flStyles" role="radiogroup" aria-labelledby="flH3"></div>
        <p class="fl-note" id="flCreateNote" role="status" aria-live="polite"></p>
        <div class="row"><button type="button" class="btn" id="flCreate">Create my package</button></div>
      </section>`;
    const $ = id => document.getElementById(id);
    // a spinner while working; the last line (done) has none
    const say = (t, done) => { $('flStatus').innerHTML = t ? (done ? '' : '<i aria-hidden="true"></i>') + '<span></span>' : ''; if(t) $('flStatus').lastChild.textContent = t; };
    const step = n => document.querySelectorAll('.fl-steps li[data-s]').forEach(li => { const s = +li.dataset.s; li.className = s < n ? 'done' : s === n ? 'now' : ''; });
    const urls = () => st.photos.map(p => p.url);
    const form = $('flFacts');

    function readFacts(){
      const v = n => form.elements[n].value.trim();
      return {address: v('address'), city: v('city'), zip: v('zip'), neighborhood: v('neighborhood'), beds: num(v('beds')), baths: num(v('baths')),
              halfBaths: num(v('halfBaths')), stories: num(v('stories')), sqft: num(v('sqft')), yearBuilt: num(v('yearBuilt'))};
    }
    function fillFacts(L){
      ['address','city','zip','neighborhood','beds','baths','halfBaths','stories','sqft','yearBuilt'].forEach(n => { form.elements[n].value = L[n] == null ? '' : L[n]; });
    }
    function showPhotos(){
      $('flConfirm').hidden = !st.photos.length && !st.manual;
      const cover = st.photos[0];
      $('flCoverImg').hidden = !cover; if(cover) $('flCoverImg').src = cover.url;
      $('flThumbs').innerHTML = st.photos.map((p, i) => `<figure class="thumb"><img src="${p.url}" alt="Photo ${i+1}">${i ? `<button type="button" data-cover="${i}">Make cover</button>` : '<span class="cv">Cover</span>'}<button type="button" class="x" data-x="${i}" aria-label="Remove photo ${i+1}">×</button></figure>`).join('');
      if(st.design && !$('flDesign').hidden) redraw();
    }
    $('flThumbs').addEventListener('click', e => {
      const x = e.target.dataset.x, c = e.target.dataset.cover;
      if(x !== undefined){ st.photos.splice(+x, 1); showPhotos(); }
      if(c !== undefined){ st.photos.unshift(st.photos.splice(+c, 1)[0]); showPhotos(); }
    });

    const fail = code => {
      say(''); $('flErrText').textContent = E.MSG[code] || E.MSG.network; $('flErr').hidden = false;
      $('flRetry').hidden = !E.RETRY.includes(code);
    };
    let busy = false;
    async function run(){
      if(busy) return;
      const link = $('flLink').value.trim(); $('flErr').hidden = true;
      if(!link){ fail('not-a-link'); return; }
      busy = true; $('flGo').disabled = true;
      try {
        const j = await E.readMatrix(link, say);
        st.link = link; st.manual = false; $('flManualBox').hidden = true;
        st.photos = j.photos.map(p => ({src: p.src, url: p.url}));
        const l = j.listing;
        fillFacts({address: l.address, city: l.city, zip: l.zip, neighborhood: l.neighborhood, beds: l.beds, baths: l.baths, halfBaths: l.halfBaths,
                   stories: l.stories, sqft: l.sqft, yearBuilt: l.year || l.yearBuilt});
        showPhotos();
        say(`Found it. ${st.photos.length} photo${st.photos.length === 1 ? '' : 's'} from your listing. Check the facts below.` + (j.listingCount > 1 ? ' That link had more than one listing, so we used the first.' : ''), true);
        $('flConfirm').scrollIntoView({behavior: reduce() ? 'auto' : 'smooth', block: 'start'});
      } catch(e) { fail(e && e.code); }
      finally { busy = false; $('flGo').disabled = false; }
    }
    $('flLinkForm').addEventListener('submit', e => { e.preventDefault(); run(); });
    $('flRetry').onclick = run;
    const manual = () => { st.manual = true; $('flErr').hidden = true; say(''); $('flManualBox').hidden = false; showPhotos(); $('flDrop').focus(); };
    $('flManual').onclick = manual; $('flErrManual').onclick = manual;

    async function addFiles(list){
      const files = [...list].filter(f => /^image\//.test(f.type)), room = E.MAX_PHOTOS - st.photos.length;
      $('flPhotoNote').textContent = files.length > room ? `The set uses up to ${E.MAX_PHOTOS} photos, so we kept the first ${E.MAX_PHOTOS}.` : '';
      for(const f of files.slice(0, Math.max(0, room))){
        try { st.photos.push({file: f, url: await E.shrink(f)}); } catch(_) { $('flPhotoNote').textContent = `We couldn't open ${f.name}. Try a JPG or PNG.`; }
      }
      showPhotos();
    }
    const drop = $('flDrop'), fin = $('flFiles');
    fin.addEventListener('change', () => addFiles(fin.files));
    drop.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fin.click(); } });
    ['dragenter','dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave','drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
    $('flDocs').addEventListener('change', e => { st.files = [...e.target.files].slice(0, 10); });

    // ----- design and colors: the team logo and colors are already in; nothing to upload -----
    async function openDesign(){
      const note = $('flFactsNote'); note.textContent = '';
      if(!st.photos.length){ note.textContent = 'Add at least one photo. The first one goes on the cover.'; return; }
      if(!form.elements.address.value.trim()){ note.textContent = 'Add the street address.'; form.elements.address.focus(); return; }
      st.listing = readFacts();
      const body = $('flDesignBody');
      $('flDesign').hidden = false; step(2);
      if(kit.missing.length){
        reportKitGap(ctx, kit);
        body.innerHTML = kitNotice();
        $('flStyle').hidden = true;
        $('flDesign').scrollIntoView({behavior: reduce() ? 'auto' : 'smooth', block: 'start'});
        return;
      }
      const list = await designs();
      st.design = st.design || list[0];
      body.innerHTML = `
        <p class="fl-hint">Your team's logo and colors and your contact card are already on every piece. The faint lines are where we write the copy.</p>
        <div class="fl-pick"><h3 id="flDH">Design</h3><div class="fl-designs" role="radiogroup" aria-labelledby="flDH">${list.map(d =>
          `<label class="dcard"><input type="radio" name="fldesign" value="${esc(d.id)}"${d.id === st.design.id ? ' checked' : ''}><img src="${esc(d.thumb)}" alt="" width="900" height="1165" loading="lazy"><span>${esc(d.name)}</span></label>`).join('')}</div></div>
        <div class="fl-pick"><h3 id="flCH">Color</h3><div class="fl-colors" role="radiogroup" aria-labelledby="flCH">${kit.colors.map((c, i) =>
          `<label class="swatch"><input type="radio" name="flcolor" value="${esc(c.hex)}"${c.hex === st.accent ? ' checked' : ''}><span style="background:${esc(c.hex)}"></span>${esc(c.name || 'Color ' + (i + 1))}</label>`).join('')}</div></div>
        <div id="flSet" class="fl-setbox"></div>
        <div class="row"><button type="button" class="btn" id="flToStyle">Next: writing style</button></div>`;
      body.querySelector('.fl-designs').addEventListener('change', e => { st.design = list.find(d => d.id === e.target.value); redraw(); });
      body.querySelector('.fl-colors').addEventListener('change', e => { st.accent = e.target.value; redraw(); });
      $('flToStyle').onclick = openStyle;
      await redraw();
      $('flDesign').scrollIntoView({behavior: reduce() ? 'auto' : 'smooth', block: 'start'});
    }
    async function redraw(){
      const box = $('flSet'); if(!box || !st.design || !st.photos.length) return;
      st.listing = readFacts();
      await drawSet(box, st.design, pieceData(ctx, st.design, st.accent, st.listing, urls(), kit));
    }
    $('flToDesign').onclick = openDesign;

    function openStyle(){
      st.style = st.style || suggestStyle(st.listing);
      const sug = suggestStyle(st.listing);
      $('flStyles').innerHTML = STYLES.map(s => `<label class="fl-style"><input type="radio" name="flstyle" value="${s.id}"${s.id === st.style ? ' checked' : ''}><b>${esc(s.name)}${s.id === sug ? ' <small>Suggested for this house</small>' : ''}</b><span>${esc(s.note)}</span></label>`).join('');
      $('flStyle').hidden = false; step(3);
      $('flStyle').scrollIntoView({behavior: reduce() ? 'auto' : 'smooth', block: 'start'});
    }
    $('flStyles').addEventListener('change', e => { st.style = e.target.value; });

    // ----- create: the package is saved under this team, so it opens in this team's look anywhere -----
    $('flCreate').onclick = async () => {
      const note = $('flCreateNote'), btn = $('flCreate');
      if(kit.missing.length) return;
      btn.disabled = true; note.className = 'fl-note';
      try {
        const id = crypto.randomUUID();
        const photos = [], docs = [];
        let i = 0;
        for(const p of st.photos){
          if(p.src){ photos.push({src: p.src}); continue; }
          note.textContent = `Saving photo ${++i} of ${st.photos.filter(x => !x.src).length}…`;
          const blob = await fetch(p.url).then(r => r.blob());
          const path = `${ctx.me.id}/${id}/photo-${String(photos.length).padStart(2, '0')}.jpg`;
          const up = await ctx.sb.storage.from('package-files').upload(path, blob, {contentType: 'image/jpeg', upsert: false});
          if(up.error) throw up.error;
          photos.push({path});
        }
        for(const f of st.files){
          note.textContent = 'Saving your listing printout…';
          const path = `${ctx.me.id}/${id}/draft-${docs.length}-${f.name.replace(/[^\w.-]+/g, '_').slice(-60)}`;
          const up = await ctx.sb.storage.from('package-files').upload(path, f, {contentType: f.type || 'application/octet-stream', upsert: false});
          if(up.error) throw up.error;
          docs.push({path, name: f.name});
        }
        note.textContent = 'Creating your package…';
        const {data, error} = await ctx.sb.rpc('create_package', {p_code: ctx.code, p_id: id, p_link: st.link || null, p_listing: st.listing,
          p_photos: photos, p_docs: docs, p_notes: form.elements.notes.value.trim(), p_design: st.design.id, p_color: st.accent, p_style: st.style});
        if(error || !data) throw error || new Error('create');
        ctx.nav(`/${ctx.code}/package/${data}`);
      } catch(err) {
        note.className = 'fl-note err';
        note.textContent = /fetch|network/i.test((err && err.message) || '') ? 'Couldn’t reach the server. Check your connection and press Create my package again.' : 'That didn’t save. Press Create my package again, and if it keeps happening email support@brochuredesk.com.';
      } finally { btn.disabled = false; }
    };

    if(st.link){ $('flLink').value = st.link; setTimeout(run, 0); }
    else if(st.manual) manual();
    else setTimeout(() => $('flLink').focus({preventScroll: true}), 50);
  }

  // ---------- one package (also where an emailed link lands) ----------
  const STATUS = {
    draft: {step: 3, label: 'Saved', line: 'Your package is saved.'},
    building: {step: 3, label: 'Being written', line: 'We’re writing and laying out your set. We’ll email you when the proof is ready.'},
    proof: {step: 4, label: 'Proof ready', line: 'Your proof is ready to look over.'},
    printer: {step: 5, label: 'Pick your printer', line: 'Pick your printer and mail vendor.'},
    cart: {step: 6, label: 'In your printer\'s cart', line: 'Your brochure is in your printer\'s cart. You just check out.'},
    paid: {step: 7, label: 'Paid', line: 'Paid. Your files are ready to download for 60 days.'}
  };
  async function packagePage(ctx, id){
    const m = ctx.main;
    m.innerHTML = `<section class="hello"><h1>Opening your package…</h1></section>`;
    const {data: pkg, error} = await ctx.sb.from('packages').select('*').eq('id', id).maybeSingle();
    if(error || !pkg) return notFound(ctx, 'We couldn’t find that package in your account. It may belong to a different sign-in.');
    // a package always opens in the look of the team it was made under
    if(pkg.team_code && pkg.team_code !== ctx.code){ location.replace(`/${pkg.team_code}/package/${pkg.id}`); return; }
    const s = STATUS[pkg.status] || STATUS.draft, L = pkg.listing || {};
    const steps = ['Listing', 'Design', 'Writing style', 'Proof', 'Printer', 'Pay'];
    m.innerHTML = `
      <section class="hello"><h1>${esc(L.address || 'Your package')}</h1><p>${esc([L.neighborhood, L.city].filter(Boolean).join(', '))}</p></section>
      <ol class="fl-steps" aria-label="Package progress">${steps.map((t, i) => `<li class="${i + 1 < s.step ? 'done' : i + 1 === s.step ? 'now' : ''}"${i + 1 === s.step ? ' aria-current="step"' : ''}>${t}</li>`).join('')}</ol>
      <section class="fl-card">
        <div class="fl-sum"><div><span class="pill">${esc(s.label)}</span><p class="fl-line">${esc(s.line)}</p>
          <p class="fl-hint">${esc(designName(pkg.design))} design, ${esc(styleName(pkg.copy_style) || 'Classic')} writing style. Started ${esc(new Date(pkg.created_at).toLocaleDateString('en-US', {month: 'long', day: 'numeric', timeZone: 'America/Chicago'}))}.</p></div>
          <div class="row"><a class="btn line" href="/${esc(ctx.code)}" data-nav>Back to home</a></div></div>
        ${pkg.status === 'draft' || pkg.status === 'building' ? `<ul class="fl-progress" aria-label="Build progress"><li>Reading the listing</li><li>Writing the copy</li><li>Laying out the pieces</li><li>Print checks</li></ul>
          <p class="fl-hint">Test page: the writers aren’t switched on yet, so this package stays saved here with the copy as faint lines.</p>` : ''}
      </section>
      <section class="fl-card"><h2>Your set</h2><div class="fl-status" id="pkStatus" role="status" aria-live="polite"></div><div id="pkSet" class="fl-setbox"></div></section>`;
    const kit = kitOf(ctx.team), st = document.getElementById('pkStatus');
    if(kit.missing.length){ reportKitGap(ctx, kit); document.getElementById('pkSet').outerHTML = kitNotice(); return; }
    st.textContent = 'Getting your photos…';
    const [list, urls] = await Promise.all([designs(), savedPhotoUrls(ctx, pkg)]);
    const design = list.find(d => d.id === pkg.design) || list[0];
    if(!urls.length){ st.textContent = 'We couldn’t load this listing’s photos just now. Refresh the page to try again.'; return; }
    st.textContent = '';
    await drawSet(document.getElementById('pkSet'), design, pieceData(ctx, design, pkg.color || (kit.colors[0] || {}).hex, L, urls, kit));
  }
  let designNames = {};
  const designName = id => designNames[id] || (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Ivory');

  // ---------- past orders and receipts ----------
  async function myPackages(ctx, extra){
    const since = new Date(Date.now() - DAYS_VISIBLE * 864e5).toISOString();
    let q = ctx.sb.from('packages').select('id,listing,design,status,created_at,paid_at,amount_cents,team_code').eq('team_code', ctx.code).gte('created_at', since).order('created_at', {ascending: false}).limit(50);
    if(extra) q = extra(q);
    const {data} = await q;
    return data || [];
  }
  async function orders(ctx){
    ctx.main.innerHTML = `<section class="hello"><h1>Past orders</h1><p>Orders stay here for ${DAYS_VISIBLE} days to open and download again.</p></section><div id="orList"></div>`;
    const list = await myPackages(ctx);
    document.getElementById('orList').innerHTML = list.length ? `<table><thead><tr><th>Listing</th><th>Design</th><th>Status</th><th></th></tr></thead><tbody>${list.map(p =>
      `<tr><td><div class="a">${esc((p.listing || {}).address || 'Listing')}</div><div class="s2">${esc(new Date(p.created_at).toLocaleDateString('en-US', {timeZone: 'America/Chicago'}))}</div></td><td>${esc(designName(p.design))}</td><td><span class="pill">${esc((STATUS[p.status] || STATUS.draft).label)}</span></td><td><a class="lnk" href="/${esc(ctx.code)}/package/${esc(p.id)}" data-nav>Open</a></td></tr>`).join('')}</tbody></table>`
      : `<p class="fl-empty">No orders yet. <a href="/${esc(ctx.code)}/new" data-nav>Start a listing package</a>.</p>`;
  }
  async function receipts(ctx){
    ctx.main.innerHTML = `<section class="hello"><h1>Receipts</h1><p>One receipt for each package you pay for.</p></section><div id="rcList"></div>`;
    const list = await myPackages(ctx, q => q.not('paid_at', 'is', null));
    document.getElementById('rcList').innerHTML = list.length ? `<table><thead><tr><th>Listing</th><th>Paid</th><th>Amount</th></tr></thead><tbody>${list.map(p =>
      `<tr><td class="a">${esc((p.listing || {}).address || 'Listing')}</td><td>${esc(new Date(p.paid_at).toLocaleDateString('en-US', {timeZone: 'America/Chicago'}))}</td><td>$${((p.amount_cents || 0) / 100).toFixed(2)}</td></tr>`).join('')}</tbody></table>`
      : `<p class="fl-empty">No receipts yet. They show up here after you pay for a package.</p>`;
  }

  function help(ctx){
    ctx.main.innerHTML = `<section class="hello"><h1>Help</h1></section>
      <div class="fl-card fl-help">
        <h2>Making a Matrix link</h2><p>Your package starts from the Matrix link for your listing. <button type="button" class="fl-a" data-mx-help>See how to make one</button>.</p>
        <h2>Listing not live yet?</h2><p><a href="/${esc(ctx.code)}/new?manual=1" data-nav>Add your photos and a draft printout of the listing</a> instead.</p>
        <h2>Your logo and colors</h2><p>Your pieces use your team’s logo, brokerage and colors from the team brand kit. Your headshot, name, email and cell come from <a href="/${esc(ctx.code)}/profile" data-nav>your profile</a>.</p>
        <h2>Anything else</h2><p>Email <b>support@brochuredesk.com</b>. We reply within 24 hours.</p>
      </div>`;
  }

  function printer(ctx){
    ctx.main.innerHTML = `<section class="hello"><h1>Printer and mail vendor</h1></section>
      <div class="fl-card fl-help"><p>You pick your printer and mail vendor when you order a package. The ones you use are saved here, so next time they're already chosen.</p>
      <p class="fl-hint">Nothing saved yet.</p><div class="row"><a class="btn line" href="/${esc(ctx.code)}" data-nav>Back to home</a></div></div>`;
  }

  function notFound(ctx, why){
    document.title = `Page not found | ${ctx.team.name} Print Marketing`;
    ctx.main.innerHTML = `<section class="hello"><h1>This page isn’t here</h1><p>${esc(why || 'Check the address, or head back to your home page.')}</p></section>
      <div class="row"><a class="btn" href="/${esc(ctx.code)}" data-nav>Back to home</a></div>`;
  }

  async function mount(ctx, route){
    designs().then(l => { designNames = Object.fromEntries(l.map(d => [d.id, d.name])); }, () => {});
    const [r, a] = route;
    window.scrollTo(0, 0);
    if(r === 'new' && !a) return newPackage(ctx);
    if(r === 'package' && a && /^[0-9a-f-]{36}$/i.test(a) && route.length === 2) return packagePage(ctx, a);
    if(r === 'orders' && !a) return orders(ctx);
    if(r === 'receipts' && !a) return receipts(ctx);
    if(r === 'help' && !a) return help(ctx);
    if(r === 'printer' && !a) return printer(ctx);
    return notFound(ctx);
  }

  window.TeamFlow = {mount, kitOf, myPackages, STATUS, designName: id => designName(id)};
})();
