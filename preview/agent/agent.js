// Signed-in agent flow, test drive on the working site (brief 10/20/2026). Not linked, not indexed.
// Link -> pick box -> design gallery -> rough-draft proof (no AI) -> Finalize (AI writes) -> final proof with edits ->
// approve and order -> fold-over delivery -> the other pieces or Later -> Agent home.
// Packages autosave to the account (Supabase agent_packages) when signed in, or to this browser in test mode.
// Payment, printer upload and the PDF email are test stand-ins here (no Stripe or printer accounts yet).
(function(){
  const SUPABASE_URL = 'https://depwvwewbmxspoxidxrx.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mF60NaxAKLQV_pDLBoR2og_PzJ9fxxH';   // public browser key; access is enforced in the database
  const FN_MATRIX = SUPABASE_URL + '/functions/v1/matrix-listing';
  const FN_AI = SUPABASE_URL + '/functions/v1/package-ai';
  const MAX_PHOTOS = 16, PHOTO_W = 900;
  const FINE_PRINT = 'Information deemed reliable but not guaranteed.';
  const PRICE = {full: 2500, essentials: 2000, single: 1000};
  const KIND_LABEL = {full: 'Full package', essentials: 'The Essentials', single: 'Single piece'};
  const PIECES = [
    {id: 'foldover', label: 'Fold-over brochure', short: 'brochure'},
    {id: 'listing-flyer', label: 'Listing flyer', short: 'flyer'},
    {id: 'open-house-flyer', label: 'Open House flyer', short: 'flyer'},
    {id: 'postcard', label: 'Just Listed postcard', short: 'postcard'},
  ];
  const IVORY_PANELS = [{id: 'front', label: 'Front'}, {id: 'back', label: 'Back'}, {id: 'top', label: 'Inside, top'}, {id: 'bottom', label: 'Inside, bottom'}];
  const COLORS = ['#1f4e5f', '#1F4D3F', '#1d3557', '#7a2e3a', '#3a3a3a', '#8a6a2f'];
  const STYLE_SAMPLE = {
    classic: 'Three bedrooms and two full baths, with a kitchen redone top to bottom.',
    luxury: 'White oak runs through the main rooms. The kitchen keeps to stone, steel and one long island.',
    urban: 'Coffee is a short walk away, and Downtown is one quick drive.',
    spread: 'A fenced yard, a flex room off the kitchen and a closet in every hall.',
    easy: 'Everything used day to day sits on one floor, with a yard that asks little of a weekend.',
  };
  const SAMPLE_AGENT = {name: 'Avery Morgan', designation: 'REALTOR®', nar: false, phone: '713.555.0123', phoneLabel: 'Call / Text',
    email: 'avery@yourbrokerage.com', web: 'yourbrokerage.com', qrLabel: 'Scan for details', headshot: null, qr: '/designs/qr.png'};
  const SAMPLE_BRAND = {brokerage: 'Any Brokerage', accent: '#1f4e5f', paper: '#f3f0ea', ink: '#232323', muted: '#5a5a5a',
    phone: '713.555.0100', web: 'anybrokerage.com', officeLabel: 'Office', logo: '/designs/samples/larkspur/AnyBrokerage_forest.png',
    logoOnDark: '/designs/samples/larkspur/AnyBrokerage_gold-on-dark.png'};
  const SAMPLE_LISTING = {
    link: 'sample', listing: {address: '4127 Larkspur Bend Street', neighborhood: 'East End', city: 'Houston', state: 'Texas', zip: '77023',
      beds: 3, baths: 2, halfBaths: 0, sqft: 1385, yearBuilt: 1940, stories: 1},
    photos: [['front', 'front exterior, 1940 bungalow, new siding'], ['living', 'living room, open to dining'], ['kitchen', 'kitchen, new cabinets'],
      ['kitchen2', 'kitchen bar seating'], ['dining', 'dining area'], ['nook', 'breakfast nook'], ['hall', 'entry'], ['primary', 'primary bedroom'],
      ['bedroom2', 'bedroom two'], ['study', 'bedroom three'], ['office', 'primary bath'], ['family', 'front exterior, side angle'], ['lawn', 'backyard']]
      .map(([f, c], n) => ({n, url: `/designs/samples/larkspur/${f}.jpg`, desc: c}))
  };

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = c => '$' + (c / 100).toFixed(c % 100 ? 2 : 0);
  const dayFmt = d => new Date(d).toLocaleDateString('en-US', {timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric'});
  const addDays = (d, n) => new Date(new Date(d).getTime() + n * 864e5).toISOString();
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  let me = null, profile = null, localMode = false, pkg = null, designs = [], catalog = null;
  const specs = {}, tpls = {}, examples = {}, fontSpecs = {}, photoSrc = new Map();

  // ---------- storage: the account when signed in, this browser in test mode ----------
  const LKEY = 'bd-agent-packages', LEVENTS = 'bd-agent-events';
  const lget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch(e) { return d; } };
  const lput = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };
  const store = {
    async list(){
      if(localMode) return Object.values(lget(LKEY, {})).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const {data, error} = await sb.from('agent_packages').select('state').order('updated_at', {ascending: false}).limit(50);
      if(error) throw error;
      return data.map(r => r.state);
    },
    async save(p){
      if(localMode){ const all = lget(LKEY, {}); all[p.id] = p; lput(LKEY, all); return; }
      const {error} = await sb.from('agent_packages').upsert({id: p.id, address: p.listing.address, stage: p.stage, state: p, updated_at: p.updatedAt});
      if(error) throw error;
    },
    async event(id, event, detail = {}){
      if(localMode){ const l = lget(LEVENTS, []); l.push({at: new Date().toISOString(), package_id: id, event, detail}); lput(LEVENTS, l.slice(-200)); }
      if(!sb) return;
      sb.from('package_events').insert(Object.assign({package_id: id, event, detail}, localMode ? {user_id: null} : {})).then(({error}) => { if(error) console.warn('event not logged', error.message); });
    }
  };
  let saveTimer = null;
  function save(now){
    if(!pkg) return;
    pkg.updatedAt = new Date().toISOString();
    $('#saved').textContent = 'Saving…';
    clearTimeout(saveTimer);
    const run = () => store.save(pkg).then(() => { $('#saved').textContent = localMode ? 'Saved in this browser' : 'Saved to your account'; })
      .catch(e => { $('#saved').textContent = "Couldn't save. Check your connection; we'll keep trying."; console.warn(e); saveTimer = setTimeout(run, 4000); });
    if(now) return run();
    saveTimer = setTimeout(run, 500);
  }

  // ---------- views ----------
  const VIEWS = ['vSignin', 'vHome', 'vStart', 'vGallery', 'vRough', 'vWriting', 'vFinal'];
  function show(id){
    VIEWS.forEach(v => $('#' + v).hidden = v !== id);
    closePop();
    const hash = {vHome: 'home', vStart: 'start', vGallery: 'gallery', vRough: 'rough', vFinal: 'final'}[id];
    if(hash && location.hash !== '#' + hash) history.replaceState(null, '', '#' + hash);
    window.scrollTo({top: 0, behavior: 'auto'});
  }
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if(!go) return;
    e.preventDefault();
    if(go.dataset.go === 'home') openHome();
    if(go.dataset.go === 'start') openStart();
  });

  // ---------- sign in ----------
  async function boot(){
    localMode = lget('bd-local-mode', false) === true;
    if(!localMode && sb){
      const {data} = await sb.auth.getSession();
      me = data.session ? data.session.user : null;
    }
    if(!me && !localMode){ whoLine(); show('vSignin'); return; }
    await afterSignIn();
  }
  $('#signinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target; $('#signinErr').textContent = '';
    const {data, error} = await sb.auth.signInWithPassword({email: f.email.value.trim(), password: f.password.value});
    if(error){ $('#signinErr').textContent = "That email and password didn't match. Try again."; return; }
    me = data.user; localMode = false; lput('bd-local-mode', false); f.reset();
    await afterSignIn();
  });
  $('#localMode').onclick = async () => { localMode = true; lput('bd-local-mode', true); await afterSignIn(); };
  function whoLine(){
    const w = $('#who');
    if(me) w.innerHTML = `${esc(me.email)}<button type="button" id="signout">Sign out</button>`;
    else if(localMode) w.innerHTML = `Browser-only test<button type="button" id="signout">Sign in</button>`;
    else w.textContent = '';
    const b = $('#signout'); if(b) b.onclick = async () => { if(me) await sb.auth.signOut(); me = null; localMode = false; lput('bd-local-mode', false); pkg = null; whoLine(); show('vSignin'); };
  }
  async function afterSignIn(){
    whoLine();
    if(me){
      const {data} = await sb.from('agent_profiles').select('*').eq('user_id', me.id).maybeSingle();
      profile = data || null;
      const t = await sb.from('agent_packages').select('id').limit(1);
      if(t.error){ console.warn(t.error); localMode = true; whoLine(); $('#saved').textContent = "Account saving isn't set up yet, so this test saves in this browser."; }
    }
    designs = await fetch('/designs/designs.json').then(r => r.json());
    const cur = lget('bd-current', null), hash = location.hash.slice(1);
    if(cur && ['rough', 'final', 'gallery'].includes(hash)){
      const list = await store.list().catch(() => []);
      const p = list.find(x => x.id === cur);
      if(p){ await openPackage(p, hash); return; }
    }
    openHome();
  }

  // ---------- Agent home ----------
  function piecesOf(p){ return p.order.kind === 'full' ? PIECES.map(x => x.id) : p.order.kind === 'essentials' ? PIECES.slice(1).map(x => x.id) : [p.order.piece]; }
  const pieceLabel = id => (PIECES.find(x => x.id === id) || {label: id}).label;
  function windows(p){
    if(!p.paid) return null;
    const list = piecesOf(p), approved = list.filter(id => p.approvals[id]);
    const all = approved.length === list.length;
    const last = approved.map(id => p.approvals[id]).sort().pop();
    return {
      all, fixesUntil: all ? addDays(last, 30) : addDays(p.paid.at, 60),
      ohUntil: list.includes('open-house-flyer') ? addDays(p.paid.at, 365) : null,
    };
  }
  function fixesOpen(p){ const w = windows(p); return !w || new Date() <= new Date(w.fixesUntil); }
  async function openHome(){
    show('vHome');
    $('#hello').textContent = `Welcome back${profile && (profile.greeting_name || profile.display_name) ? ', ' + (profile.greeting_name || profile.display_name.split(' ')[0]) : ''}`;
    let list = [];
    try { list = await store.list(); } catch(e) { $('#pickup').innerHTML = '<p class="err">We couldn\'t load your packages. Refresh to try again.</p>'; return; }
    const open = list.filter(p => !p.paid || piecesOf(p).some(id => !p.approvals[id]));
    const past = list.filter(p => p.paid && new Date() <= new Date(addDays(p.paid.at, 60)));
    const row = (p, kind) => {
      const ps = piecesOf(p), done = ps.filter(id => p.approvals[id]).length, w = windows(p);
      const next = p.stage === 'rough' || p.stage === 'writing' ? 'Rough draft: finalize when ready' : !p.paid ? 'Proof ready to review' : `${done} of ${ps.length} pieces approved`;
      const cover = p.photos[0] ? photoUrlNow(p.photos[0].url) : '';
      return `<div class="pk">${cover ? `<img src="${esc(cover)}" alt="">` : '<img alt="">'}<div><b>${esc(p.listing.address || 'New listing')}</b>
        <small>${KIND_LABEL[p.order.kind]}${p.order.kind === 'single' ? ': ' + esc(pieceLabel(p.order.piece)) : ''} · ${esc(next)}</small>
        ${w ? `<small>${w.all ? 'Small fixes' : 'Fixes and approvals'} open until ${dayFmt(w.fixesUntil)}${w.ohUntil ? ` · Open house flyer updates until ${dayFmt(w.ohUntil)}` : ''}</small>` : ''}</div>
        <button class="btn ${kind === 'past' ? 'line' : ''}" type="button" data-open="${p.id}">${kind === 'past' ? 'Open' : 'Pick up'}</button></div>`;
    };
    $('#pickup').innerHTML = open.length ? open.map(p => row(p, 'open')).join('') : '<p class="empty">Nothing waiting. Start a package and it shows up here.</p>';
    $('#orders').innerHTML = past.length ? past.map(p => row(p, 'past')).join('') : '<p class="empty">No orders in the last 60 days.</p>';
    $$('[data-open]').forEach(b => b.onclick = () => { const p = list.find(x => x.id === b.dataset.open); openPackage(p); });
  }
  async function openPackage(p, where){
    pkg = p; lput('bd-current', p.id);
    resolvePhotos(p);
    if(where === 'gallery') return openGallery();
    if(p.stage === 'rough' || p.stage === 'writing') return openRough();
    return openFinal(where === 'final' ? null : nextPiece());
  }

  // ---------- 1. link + pick box ----------
  let lookup = null;
  function openStart(){
    pkg = null; lookup = null;
    $('#link').value = ''; $('#progress').hidden = true; $('#pickBox').hidden = true; $('#toGallery').disabled = true;
    show('vStart'); setTimeout(() => $('#link').focus(), 50);
  }
  function stepTo(step, pct, text){
    const order = ['lookup', 'photos', 'details'];
    $$('#steps li').forEach(li => { const i = order.indexOf(li.dataset.step), j = order.indexOf(step);
      li.className = i < j || step === 'done' ? 'done' : i === j ? 'on' : ''; });
    $('#barFill').style.width = pct + '%';
    $('#status').textContent = text;
  }
  const MSG = {
    har: "That's a har.com link. HAR's site blocks automatic reading, so we need the Matrix link instead.",
    'other-site': 'We can only read Matrix links right now, not Zillow or Realtor.com.',
    'not-matrix': "That doesn't look like a Matrix listing link. It should start with https://matrix.harmls.com/.",
    'not-a-link': "That doesn't look like a link yet. Paste the whole Matrix link, starting with https://.",
    blocked: "HAR's site asked us to prove we're a person, and we won't try to get past that. Give it a few minutes and try again.",
    unreadable: "We opened the link but couldn't find the listing on it.",
    'not-found': "That link didn't open a listing. It may have expired. Make a fresh one in Matrix.",
    unreachable: "We couldn't reach Matrix just now. Try again in a moment.",
    'slow-down': "That's a lot of tries in a row. Wait a few minutes and try again.",
    network: 'Something went wrong on our end while reading the link. Try again.'
  };
  function localCheck(v){
    let u; try { u = new URL(v); } catch(e) { return 'not-a-link'; }
    const h = u.hostname.toLowerCase();
    if(h === 'har.com' || h.endsWith('.har.com')) return 'har';
    if(/(^|\.)(zillow|realtor|redfin|trulia|homes|movoto)\.com$/.test(h)) return 'other-site';
    if(h !== 'matrix.harmls.com') return 'not-matrix';
    return '';
  }
  $('#linkForm').addEventListener('submit', e => { e.preventDefault(); runLookup($('#link').value.trim()); });
  $('#sampleListing').onclick = () => runLookup('sample');
  async function runLookup(link){
    $('#linkErr').textContent = '';
    if(link !== 'sample'){ const bad = localCheck(link); if(bad){ $('#progress').hidden = false; $('#linkErr').textContent = MSG[bad]; return; } }
    $('#progress').hidden = false; $('#pickBox').hidden = false; $('#toGallery').disabled = true; $('#go').disabled = true;
    pickChanged();
    try {
      stepTo('lookup', 8, 'Reading your listing…');
      let j;
      if(link === 'sample'){ j = {ok: true, listing: SAMPLE_LISTING.listing, photos: SAMPLE_LISTING.photos, spares: []}; await new Promise(r => setTimeout(r, 500)); }
      else {
        try { j = await fetch(`${FN_MATRIX}?link=${encodeURIComponent(link)}`).then(r => r.json()); } catch(e) { throw {code: 'network'}; }
        if(!j.ok) throw {code: j.error};
      }
      const cand = j.photos.concat(j.spares || []), want = Math.min(MAX_PHOTOS, j.photos.length), got = [];
      stepTo('photos', 25, `Found ${j.totalPhotos || cand.length} photos, picking the best ${want}…`);
      let next = 0, done = 0;
      const worker = async () => {
        while(next < cand.length && got.filter(Boolean).length < MAX_PHOTOS){
          const i = next++;
          try { const u = await loadPhoto(cand[i].url, link !== 'sample'); got[i] = u ? cand[i] : null; } catch(e) { got[i] = null; }
          done++; if(done <= want) stepTo('photos', 25 + Math.round(55 * done / want), `Getting photo ${Math.min(done, want)} of ${want}…`);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      const keep = got.filter(Boolean).slice(0, MAX_PHOTOS).sort((a, b) => a.n - b.n);
      if(!keep.length) throw {code: 'unreadable'};
      stepTo('details', 90, 'Filling in the details…');
      const l = j.listing;
      lookup = {link, listing: {address: l.address, neighborhood: l.neighborhood || '', city: l.city || 'Houston', state: 'Texas', zip: l.zip || '',
        beds: l.beds, baths: l.baths, halfBaths: l.halfBaths || 0, sqft: l.sqft, yearBuilt: l.yearBuilt || l.year, stories: l.stories || null, description: l.description || ''},
        photos: keep.map(p => ({n: p.n, url: p.url, desc: p.desc || ''}))};
      stepTo('done', 100, `Found ${lookup.listing.address}: ${keep.length} photos. Pick what you'd like below.`);
      $('#toGallery').disabled = false;
    } catch(e) {
      $('#linkErr').textContent = MSG[e && e.code] || MSG.network; stepTo('lookup', 0, '');
    } finally { $('#go').disabled = false; }
  }
  function pickChanged(){
    const kind = document.querySelector('input[name=kind]:checked').value;
    $('#singlePiece').disabled = kind !== 'single';
    const hasCard = kind !== 'single' || $('#singlePiece').value === 'postcard';
    $('#sizeRow').hidden = !hasCard;
  }
  $$('input[name=kind]').forEach(r => r.onchange = pickChanged);
  $('#singlePiece').onchange = () => { document.querySelector('input[name=kind][value=single]').checked = true; pickChanged(); };
  $('#toGallery').onclick = () => {
    const kind = document.querySelector('input[name=kind]:checked').value;
    const now = new Date().toISOString();
    pkg = {id: uuid(), createdAt: now, updatedAt: now, link: lookup.link, listing: lookup.listing, photos: lookup.photos,
      order: {kind, piece: kind === 'single' ? $('#singlePiece').value : null, size: document.querySelector('input[name=size]:checked').value},
      design: null, brand: {accent: COLORS[0], fonts: {}}, copyStyle: suggestStyle(lookup.listing), arrangements: {}, ohFlyer: null,
      stage: 'rough', copy: {}, approvals: {}, paid: null, delivery: {}, openHouse: {kind: 'public', date: '', start: '13:00', end: '16:00'}, edits: 0};
    lput('bd-current', pkg.id);
    save(true);
    openGallery();
  };
  function suggestStyle(L){
    if(L.sqft >= 3800) return 'luxury';
    if(L.beds >= 4) return 'spread';
    if(L.stories === 1 && L.beds <= 3 && L.yearBuilt && L.yearBuilt > 1990) return 'easy';
    return 'classic';
  }

  // ---------- photos ----------
  async function shrink(blob){
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, PHOTO_W / bmp.width), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return URL.createObjectURL(await new Promise(r => c.toBlob(r, 'image/jpeg', .84)));
  }
  // A listing collage (one big photo plus small ones in light gutters) is kept out of the photo slots (same test as the homepage).
  function isCollage(bmp){
    const k = Math.min(1, 300 / Math.max(bmp.width, bmp.height)), w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(bmp.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', {willReadFrequently: true}); g.drawImage(bmp, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, L = (x, y) => { const i = (y * w + x) * 4; return .299 * d[i] + .587 * d[i+1] + .114 * d[i+2]; };
    const stat = v => { const m = v.reduce((a, b) => a + b, 0) / v.length; return [m, Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)]; };
    const gut = (n, at, lo, hi) => { const S = []; for(let i = 0; i < n; i++){ const v = []; for(let j = lo; j < hi; j++) v.push(at(i, j)); S.push(stat(v)); }
      const out = []; for(let i = Math.max(3, Math.floor(n * .08)); i < Math.min(n - 3, Math.floor(n * .92)); i++)
        if(S[i][0] > 195 && S[i][1] < 14 && [i - 3, i + 3].every(q => S[q][1] > 15 || S[i][0] - S[q][0] > 20)) out.push(i); return out; };
    const col = (i, j) => L(i, j), row = (i, j) => L(j, i);
    for(const x of gut(w, col, 0, h)) if(gut(h, row, x + 2, w).length || gut(h, row, 0, Math.max(0, x - 1)).length) return true;
    for(const y of gut(h, row, 0, w)) if(gut(w, col, y + 2, h).length || gut(w, col, 0, Math.max(0, y - 1)).length) return true;
    return false;
  }
  // Matrix photos come through our reader (browsers can't fetch them directly); sample photos are on this site.
  async function loadPhoto(url, viaReader){
    if(photoSrc.has(url)) return photoSrc.get(url);
    if(!viaReader && url.startsWith('/')){ photoSrc.set(url, url); return url; }
    const r = await fetch(`${FN_MATRIX}?photo=${encodeURIComponent(url)}`);
    if(!r.ok) throw new Error('photo');
    const blob = await r.blob();
    if(isCollage(await createImageBitmap(blob))) return null;
    const u = await shrink(blob); photoSrc.set(url, u); return u;
  }
  const photoUrlNow = url => photoSrc.get(url) || (url.startsWith('/') ? url : '');
  let photosReady = Promise.resolve();
  function resolvePhotos(p){
    photosReady = Promise.all(p.photos.map(ph => loadPhoto(ph.url, !ph.url.startsWith('/')).catch(() => null)));
    return photosReady;
  }

  // ---------- designs, pieces, data for the templates ----------
  const spec = id => specs[id] || (specs[id] = fetch(`/designs/${id}/pieces.json`).then(r => r.json()));
  const tpl = (id, file) => tpls[id + '/' + file] || (tpls[id + '/' + file] = fetch(`/designs/${id}/${file}`).then(r => r.text()));
  const example = id => examples[id] || (examples[id] = fetch(`/designs/${id}/copy-example.json`).then(r => r.ok ? r.json() : null));
  const fontSpec = id => fontSpecs[id] || (fontSpecs[id] = fetch(`/designs/${id}/fonts.json`).then(r => r.ok ? r.json() : null).catch(() => null));
  // The parts one logical piece is drawn from, in this design (null when the design doesn't have the piece).
  function partsFor(S, lid, p){
    const by = Object.fromEntries(S.pieces.map(x => [x.id, x]));
    if(lid === 'foldover'){ const f = by.foldover; if(!f) return null; return (f.panels || IVORY_PANELS).map(x => ({piece: f, panel: x.id, label: x.label})); }
    if(lid === 'open-house-flyer'){
      const oh = p && p.ohFlyer && p.ohFlyer.design === S.design && by[p.ohFlyer.piece];
      const f = oh || by['open-house-flyer']; return f ? [{piece: f, label: oh ? f.title : 'Open House flyer'}] : null; }
    if(lid === 'listing-flyer') return by['listing-flyer'] ? [{piece: by['listing-flyer'], label: 'Listing flyer'}] : null;
    if(lid === 'postcard'){ const s = (p && p.order.size) || '6x11', f = by[`postcard-${s}-front`], b = by[`postcard-${s}-back`];
      return f && b ? [{piece: f, label: `${s.replace('x', ' x ')}, front`}, {piece: b, label: `${s.replace('x', ' x ')}, back`}] : null; }
    return null;
  }
  const arrangement = (p, id) => p.arrangements[id] || (p.arrangements[id] = p.photos.map((_, i) => i));
  function fontsFor(p, fs){
    const out = {};
    if(!fs) return out;
    for(const [role, v] of Object.entries(p.brand.fonts || {})){
      const o = fs.originals && fs.originals[role];
      if(v && o && (o.approved || []).includes(v)) out[role] = v;   // carried over only where this design approved the font
    }
    return out;
  }
  function draftCopy(ids){
    const L = pkg.listing, stats = [];
    if(L.beds) stats.push(`${L.beds} Bedroom${L.beds !== 1 ? 's' : ''}`);
    if(L.baths) stats.push(`${L.baths} Full` + (L.halfBaths ? ` + ${L.halfBaths} Half` : '') + ' Baths');
    if(L.sqft) stats.push(`${Number(L.sqft).toLocaleString('en-US')} Sq Ft`);
    if(L.yearBuilt) stats.push(`Built in ${L.yearBuilt}`);
    const rest = ids.length > 1 ? ids.slice(1) : ids; let n = 0;
    const slot = () => rest[n++ % rest.length];
    const place = [L.neighborhood, [L.city, L.state].filter(Boolean).join(', ')].filter(Boolean).join(' / ');
    const feat = () => ({photo: slot(), caption: '', title: '', body: ''}), tile = () => ({photo: slot(), title: '', body: ''});
    return {
      front: {photo: ids[0], location: place},
      insideTop: {kicker: '', title: '', stats: stats.slice(0, 4), intro: '', features: [feat(), feat()], tiles: [tile(), tile(), tile(), tile()]},
      insideBottom: {kicker: '', title: '', features: [feat(), feat(), feat()], tiles: [tile(), tile(), tile()]},
      back: {kicker: '', title: '', variant: 'photos', plans: [{photo: slot(), label: ''}], planDisclosures: [],
             feature: {photo: ids[ids.length - 1], title: '', body: ''}, locationTitle: '', locationBody: '', footnote: FINE_PRINT}};
  }
  const draftCompanion = ids => ({fineprint: FINE_PRINT, flyerPhotos: ids.slice(0, 7), postcard: {photos: ids.slice(0, 5)}});
  async function dataFor(designId, final){
    const d = designs.find(x => x.id === designId) || {}, fs = await fontSpec(designId);
    const arr = arrangement(pkg, designId), ids = arr.map(i => 'p' + i);
    const P = {};
    arr.forEach(i => { const ph = pkg.photos[i]; P['p' + i] = {src: photoUrlNow(ph.url), tags: ph.desc || ''}; });
    const S = d.sample || {};
    const fonts = fontsFor(pkg, fs);
    const brand = Object.assign({}, SAMPLE_BRAND, S.brokerage ? {brokerage: S.brokerage, logo: S.logo, web: S.web} : {}, {accent: pkg.brand.accent},
      Object.keys(fonts).length ? {fonts} : {});
    const agent = Object.assign({}, SAMPLE_AGENT, profile ? {name: profile.display_name || SAMPLE_AGENT.name, mailerName: profile.mailer_name || null, phone: profile.cell || SAMPLE_AGENT.phone,
      email: profile.preferred_email || SAMPLE_AGENT.email} : {}, S.qrLabel ? {qrLabel: S.qrLabel, web: S.agentWeb || SAMPLE_AGENT.web} : {});
    const written = final && pkg.copy[designId];
    const oh = pkg.openHouse && pkg.openHouse.date ? pkg.openHouse : null;
    return {template: designId, sample: true, brand, agent, listing: pkg.listing, mailVendor: null, photos: P,
      openHouse: final ? oh : null,
      copy: written ? written.copy : draftCopy(ids),
      companion: written ? Object.assign({fineprint: FINE_PRINT}, written.companion) : draftCompanion(ids),
      copyPending: !written};
  }

  // ---------- drawing a part into a sheet ----------
  const SLOT = '<script id="brochure-data" type="application/json">{}</' + 'script>';
  function srcdoc(designId, html, data, panel, keepBg){
    const hide = panel ? `.page:not([data-page="${panel}"]){display:none!important}` : '';
    const base = `/designs/${designId}/`;
    return html.replace('<head>', `<head><base href="${base}">`)
      .replace(/(href|src)="(?!https?:|\/|data:|blob:|#)([^"]+\.(?:css|js))"/g, `$1="${base}$2"`)
      .replace(SLOT, SLOT.replace('{}', JSON.stringify(data).replace(/<\//g, '<\\/')))
      .replace('</head>', keepBg ? '</head>' : `<style>html,body{background:transparent!important;margin:0!important;overflow:hidden}.page{margin:0!important;box-shadow:none!important}${hide}</style></head>`);
  }
  function fit(sheet){
    const fr = sheet.querySelector('iframe'), doc = fr && fr.contentDocument;
    const pg = doc && doc.querySelector(sheet.dataset.panel ? `.page[data-page="${sheet.dataset.panel}"]` : '.page');
    if(!pg || !pg.offsetWidth) return;
    const w = pg.offsetWidth, h = pg.offsetHeight, k = sheet.clientWidth / w;
    fr.style.width = w + 'px'; fr.style.height = h + 'px'; fr.style.transform = `scale(${k})`;
    sheet.style.height = (h * k) + 'px'; sheet.dataset.k = k;
  }
  const ro = new ResizeObserver(es => es.forEach(e => fit(e.target)));
  // draws [{piece, panel, label}] into `box`; onReady(frame, sheet, part) runs after each template finishes laying out
  async function drawParts(box, designId, parts, data, onReady){
    await photosReady;
    const html = {};
    for(const pt of parts) html[pt.piece.file] = html[pt.piece.file] || await tpl(designId, pt.piece.file);
    const have = [...box.querySelectorAll(':scope > figure')];
    if(have.length !== parts.length){ box.innerHTML = parts.map(pt => `<figure><div class="sheet"></div><figcaption></figcaption></figure>`).join(''); }
    [...box.querySelectorAll(':scope > figure')].forEach((fig, i) => {
      const pt = parts[i], s = fig.querySelector('.sheet');
      fig.querySelector('figcaption').textContent = parts.length > 1 ? pt.label : '';
      s.dataset.panel = pt.panel || '';
      const d = pt.piece.kind === 'foldover' ? Object.assign({}, data, {mode: 'proof'}) : Object.assign({}, data, {mode: 'email', piece: pt.piece});
      let fr = s.querySelector('iframe');
      if(!fr){ fr = document.createElement('iframe'); fr.setAttribute('scrolling', 'no'); fr.tabIndex = -1; s.appendChild(fr); ro.observe(s); }
      fr.title = pt.label;
      fr.onload = () => { const w = fr.contentWindow;
        Promise.resolve(w.brochureReady).then(() => fr.contentDocument.fonts ? fr.contentDocument.fonts.ready : 0)
          .then(() => { fit(s); if(onReady) onReady(fr, s, pt); }); fit(s); };
      fr.srcdoc = srcdoc(designId, html[pt.piece.file], d, pt.panel);
    });
  }

  // ---------- 2. gallery ----------
  async function eligible(){
    const out = [];
    for(const d of designs){
      const S = await spec(d.id); S.design = d.id;
      if(piecesOf(pkg).every(lid => partsFor(S, lid, pkg))) out.push({d, S});
    }
    return out;
  }
  async function openGallery(){
    show('vGallery');
    const ps = piecesOf(pkg);
    $('#galleryLede').textContent = pkg.order.kind === 'single' ? `Every design's ${pieceLabel(pkg.order.piece).toLowerCase()}, with your photos.`
      : pkg.order.kind === 'essentials' ? 'Each design as its matching set, without the fold-over, with your photos.' : 'Each design as its whole matching set, with your photos.';
    // personalized designs: any already in the account come first; for now the offer
    $('#personal').innerHTML = `<div class="offer"><h3>Want your own design?</h3><p>We'll build a design from your brand or a piece you love, saved to your account for every listing.</p>
      <p><a href="mailto:support@brochuredesk.com?subject=${encodeURIComponent('Personalized design')}">Email support@brochuredesk.com</a></p></div>`;
    const list = await eligible();
    $('#sets').innerHTML = list.map(({d}) => `<div class="dset" data-design="${d.id}"><div class="row"><h3>${esc(d.name)}${d.test ? '<span class="badge">test</span>' : ''}</h3>
      <button class="btn" type="button" data-use="${d.id}">Use this design</button></div><div class="minis${ps.length === 1 ? ' one' : ''}"></div></div>`).join('')
      || '<p class="empty">No design has this piece yet.</p>';
    for(const {d, S} of list){
      const parts = ps.map(lid => partsFor(S, lid, pkg)[0]);
      const box = $(`.dset[data-design="${d.id}"] .minis`);
      drawParts(box, d.id, parts.map((pt, i) => Object.assign({}, pt, {label: pieceLabel(ps[i])})), await dataFor(d.id, false));
      box.querySelectorAll('figcaption').forEach((c, i) => c.textContent = pieceLabel(ps[i]));
    }
    $$('[data-use]').forEach(b => b.onclick = () => { pkg.design = b.dataset.use; save(); openRough(); });
    // the open house library shows only when an Open House flyer is in the order
    const oh = ps.includes('open-house-flyer');
    $('#ohLibrary').hidden = !oh;
    if(oh){
      const items = [];
      for(const {d, S} of list) S.pieces.filter(p => p.candidate && p.variant === 'openhouse').forEach(p => items.push({d, p}));
      $('#ohList').innerHTML = items.map(({d, p}, i) => `<div class="dset"><div class="minis one" data-oh="${i}"></div><div class="row"><small>${esc(p.title || p.label)} <span class="badge">test</span></small>
        <button class="link" type="button" data-pickoh="${i}">${pkg.ohFlyer && pkg.ohFlyer.piece === p.id ? 'Picked' : 'Use this one'}</button></div></div>`).join('')
        + '<p class="fine">The 60-flyer library (templates/oh-library) plugs in here once it is published to the site.</p>';
      for(const [i, {d, p}] of items.entries()) drawParts($(`[data-oh="${i}"]`), d.id, [{piece: p, label: p.title}], await dataFor(d.id, false));
      $$('[data-pickoh]').forEach(b => b.onclick = () => { const it = items[b.dataset.pickoh]; pkg.ohFlyer = {design: it.d.id, piece: it.p.id}; pkg.design = it.d.id; save(); openRough('open-house-flyer'); });
    }
  }

  // ---------- 3. rough-draft proof ----------
  let roughPiece = null, selPhoto = null, dragPhoto = null, dragSlot = null;
  async function openRough(start){
    if(!pkg.design){ const l = await eligible(); pkg.design = l[0] ? l[0].d.id : 'ivory'; }
    pkg.stage = pkg.stage === 'writing' ? 'rough' : pkg.stage;
    show('vRough');
    const ps = piecesOf(pkg);
    roughPiece = start || (ps.includes(roughPiece) ? roughPiece : ps[0]);   // full package opens on the fold-over
    $('#roughPiece').innerHTML = ps.map(id => `<option value="${id}"${id === roughPiece ? ' selected' : ''}>${pieceLabel(id)}</option>`).join('');
    $('#roughTitle').textContent = `Rough draft: ${pkg.listing.address}`;
    $('#copyStyle').value = pkg.copyStyle; $('#styleSample').textContent = `Sounds like: "${STYLE_SAMPLE[pkg.copyStyle]}"`;
    swatches(); await designTabs(); drawStrip(); await fontBox(); await drawRough();
  }
  $('#roughPiece').onchange = e => { roughPiece = e.target.value; drawRough(); };
  async function designTabs(){
    const l = await eligible();
    $('#designFlip').innerHTML = l.map(({d}) => `<button type="button" role="tab" aria-selected="${d.id === pkg.design}" data-flip="${d.id}">${esc(d.name)}${d.test ? ' (test)' : ''}</button>`).join('');
    $$('[data-flip]').forEach(b => b.onclick = async () => { pkg.design = b.dataset.flip; save(); await designTabs(); drawStrip(); await fontBox(); drawRough(); });
  }
  function swatches(){
    const box = $('#swatches');
    box.innerHTML = COLORS.map(c => `<button type="button" style="background:${c}" aria-label="Color ${c}" aria-pressed="${c.toLowerCase() === pkg.brand.accent.toLowerCase()}" data-color="${c}"></button>`).join('')
      + `<input type="color" value="${pkg.brand.accent}" aria-label="Pick any color" id="colorAny">`;
    $$('[data-color]').forEach(b => b.onclick = () => setColor(b.dataset.color));
    $('#colorAny').oninput = e => setColor(e.target.value);
  }
  let colorTimer = null;
  function setColor(c){ pkg.brand.accent = c; save(); $$('[data-color]').forEach(b => b.setAttribute('aria-pressed', b.dataset.color.toLowerCase() === c.toLowerCase()));
    clearTimeout(colorTimer); colorTimer = setTimeout(drawRough, 120); }
  async function fontBox(){
    const fs = await fontSpec(pkg.design);
    $('#fontsCtl').hidden = !fs || !window.FontPicker;
    if($('#fontsCtl').hidden) return;
    catalog = catalog || await fetch('/fonts/pool/catalog.json').then(r => r.json());
    FontPicker.mount($('#fonts'), {spec: fs, catalog, fontBase: '/fonts/pool/', value: fontsFor(pkg, fs), onChange: v => {
      pkg.brand.fonts = Object.assign({}, pkg.brand.fonts, v); save(); drawRough(); }});
  }
  $('#copyStyle').onchange = e => { pkg.copyStyle = e.target.value; $('#styleSample').textContent = `Sounds like: "${STYLE_SAMPLE[pkg.copyStyle]}"`; save(); };
  function drawStrip(){
    const arr = arrangement(pkg, pkg.design);
    $('#thumbs').innerHTML = pkg.photos.map((ph, i) => `<img src="${esc(photoUrlNow(ph.url))}" alt="${esc(ph.desc || 'Photo ' + (i + 1))}" title="${esc(ph.desc || '')}" draggable="true" data-ph="${i}" class="${arr.includes(i) ? '' : 'unused'}${selPhoto === i ? ' sel' : ''}">`).join('');
    $$('#thumbs img').forEach(img => {
      img.ondragstart = e => { dragPhoto = +img.dataset.ph; dragSlot = null; e.dataTransfer.setData('text/plain', 'bd-photo'); e.dataTransfer.effectAllowed = 'move'; };
      img.onclick = () => { selPhoto = selPhoto === +img.dataset.ph ? null : +img.dataset.ph; drawStrip(); };
    });
    photosReady.then(() => $$('#thumbs img').forEach(img => { if(!img.getAttribute('src')) img.src = photoUrlNow(pkg.photos[img.dataset.ph].url); }));
  }
  const strip = $('#strip');
  ['dragenter', 'dragover'].forEach(t => strip.addEventListener(t, e => { if(dragSlot != null){ e.preventDefault(); strip.classList.add('over'); } }));
  strip.addEventListener('dragleave', () => strip.classList.remove('over'));
  strip.addEventListener('drop', e => { e.preventDefault(); strip.classList.remove('over'); if(dragSlot != null) removePhoto(dragSlot); dragSlot = null; });
  function placePhoto(x, slot){
    const arr = arrangement(pkg, pkg.design), y = arr.indexOf(slot), at = arr.indexOf(x);
    if(y < 0 || x === slot) return;
    if(at >= 0){ arr[at] = slot; arr[y] = x; } else arr[y] = x;
    selPhoto = null; save(); drawStrip(); drawRough();
  }
  function removePhoto(i){
    const arr = arrangement(pkg, pkg.design);
    if(arr.length <= 1) return;
    arr.splice(arr.indexOf(i), 1); save(); drawStrip(); drawRough();
  }
  async function drawRough(){
    const S = await spec(pkg.design); S.design = pkg.design;
    const parts = partsFor(S, roughPiece, pkg);
    const box = $('#roughProof');
    box.className = 'proof ' + (roughPiece === 'foldover' ? 'fold' : parts.length > 1 ? 'two' : 'single');
    await drawParts(box, pkg.design, parts, await dataFor(pkg.design, false), wirePhotos);
  }
  // photo slots on the proof: drop targets, draggable off the proof, click-to-place
  function wirePhotos(fr){
    const doc = fr.contentDocument;
    const st = doc.createElement('style');
    st.textContent = '[data-photo]{cursor:pointer}[data-photo].bd-over{outline:4px solid #1F4D3F;outline-offset:-4px}';
    doc.head.appendChild(st);
    doc.querySelectorAll('[data-photo]').forEach(el => {
      const id = el.dataset.photo; if(!/^p\d+$/.test(id)) return;
      const slot = +id.slice(1);
      el.draggable = true;
      el.addEventListener('dragstart', e => { dragSlot = slot; dragPhoto = null; e.dataTransfer.setData('text/plain', 'bd-slot'); e.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('dragend', () => { setTimeout(() => { dragSlot = null; }, 0); });
      el.addEventListener('dragover', e => { if(dragPhoto != null || dragSlot != null){ e.preventDefault(); el.classList.add('bd-over'); } });
      el.addEventListener('dragleave', () => el.classList.remove('bd-over'));
      el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('bd-over');
        if(dragPhoto != null) placePhoto(dragPhoto, slot); else if(dragSlot != null && dragSlot !== slot) placePhoto(dragSlot, slot);
        dragPhoto = null; dragSlot = null; });
      el.addEventListener('click', () => {
        if(selPhoto != null) return placePhoto(selPhoto, slot);
        ask(`<h2>This photo</h2><p>${esc(pkg.photos[slot].desc || 'Listing photo')}</p><p class="fine">To swap it, click a photo in the strip, then click this spot.</p>`,
          [['Take it out of the design', 'out'], ['Keep it', 'keep', 'line']]).then(v => { if(v === 'out') removePhoto(slot); });
      });
    });
  }

  // ---------- Finalize: the AI work starts here ----------
  $('#finalize').onclick = finalize;
  $('#writeRetry').onclick = finalize;
  $('#backToRough').onclick = () => openRough(finalPiece);
  async function finalize(){
    show('vWriting');
    $('#writeErr').textContent = ''; $('#writeRetry').hidden = true;
    pkg.stage = 'writing'; save();
    store.event(pkg.id, 'finalize', {design: pkg.design, kind: pkg.order.kind});
    const lines = ['Reading your listing facts and photos…', 'Writing the brochure…', 'Writing the flyers and postcard…',
      'Checking every line: Fair Housing, no price, plain English…', 'Laying it all out…'];
    let i = 0; const tick = () => { $('#writeStatus').textContent = lines[Math.min(i, lines.length - 1)]; $('#writeFill').style.width = Math.min(92, 10 + i * 18) + '%'; i++; };
    tick(); const timer = setInterval(tick, 9000);
    try {
      const ex = await example(pkg.design);
      const d = await dataFor(pkg.design, false);
      const arr = arrangement(pkg, pkg.design);
      const body = {action: 'write', packageId: pkg.id, design: pkg.design, style: pkg.copyStyle, listing: pkg.listing,
        photos: Object.fromEntries(arr.map(i => ['p' + i, pkg.photos[i].desc || ''])),
        example: ex, draft: {copy: d.copy, companion: d.companion}, pieces: piecesOf(pkg).map(pieceLabel)};
      const j = await ai(body);
      pkg.copy[pkg.design] = {copy: j.copy, companion: j.companion, writtenAt: new Date().toISOString(), cost: j.cost};
      pkg.stage = 'final'; save(true);
      clearInterval(timer); $('#writeFill').style.width = '100%';
      openFinal(piecesOf(pkg)[0]);
    } catch(e) {
      clearInterval(timer);
      pkg.stage = 'rough'; save();
      $('#writeErr').textContent = e.message === 'daily-cap' ? "We've hit today's writing limit for test drives. Try again tomorrow." : "We couldn't finish writing just now. Your design is saved; try again.";
      $('#writeRetry').hidden = false;
    }
  }
  async function ai(body){
    const headers = {'content-type': 'application/json'};
    if(me){ const {data} = await sb.auth.getSession(); if(data.session) headers.authorization = 'Bearer ' + data.session.access_token; }
    let r;
    try { r = await fetch(FN_AI, {method: 'POST', headers, body: JSON.stringify(body)}); } catch(e) { throw new Error('network'); }
    const j = await r.json().catch(() => ({ok: false, error: 'bad-reply'}));
    if(!j.ok) throw new Error(j.error || 'ai-failed');
    return j;
  }

  // ---------- 4. final proof ----------
  let finalPiece = null;
  function nextPiece(){ const ps = piecesOf(pkg); return ps.find(id => !pkg.approvals[id]) || ps[0]; }
  async function openFinal(piece){
    if(!pkg.copy[pkg.design]) return openRough();
    show('vFinal');
    const ps = piecesOf(pkg);
    finalPiece = piece && ps.includes(piece) ? piece : (ps.includes(finalPiece) ? finalPiece : nextPiece());
    $('#finalPiece').innerHTML = ps.map(id => `<option value="${id}"${id === finalPiece ? ' selected' : ''}>${pieceLabel(id)}${pkg.approvals[id] ? ' (approved)' : ''}</option>`).join('');
    $('#finalTitle').textContent = `Proof: ${pkg.listing.address}`;
    $('#backToRough').hidden = !!pkg.paid;
    ohFields(); approveBox(); await drawFinal();
  }
  $('#finalPiece').onchange = e => { finalPiece = e.target.value; ohFields(); approveBox(); drawFinal(); };
  async function drawFinal(){
    const S = await spec(pkg.design); S.design = pkg.design;
    const parts = partsFor(S, finalPiece, pkg);
    const box = $('#finalProof');
    box.className = 'proof ' + (finalPiece === 'foldover' ? 'fold' : parts.length > 1 ? 'two' : 'single');
    await drawParts(box, pkg.design, parts, await dataFor(pkg.design, true), wireText);
  }
  function ohFields(){
    const on = finalPiece === 'open-house-flyer';
    $('#ohFields').hidden = !on; if(!on) return;
    const o = pkg.openHouse; $('#ohKind').value = o.kind; $('#ohDate').value = o.date; $('#ohStart').value = o.start; $('#ohEnd').value = o.end;
    const w = windows(pkg), open = !w || !w.ohUntil || new Date() <= new Date(w.ohUntil);
    $$('#ohFields input, #ohFields select').forEach(x => x.disabled = !open);
  }
  ['ohKind', 'ohDate', 'ohStart', 'ohEnd'].forEach(id => $('#' + id).onchange = () => {
    pkg.openHouse = {kind: $('#ohKind').value, date: $('#ohDate').value, start: $('#ohStart').value, end: $('#ohEnd').value};
    save(); drawFinal();
  });

  // click any text the system wrote: Rewrite it myself / Guide AI
  const FIXED = /^(agent\.|broker\.|plan\.|back\.footnote|back\.disclosure|back\.room|back\.level|top\.stat|oh\.|event\.)/;
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  function leaves(node, path, out){
    if(typeof node === 'string') out.push([path, node]);
    else if(Array.isArray(node)) node.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
    else if(node && typeof node === 'object') for(const [k, v] of Object.entries(node)) if(!['photo', 'photos', 'flyerPhotos', 'variant', 'fineprint', 'footnote'].includes(k)) leaves(v, path ? `${path}.${k}` : k, out);
    return out;
  }
  function findPath(text){
    const w = pkg.copy[pkg.design], t = norm(text);
    if(!t) return null;
    const all = leaves({copy: w.copy, companion: w.companion}, '', []);
    return (all.find(([, v]) => norm(v) === t) || all.find(([, v]) => norm(v) && t.includes(norm(v)) && norm(v).length > 12) || [null])[0];
  }
  function getPath(root, path){ return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean).reduce((o, k) => o == null ? o : o[k], root); }
  function setPath(root, path, v){ const ks = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean); const last = ks.pop(); const o = ks.reduce((a, k) => a[k], root); o[last] = v; }
  function wireText(fr, sheet){
    const doc = fr.contentDocument;
    const st = doc.createElement('style');
    st.textContent = '[data-slot].bd-edit{cursor:text}[data-slot].bd-edit:hover{outline:1.5px dashed #1F4D3F;outline-offset:2px}';
    doc.head.appendChild(st);
    doc.querySelectorAll('[data-slot]').forEach(el => {
      if(FIXED.test(el.dataset.slot) || el.dataset.fine || !norm(el.textContent)) return;
      el.classList.add('bd-edit');
      el.addEventListener('click', e => { e.stopPropagation(); openPop(el, fr, sheet); });
    });
  }

  // ---------- the edit pop-over ----------
  let edit = null;
  const pop = $('#pop');
  function closePop(){ if(edit && edit.el && edit.orig != null){ edit.el.textContent = edit.shown; } pop.hidden = true; edit = null; }
  function limitOf(el){
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    const lines = +el.dataset.lines || Math.max(1, Math.round(el.clientHeight / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3)));
    const cpl = el.clientWidth / (parseFloat(cs.fontSize) * 0.5);
    return Math.max(12, Math.floor(lines * cpl * 0.97));
  }
  function overflowing(el){
    const w = el.ownerDocument.defaultView;
    try { if(w.brochureCheck) return w.brochureCheck().some(c => c.kind === 'overflow' && c.slot === el.dataset.slot); } catch(e) {}
    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  }
  function openPop(el, fr, sheet){
    closePop();
    const path = findPath(el.textContent);
    if(!path){ ask('<h2>From your listing</h2><p>This line comes from your listing facts or profile, so it changes there, not here.</p>', [['OK', 'ok']]); return; }
    if(pkg.paid && !fixesOpen(pkg)){ ask(`<h2>Fixes are closed</h2><p>Small fixes for this package closed on ${dayFmt(windows(pkg).fixesUntil)}. Email support@brochuredesk.com if you need a change.</p>`, [['OK', 'ok']]); return; }
    const text = getPath(pkg.copy[pkg.design], path);
    edit = {el, fr, path, orig: text, shown: el.textContent, limit: limitOf(el)};
    $('#popLabel').textContent = 'Change this text';
    $('#popChoose').hidden = false; $('#popEdit').hidden = true; $('#popAsk').hidden = true; $('#popSave').hidden = true; $('#popStatus').textContent = '';
    pop.hidden = false; placePop();
    $('#popSelf').focus();
  }
  function selfMode(text){
    $('#popChoose').hidden = true; $('#popAsk').hidden = true; $('#popEdit').hidden = false; $('#popSave').hidden = false;
    $('#popText').value = text; liveCount(); $('#popText').focus(); $('#popText').select(); placePop();
  }
  // keep the pop-over on screen as it grows
  function placePop(){
    if(!edit) return;
    const r = edit.el.getBoundingClientRect(), f = edit.fr.getBoundingClientRect(), k = +edit.fr.parentNode.dataset.k || 1;
    const x = f.left + r.left * k, below = f.top + r.bottom * k + 8, above = f.top + r.top * k - pop.offsetHeight - 8;
    pop.style.left = Math.max(16, Math.min(x, innerWidth - pop.offsetWidth - 16)) + 'px';
    pop.style.top = Math.max(16, below + pop.offsetHeight <= innerHeight - 16 ? below : above > 16 ? above : innerHeight - pop.offsetHeight - 16) + 'px';
  }
  function liveCount(){
    if(!edit) return;
    const v = $('#popText').value, n = v.length;
    edit.el.textContent = v;                          // live on the proof; type never shrinks to fit
    const over = n > edit.limit || overflowing(edit.el);
    $('#popCount').textContent = `${n} / ${edit.limit} characters`;
    $('#popCount').classList.toggle('over', over);
    $('#popShorten').hidden = !over;
  }
  $('#popSelf').onclick = () => selfMode(edit.orig);
  $('#popGuide').onclick = () => { $('#popChoose').hidden = true; $('#popAsk').hidden = false; $('#popInstr').value = ''; $('#popInstr').focus(); placePop(); };
  $('#popText').oninput = liveCount;
  $('#popCancel').onclick = closePop;
  async function aiSpot(action, extra){
    $('#popStatus').textContent = action === 'shorten' ? 'Shortening…' : 'Rewriting…';
    try {
      const j = await ai(Object.assign({action, packageId: pkg.id, text: $('#popEdit').hidden ? edit.orig : $('#popText').value, max: edit.limit,
        label: edit.el.dataset.slot, listing: pkg.listing, photos: [...new Set(pkg.photos.map(p => p.desc).filter(Boolean))]}, extra));
      selfMode(j.text);
      $('#popStatus').textContent = j.flagged && j.flagged.length ? `Check this one: ${j.flagged[0]}.` : 'Here it is. Change anything, then Save.';
    } catch(e) { $('#popStatus').textContent = "That didn't work just now. Try again, or type it yourself."; }
  }
  $('#popAskGo').onclick = () => { const t = $('#popInstr').value.trim(); if(!t){ $('#popInstr').focus(); return; } aiSpot('rewrite', {instructions: t}); };
  $('#popShorten').onclick = () => aiSpot('shorten', {});
  $('#popSave').onclick = () => {
    const v = $('#popText').value.trim();
    setPath(pkg.copy[pkg.design], edit.path, v);
    pkg.edits = (pkg.edits || 0) + 1;
    edit.orig = null; pop.hidden = true; edit = null;
    save(); drawFinal();
  };
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !pop.hidden) closePop(); });
  document.addEventListener('mousedown', e => { if(!pop.hidden && !pop.contains(e.target) && !e.target.closest('dialog')) closePop(); });

  // ---------- 5. approve and order ----------
  function approveBox(){
    const a = pkg.approvals[finalPiece], w = windows(pkg), btn = $('#approve');
    $('#pieceState').className = 'pstate' + (a ? ' ok' : '');
    $('#pieceState').textContent = a ? `Approved ${dayFmt(a)}` : pkg.paid ? 'Not approved yet' : '';
    btn.hidden = !!a;
    btn.textContent = pkg.paid ? 'Approve this piece' : `Approve and order · ${money(PRICE[pkg.order.kind])}`;
    $('#approveNote').hidden = !!a;
    $('#windowNote').textContent = w ? `${w.all ? 'Small fixes' : 'Fixes and approvals'} open until ${dayFmt(w.fixesUntil)}.` + (w.ohUntil ? ` Open house details can be updated until ${dayFmt(w.ohUntil)}.` : '') : '';
    if(a && finalPiece === 'foldover') $('#windowNote').insertAdjacentHTML('beforeend', ' <button type="button" class="link" id="redeliver">Printer, email or download</button>');
    const rd = $('#redeliver'); if(rd) rd.onclick = deliverFoldover;
  }
  $('#approve').onclick = async () => {
    if(finalPiece === 'open-house-flyer' && !(pkg.openHouse.date && pkg.openHouse.start && pkg.openHouse.end)){
      await ask('<h2>Add the open house first</h2><p>Fill in the date and times on the right, then approve the flyer. You can change them for free for a year.</p>', [['OK', 'ok']]);
      $('#ohDate').focus(); return;
    }
    if(!pkg.paid){
      if(pkg.order.kind === 'full' && finalPiece !== 'foldover'){
        const p = PIECES.find(x => x.id === finalPiece);
        const v = await ask(`<h2>Just need this ${p.short}?</h2><p>Get it alone for $10, or the full package for $25.</p>`,
          [[`Just this ${p.short}, $10`, 'single'], ['The full package, $25', 'full', 'line'], ['Cancel', 'cancel', 'line']]);
        if(v === 'cancel' || !v) return;
        if(v === 'single'){ pkg.order = Object.assign({}, pkg.order, {kind: 'single', piece: finalPiece}); }
      }
      if(!await checkout()) return;
    }
    pkg.approvals[finalPiece] = new Date().toISOString();
    store.event(pkg.id, 'approve', {piece: finalPiece, edits: pkg.edits || 0});
    save(true);
    const justPaid = pkg.paid && Object.keys(pkg.approvals).length === 1;
    if(finalPiece === 'foldover') await deliverFoldover();
    const rest = piecesOf(pkg).filter(id => !pkg.approvals[id]);
    if(justPaid && rest.length) return otherPieces(rest);
    if(rest.length) return openFinal(rest[0]);
    openFinal(finalPiece);
  };
  async function checkout(){
    const c = PRICE[pkg.order.kind];
    const what = pkg.order.kind === 'single' ? pieceLabel(pkg.order.piece) : KIND_LABEL[pkg.order.kind];
    const v = await ask(`<h2>Order: ${money(c)}</h2><p>${esc(what)} for ${esc(pkg.listing.address)}, in ${esc((designs.find(d => d.id === pkg.design) || {}).name || pkg.design)}.</p>
      <p class="fine"><b>Test checkout:</b> no card is charged. On the live site this step is Stripe.</p>`, [[`Pay ${money(c)} (test)`, 'pay'], ['Cancel', 'cancel', 'line']]);
    if(v !== 'pay') return false;
    pkg.paid = {at: new Date().toISOString(), cents: c, kind: pkg.order.kind, test: true};
    pkg.stage = 'ordered';
    store.event(pkg.id, 'order', {cents: c, kind: pkg.order.kind, piece: pkg.order.piece, test: true});
    save(true);
    return true;
  }
  async function deliverFoldover(){
    const v = await ask('<h2>Your brochure is approved</h2><p>Where should it go?</p>',
      [['Upload it to my printer now', 'printer'], ['Email me the PDF', 'email', 'line'], ['Download it', 'download', 'line']], true);
    if(!v) return;
    pkg.delivery.foldover = {how: v, at: new Date().toISOString()};
    store.event(pkg.id, 'delivery', {how: v});
    save();
    if(v === 'printer') await ask('<h2>Upload to your printer</h2><p class="fine"><b>Test:</b> printer uploads aren\'t built yet. On the live site you pick your printer here and we put the brochure in its cart, ready for you to pay.</p>', [['OK', 'ok']]);
    if(v === 'email') await ask(`<h2>Emailing your PDF</h2><p class="fine"><b>Test:</b> nothing is sent from the test drive. On the live site the print PDF goes to ${esc((profile && profile.preferred_email) || (me && me.email) || 'your email')}.</p>`, [['OK', 'ok']]);
    if(v === 'download') await printPiece('foldover');
  }
  // download: the browser's print box opens on the brochure, set to Save as PDF (the server-made print PDF comes later)
  async function printPiece(lid){
    const S = await spec(pkg.design); S.design = pkg.design;
    const pt = partsFor(S, lid, pkg)[0];
    const data = Object.assign(await dataFor(pkg.design, true), pt.piece.kind === 'foldover' ? {mode: 'proof'} : {mode: 'email', piece: pt.piece});
    const html = srcdoc(pkg.design, await tpl(pkg.design, pt.piece.file), data, null, true)
      .replace('</head>', '<style>@media print{body{margin:0}.page{margin:0!important;box-shadow:none!important;break-after:page}}</style></head>');
    document.querySelectorAll('iframe.bd-print').forEach(f => f.remove());
    const fr = document.createElement('iframe');
    fr.className = 'bd-print'; fr.setAttribute('aria-hidden', 'true');
    fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0';
    fr.onload = () => Promise.resolve(fr.contentWindow.brochureReady)
      .then(() => fr.contentDocument.fonts ? fr.contentDocument.fonts.ready : 0)
      .then(() => setTimeout(() => fr.contentWindow.print(), 300));
    document.body.appendChild(fr);
    fr.srcdoc = html;
  }
  async function otherPieces(rest){
    const S = await spec(pkg.design); S.design = pkg.design;
    const v = await ask(`<h2>Ready to review and tweak your other marketing pieces?</h2><p>The rest of your package, in the same design:</p><div class="minirow" id="restMinis"></div>`,
      [['Review them now', 'now'], ['Later', 'later', 'line']], false, async () => {
        const box = $('#restMinis');
        drawParts(box, pkg.design, rest.map(id => Object.assign({}, partsFor(S, id, pkg)[0], {label: pieceLabel(id)})), await dataFor(pkg.design, true));
        setTimeout(() => box.querySelectorAll('figcaption').forEach((c, i) => c.textContent = pieceLabel(rest[i])), 50);
      });
    if(v === 'now') return openFinal(rest[0]);
    store.event(pkg.id, 'later', {waiting: rest});
    openHome();
  }

  // ---------- small dialog helper ----------
  function ask(html, buttons, column, after){
    const dlg = $('#dlg'), body = $('#dlgBody');
    body.innerHTML = html + `<div class="${column ? 'opts' : 'acts'}">${buttons.map(([t, v, cls]) => `<button type="button" class="btn ${cls || ''}" value="${v}">${esc(t)}</button>`).join('')}</div>`;
    return new Promise(res => {
      let done = false;
      const finish = v => { if(done) return; done = true; if(dlg.open) dlg.close(); res(v); };
      body.querySelectorAll('button[value]').forEach(b => b.onclick = () => finish(b.value));
      dlg.oncancel = e => { e.preventDefault(); finish(null); };   // Escape
      dlg.showModal();
      if(after) after();
    });
  }

  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if(h === 'home') openHome();
    else if(h === 'start') openStart();
  });
  boot().catch(e => { console.error(e); show('vSignin'); });
})();
