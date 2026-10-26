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
  const MAX_PHOTOS = 16, PHOTO_W = 900, ALL_PHOTOS = 60;
  // photo picker (brief preview-and-lookup-10-24): about 13 photos go in the package; the rest wait in the lower box
  const PICK_CAP = 13;
  const PICK_FULL = 'You need to remove an active photo to pull in a new photo.';   // the owner's wording; don't change without asking
  const PICK_LABELS = {upper: 'In your package', lower: 'More listing photos'};     // draft wording
  const PLAN_NOTE = "Your floor plan will be redrawn in this design's style.";      // draft wording (the owner's call)
  const PT = window.PreviewTools;
  const FINE_PRINT = 'Information deemed reliable but not guaranteed.';
  const PRICE = {full: 2500, essentials: 2000, single: 1000};
  const KIND_LABEL = {full: 'Full package', essentials: 'The Essentials', single: 'Single piece'};
  const PIECES = [
    {id: 'foldover', label: 'Fold-over brochure', short: 'brochure'},
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
  const VIEWS = ['vSignin', 'vHome', 'vStart', 'vGallery', 'vLib', 'vRough', 'vWriting', 'vFinal', 'vRebrand'];
  function show(id){
    VIEWS.forEach(v => $('#' + v).hidden = v !== id);
    closePop();
    const hash = {vHome: 'home', vStart: 'start', vGallery: 'gallery', vLib: 'library', vRough: 'rough', vFinal: 'final'}[id];
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
    $('#switchLine').onclick = () => openRebrand();
    const note = lget(NOTE_KEY(), null);
    $('#switchNote').hidden = !note;
    if(note){
      $('#switchNote').innerHTML = `<h2>New brokerage?</h2><p>Your profile shows ${esc(note.to || 'a new sponsoring broker')}. We'll update the pieces you've ordered for free.</p>
        <p><button class="btn" type="button" id="noteGo">Update my pieces</button> <button class="link" type="button" id="noteNo">Not now</button></p>`;
      lput(NOTE_KEY(), null);   // shown once
      $('#noteGo').onclick = () => openRebrand(); $('#noteNo').onclick = () => { $('#switchNote').hidden = true; };
    }
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
  // ---------- brokerage switch: free rebrand (brief brokerage-switch-and-matrix-links-10-24) ----------
  // The agent's brand kit (brokerage, logo, colors, office, TREC sponsoring broker, contact) feeds every piece. Changing
  // brokerages updates it once; then any past order from the last 2 years re-renders in the new brand for free (data
  // fields only: no writer, reviewer or photo read), with before and after proofs, and goes to the printer the usual way.
  // Test page: the kit lives in this browser (agent_profiles.brand_kit once the 10/25 migration runs).
  const KIT_KEY = () => 'bd-brand-kit:' + (me ? me.id : 'local'), NOTE_KEY = () => 'bd-switch-note:' + (me ? me.id : 'local');
  let kitOverride;   // a render for one brand (the rebrand's before and after)
  const brandKit = () => lget(KIT_KEY(), null);
  function kitBrand(k){
    if(!k) return {};
    const o = {brokerage: k.brokerage, logo: k.logo, logoOnDark: k.logoOnDark || k.logo, phone: k.officePhone, web: k.officeWeb, address: k.officeAddress,
      sponsoringBroker: k.sponsoringBroker, sample: false};
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));
  }
  function saveKit(k){
    const old = brandKit();
    lput(KIT_KEY(), k);
    if(sb && me) sb.from('agent_profiles').update({brand_kit: k}).eq('user_id', me.id).then(({error}) => { if(error) console.warn('brand kit not saved to the account yet', error.message); });
    // watch for switches: a new sponsoring broker shows a one-time note on the next visit to Agent home
    if(old && k.sponsoringBroker && old.sponsoringBroker && k.sponsoringBroker !== old.sponsoringBroker) lput(NOTE_KEY(), {to: k.sponsoringBroker, at: new Date().toISOString()});
  }
  // the logo's own colors, most used first (near-white, near-black and see-through pixels left out)
  async function logoColors(src){
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const k = Math.min(1, 160 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    const g = c.getContext('2d', {willReadFrequently: true}); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data, bins = new Map();
    for(let i = 0; i < d.length; i += 4){
      if(d[i + 3] < 200) continue;
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if(mn > 235 || mx < 25) continue;
      const key = [d[i], d[i + 1], d[i + 2]].map(v => v >> 4).join(','), b = bins.get(key) || {n: 0, r: 0, g: 0, b: 0};
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; bins.set(key, b);
    }
    const hex = b => '#' + [b.r, b.g, b.b].map(v => Math.round(v / b.n).toString(16).padStart(2, '0')).join('');
    const out = [];
    for(const b of [...bins.values()].sort((x, y) => y.n - x.n)){
      const h = hex(b), far = out.every(o => { const a = parseInt(o.slice(1), 16), q = parseInt(h.slice(1), 16);
        return Math.abs((a >> 16) - (q >> 16)) + Math.abs((a >> 8 & 255) - (q >> 8 & 255)) + Math.abs((a & 255) - (q & 255)) > 90; });
      if(far) out.push(h); if(out.length === 3) break;
    }
    return out.length ? out : ['#1f4e5f'];
  }
  const fileUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  const RB_STEPS = ['Upload your new brokerage logo.', 'Update your contact info.', 'Pick the pieces to update.', 'Review your updated pieces.', 'Send to my printer.'];
  let rb = null;
  async function openRebrand(){
    show('vRebrand');
    const k = brandKit() || {};
    rb = {step: 0, kit: JSON.parse(JSON.stringify(k)), old: k, orders: [], picks: new Set(), designFor: {}};
    rb.kit.contact = Object.assign({email: (profile && profile.preferred_email) || '', phone: (profile && profile.cell) || '', web: ''}, k.contact || {});
    try { rb.orders = (await store.list()).filter(p => p.paid && new Date(p.paid.at) >= new Date(addDays(new Date().toISOString(), -730))); } catch(e) { rb.orders = []; }
    rb.picks = new Set(rb.orders.map(p => p.id));   // all checked by default
    rbDraw();
  }
  function rbDraw(){
    $('#rbSteps').innerHTML = RB_STEPS.map((t, i) => `<li class="${i < rb.step ? 'done' : i === rb.step ? 'on' : ''}">${t.replace(/\.$/, '')}</li>`).join('');
    [rbLogo, rbContact, rbPick, rbReview, rbSend][rb.step]();
    window.scrollTo({top: 0});
  }
  const rbNav = (next, back) => `<p class="acts">${back ? '<button type="button" class="btn line" id="rbBack">Back</button>' : ''}<button type="button" class="btn" id="rbNext">${next}</button></p>`;
  function rbWire(onNext){
    const b = $('#rbBack'); if(b) b.onclick = () => { rb.step--; rbDraw(); };
    $('#rbNext').onclick = async () => { if(await onNext() !== false){ rb.step++; rbDraw(); } };
  }
  function rbLogo(){
    const K = rb.kit, cs = K.colors || [];
    $('#rbBody').innerHTML = `<h2>${RB_STEPS[0]}</h2>
      <div class="stack2">
        <label>Brokerage logo (PNG, JPG or SVG)<input type="file" id="rbLogo" accept="image/png,image/jpeg,image/svg+xml"></label>
        ${K.logo ? `<img class="rb-logo" src="${esc(K.logo)}" alt="Your new brokerage logo">` : ''}
        <div id="rbColors">${cs.length ? `<p>Do these colors look right?</p><div class="rb-colors">${cs.map((c, i) => `<input type="color" value="${c}" data-ci="${i}" aria-label="Brand color ${i + 1}">`).join('')}
          <button type="button" class="link" id="rbColorsOk">${K.colorsOk ? 'Colors confirmed' : 'Yes, use these'}</button></div>` : ''}</div>
        <label>Brokerage name<input id="rbName" value="${esc(K.brokerage || '')}" autocomplete="organization"></label>
        <label>Office address<input id="rbAddr" value="${esc(K.officeAddress || '')}"></label>
        <label>Office phone<input id="rbOPhone" value="${esc(K.officePhone || '')}" inputmode="tel"></label>
        <label>Office website<input id="rbOWeb" value="${esc(K.officeWeb || '')}"></label>
        <label>Sponsoring broker (as licensed with TREC)<input id="rbBroker" value="${esc(K.sponsoringBroker || '')}"></label>
        <p class="gray">The TREC license lookup fills this in once it's connected; for now, type it as TREC lists it.</p>
      </div><p class="err" id="rbErr"></p>${rbNav('Next')}`;
    $('#rbLogo').onchange = async e => { const f = e.target.files[0]; if(!f) return;
      K.logo = await fileUrl(f); K.colors = await logoColors(K.logo).catch(() => ['#1f4e5f']); K.colorsOk = false; rbLogo(); };
    $$('[data-ci]').forEach(i => i.oninput = () => { K.colors[+i.dataset.ci] = i.value; K.colorsOk = true; });
    const ok = $('#rbColorsOk'); if(ok) ok.onclick = () => { K.colorsOk = true; ok.textContent = 'Colors confirmed'; };
    rbWire(() => {
      Object.assign(K, {brokerage: $('#rbName').value.trim(), officeAddress: $('#rbAddr').value.trim(), officePhone: $('#rbOPhone').value.trim(),
        officeWeb: $('#rbOWeb').value.trim(), sponsoringBroker: $('#rbBroker').value.trim()});
      if(!K.logo || !K.brokerage){ $('#rbErr').textContent = 'Add the new logo and the brokerage name first.'; return false; }
      K.colorsOk = true;
    });
  }
  function rbContact(){
    const C = rb.kit.contact;
    $('#rbBody').innerHTML = `<h2>${RB_STEPS[1]}</h2><div class="stack2">
      <label>Email<input id="rbEmail" type="email" value="${esc(C.email || '')}" autocomplete="email"></label>
      <label>Phone<input id="rbPhone" value="${esc(C.phone || '')}" inputmode="tel" autocomplete="tel"></label>
      <label>Website<input id="rbWeb" value="${esc(C.web || '')}" autocomplete="url"></label></div>${rbNav('Next', true)}`;
    rbWire(async () => {
      const email = $('#rbEmail').value.trim(), before = (rb.old.contact || {}).email || (profile && profile.preferred_email) || '';
      Object.assign(C, {email, phone: $('#rbPhone').value.trim(), web: $('#rbWeb').value.trim()});
      if(email && before && email.toLowerCase() !== before.toLowerCase()){
        const v = await ask('<h2>Use this new email to sign in too?</h2><p>Your account, profile and order history stay the same.</p>', [['Yes', 'yes'], ['No, just on my pieces', 'no', 'line']]);
        rb.newLogin = v === 'yes' ? email : null;
      }
    });
  }
  // a past order's design that belonged to the old brokerage (its personalized design or portal kit) can't come along
  const ownedDesign = p => { const d = designs.find(x => x.id === p.design); return !!(d && d.owner && d.owner !== 'standard'); };
  function closestDesigns(p){
    const was = designs.find(x => x.id === p.design) || {}, score = d => ['layout', 'photos', 'fold', 'plan', 'look'].reduce((n, k) => n + (was[k] != null && was[k] === d[k] ? 1 : 0), 0);
    return designs.filter(d => !d.library && !(d.owner && d.owner !== 'standard')).sort((a, b) => score(b) - score(a)).slice(0, 5);
  }
  function rbPick(){
    const tile = p => { const cover = p.photos[0] ? photoUrlNow(p.photos[0].url) : '';
      return `<label class="rb-tile"><input type="checkbox" data-rb="${p.id}"${rb.picks.has(p.id) ? ' checked' : ''}>${cover ? `<img src="${esc(cover)}" alt="">` : ''}
        <span><b>${esc(p.listing.address)}</b><small>Ordered ${dayFmt(p.paid.at)}</small><small>${piecesOf(p).map(pieceLabel).join(', ')}</small></span></label>`; };
    $('#rbBody').innerHTML = `<h2>${RB_STEPS[2]}</h2>` + (rb.orders.length ? `<div class="rb-grid">${rb.orders.map(tile).join('')}</div>`
      : '<p class="empty">No orders from the last 2 years yet. Your new brand is saved for every new package.</p>') + `<p class="err" id="rbErr"></p>` + rbNav(rb.orders.length ? 'Next' : 'Save my new brand', true);
    $$('[data-rb]').forEach(c => c.onchange = () => { c.checked ? rb.picks.add(c.dataset.rb) : rb.picks.delete(c.dataset.rb); });
    rbWire(() => {
      if(!rb.orders.length){ rbFinish([]); openHome(); return false; }
      if(!rb.picks.size){ $('#rbErr').textContent = 'Pick at least one order, or go back to Agent home.'; return false; }
    });
  }
  async function rbReview(){
    const list = rb.orders.filter(p => rb.picks.has(p.id));
    $('#rbBody').innerHTML = `<h2>${RB_STEPS[3]}</h2><p class="fine">Before on the left, your new brand on the right. Copy, photos, crops and the floor plan stay as you ordered them.</p>` +
      list.map(p => `<section data-rbp="${p.id}"><h3>${esc(p.listing.address)}</h3>${ownedDesign(p) ? `<div class="offer" data-closest="${p.id}"></div>` : ''}
        ${piecesOf(p).map(lid => `<div class="rb-pair" data-lid="${lid}"><div><h4>${esc(pieceLabel(lid))}, before</h4><div class="proof single" data-side="before"></div></div>
          <div><h4>After</h4><div class="proof single" data-side="after"></div></div></div>`).join('')}</section>`).join('') + rbNav('Looks good', true);
    rbWire(() => {});
    const keep = pkg;
    for(const p of list){
      if(ownedDesign(p)){   // that design stays with the old brokerage: our five closest, then the whole gallery
        const box = $(`[data-closest="${p.id}"]`), near = closestDesigns(p);
        box.innerHTML = `<h3>Closest to what you had</h3><div class="rb-colors">${near.map(d => `<button type="button" class="btn line" data-swap="${p.id}:${d.id}">${esc(d.name)}</button>`).join('')}</div>
          <p class="fine">Or pick any of our designs: ${designs.filter(d => !d.library && !(d.owner && d.owner !== 'standard')).map(d => `<button type="button" class="link" data-swap="${p.id}:${d.id}">${esc(d.name)}</button>`).join(' · ')}</p>`;
        rb.designFor[p.id] = rb.designFor[p.id] || (near[0] && near[0].id);
      }
      const after = Object.assign({}, p, {design: rb.designFor[p.id] || p.design, brand: Object.assign({}, p.brand, {accent: (rb.kit.colors || [])[0] || p.brand.accent})});
      for(const lid of piecesOf(p)){
        for(const [side, P, kit] of [['before', p, p.brandAtOrder || null], ['after', after, rb.kit]]){
          pkg = P; resolvePhotos(P); kitOverride = kit;
          try {
            const S = await spec(P.design); S.design = P.design;
            const parts = partsFor(S, lid, P);
            const box = $(`[data-rbp="${p.id}"] [data-lid="${lid}"] [data-side="${side}"]`);
            const part = parts && (parts.find(x => /back/i.test(x.panel || x.label || '')) || parts[0]);   // the side with the contact card
            if(part && box) await drawParts(box, P.design, [part], await dataFor(P.design, true));
          } finally { kitOverride = undefined; }
        }
      }
    }
    pkg = keep;
    $$('[data-swap]').forEach(b => b.onclick = () => { const [id, d] = b.dataset.swap.split(':'); rb.designFor[id] = d; rbReview(); });
  }
  function rbSend(){
    $('#rbBody').innerHTML = `<h2>${RB_STEPS[4]}</h2><p>No charge for the update. You only pay your printer.</p>
      <div class="opts"><button type="button" class="btn" value="both">Upload to my printer and download</button>
      <button type="button" class="btn line" value="printer">Upload to my printer only</button><button type="button" class="btn line" value="download">Download only</button></div>
      <p class="gray">Test page: the printer upload is a stand-in, and nothing is ordered at a printer or mail vendor without your yes there.</p>${rbNav('Done', true)}`;
    let how = null;
    $$('#rbBody .opts .btn').forEach(b => b.onclick = () => { how = b.value; $$('#rbBody .opts .btn').forEach(x => x.classList.toggle('line', x !== b)); });
    rbWire(async () => {
      if(!how){ await ask('<h2>Pick where it goes</h2><p>Choose the printer upload, a download, or both.</p>', [['OK', 'ok', 'line']]); return false; }
      await rbFinish(rb.orders.filter(p => rb.picks.has(p.id)), how);
      openHome(); return false;
    });
  }
  async function rbFinish(list, how){
    const k = Object.assign({}, rb.kit, {updatedAt: new Date().toISOString()});
    saveKit(k);
    if(rb.newLogin && me && sb){ const {error} = await sb.auth.updateUser({email: rb.newLogin}); if(error) console.warn(error.message); }
    for(const p of list){
      p.brandHistory = (p.brandHistory || []).concat([{brand: p.brandAtOrder || null, until: k.updatedAt}]);
      p.brandAtOrder = k; p.rebrandedAt = k.updatedAt;
      p.brand = Object.assign({}, p.brand, {accent: (k.colors || [])[0] || p.brand.accent});   // the new brokerage's colors; fonts stay
      if(rb.designFor[p.id]){ p.design = rb.designFor[p.id]; p.refit = true; }   // a fold-over that won't fit gets one small writer pass (rebrand_refit)
      p.updatedAt = k.updatedAt;
      await store.save(p).catch(e => console.warn(e));
    }
    // the owner's daily report counts these (no alert)
    if(list.length) store.event(list[0].id, 'rebrand', {orders: list.map(p => p.id), pieces: list.reduce((n, p) => n + piecesOf(p).length, 0), how, free: true});
  }

  async function openPackage(p, where){
    pkg = p; lput('bd-current', p.id);
    resolvePhotos(p);
    if(where === 'gallery') return openGallery();
    if(where === 'library' || (p.lib && !p.design)) return openLib();
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
    'other-site': "We couldn't find that listing from the link. Paste its HAR or Matrix link instead.",
    'not-a-listing': "That HAR link isn't a single listing. Open the listing on HAR and copy that page's link.",
    'not-matrix': "That doesn't look like a Matrix listing link. Paste the link from the Matrix email or share page.",
    'not-a-link': "That doesn't look like a link yet. Paste the whole listing link, starting with https://.",
    blocked: "That site asked us to prove we're a person, and we won't try to get past that. Paste the HAR or Matrix link instead.",
    unreadable: "We opened the link but couldn't find the listing on it.",
    'not-found': "That link didn't open a listing. It may have expired.",
    unreachable: "We couldn't reach the listing site just now. Try again in a moment.",
    'slow-down': "That's a lot of tries in a row. Wait a few minutes and try again.",
    network: 'Something went wrong on our end while reading the link. Try again.'
  };
  // HAR, Matrix (share and emailed links), Zillow / Realtor.com / Redfin (found on HAR by address) and brokerage pages all go to the reader
  function localCheck(v){
    let u; try { u = new URL(v); } catch(e) { return 'not-a-link'; }
    return /^https?:$/.test(u.protocol) ? '' : 'not-a-link';
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
      // every listing photo (the picker's lower box holds the ones we didn't pick); floor plan images stay out of photo spots
      const fp = (j.listing && j.listing.floorPlan) || {found: false, source: null, files: [], stories: null};
      const planUrls = new Set(fp.files.map(f => f.url)), seen = new Set(), cand = [];
      for(const p of j.photos.concat(j.spares || [], (j.gallery || []).map(g => ({n: g.n, url: g.url, desc: g.caption || '', direct: g.direct}))))
        if(p.url && !seen.has(p.url) && !planUrls.has(p.url) && PT.roomKey(p.room || p.desc) !== 'floor plan'){ seen.add(p.url); cand.push(p); }
      cand.splice(ALL_PHOTOS);
      const picked = new Set(j.photos.concat(j.spares || []).map(p => p.url)), want = cand.length, got = [];
      stepTo('photos', 25, `Found ${j.totalPhotos || cand.length} photos, getting them all…`);
      let next = 0, done = 0;
      const worker = async () => {
        while(next < cand.length){
          const i = next++;
          try { const u = await loadPhoto(cand[i].url, link !== 'sample', cand[i].direct); got[i] = u ? cand[i] : null; } catch(e) { got[i] = null; }
          done++; if(done <= want) stepTo('photos', 25 + Math.round(55 * done / want), `Getting photo ${Math.min(done, want)} of ${want}…`);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      const keep = got.filter(Boolean);
      if(!keep.length) throw {code: 'unreadable'};
      // the upper box: our picks in listing order (staged first, as the reader sorted them), up to the cap
      const upper = keep.filter(p => picked.has(p.url)).slice(0, PICK_CAP).sort((a, b) => a.n - b.n);
      if(upper.length < PICK_CAP) upper.push(...keep.filter(p => !upper.includes(p)).slice(0, PICK_CAP - upper.length));
      stepTo('details', 90, 'Filling in the details…');
      const l = j.listing;
      // the whole listing record is kept (description, every detail field, rooms, what conveys, every photo caption,
      // and price / schools in `withheld`, which package-ai never passes to the writer)
      lookup = {link, listing: Object.assign({}, l, {address: l.address, neighborhood: l.neighborhood || '', city: l.city || 'Houston', state: 'Texas', zip: l.zip || '',
        beds: l.beds, baths: l.baths, halfBaths: l.halfBaths || 0, sqft: l.sqft, yearBuilt: l.yearBuilt || l.year, stories: l.stories || null, description: l.description || ''}),
        photos: keep.map(p => ({n: p.n, url: p.url, desc: p.desc || '', room: PT.roomKey(p.room || p.desc)})), upper: upper.map(p => p.url),
        floorPlan: {source: fp.source, files: fp.files, stories: fp.stories, active: false, art: null, asked: null}, moves: 0, id: uuid(), tags: {}};
      stepTo('done', 100, `Found ${lookup.listing.address}: ${keep.length} photos. Pick what you'd like below.`);
      $('#toGallery').disabled = false;
      drawPicker(); drawPlanBox(); if(fp.files.length) loadPlan(fp.files, fp.source);
      if(link !== 'sample') tagRooms();
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
    const byUrl = Object.fromEntries(lookup.photos.map(p => [p.url, p])), fpl = lookup.floorPlan;
    if(fpl.active && fpl.art && !lookup.listing.stories && fpl.art.length > 1) lookup.listing.stories = fpl.art.length;
    const ROLE_OF = {'front exterior': 'front', 'side exterior': 'side', 'back exterior': 'back', 'living room': 'living', 'family room': 'family', kitchen: 'kitchen',
      'dining room': 'dining', 'breakfast area': 'nook', 'primary bedroom': 'primary', bedroom: 'bedroom', 'primary bath': 'bath', bathroom: 'bath', study: 'office',
      entry: 'entry', stairs: 'stairs', 'laundry room': 'laundry', garage: 'garage', patio: 'patio', pool: 'pool', backyard: 'yard', aerial: 'aerial', view: 'view', community: 'amenity'};
    for(const p of lookup.photos){ const t = lookup.tags[p.url];
      if(t) Object.assign(p, {role: t.role, exterior: t.exterior, house: t.house || undefined});
      else if(p.room && ROLE_OF[p.room] && !/exterior|aerial/.test(p.room)) Object.assign(p, {role: ROLE_OF[p.room], exterior: false}); }
    pkg = {id: lookup.id, createdAt: now, updatedAt: now, link: lookup.link, listing: lookup.listing, photos: lookup.upper.map(u => byUrl[u]),
      morePhotos: lookup.photos.filter(p => !lookup.upper.includes(p.url)), tags: lookup.tags,
      floorPlan: {source: fpl.active ? fpl.source : null, files: fpl.files, stories: fpl.stories, active: !!(fpl.active && fpl.art), art: fpl.active ? fpl.art : null,
        removed: !!fpl.removed},
      order: {kind, piece: kind === 'single' ? $('#singlePiece').value : null, size: document.querySelector('input[name=size]:checked').value},
      design: null, brand: {accent: COLORS[0], fonts: {}}, copyStyle: suggestStyle(lookup.listing), arrangements: {}, ohFlyer: null,
      stage: 'rough', copy: {}, approvals: {}, paid: null, delivery: {}, openHouse: {kind: 'public', date: '', start: '13:00', end: '16:00'}, edits: 0};
    lput('bd-current', pkg.id);
    save(true);
    // measure (brief): how often agents move photos in the picker and remove the floor plan
    store.event(pkg.id, 'photo-picker', {moves: lookup.moves, inPackage: pkg.photos.length, more: pkg.morePhotos.length});
    if(fpl.removed) store.event(pkg.id, 'floor-plan-removed', {source: fpl.source});
    openGallery();
    tagPhotos();
  };

  // ---------- photo picker and floor plan (after the lookup) ----------
  function drawPicker(){
    $('#photoPick').hidden = false;
    const photos = lookup.photos.map(p => ({key: p.url, src: photoUrlNow(p.url), room: p.room ? PT.heading(p.room) : ''}));
    PT.picker($('#pickerRoot'), {photos, upper: lookup.upper, cap: PICK_CAP, full: PICK_FULL, labels: PICK_LABELS,
      onChange: up => { lookup.upper = up; lookup.moves++; }});
  }
  // room types: captions first (free); one low-cost photo read for the photos with no usable caption, plus the
  // exteriors (their whole-house box keeps every crop from cutting the house)
  async function tagRooms(){
    const ext = /exterior|aerial/;
    const need = lookup.photos.filter(p => !p.room || ext.test(p.room));
    if(!need.length) return;
    try {
      const photos = [];
      for(const [i, p] of need.entries()) photos.push({id: 'u' + i, desc: p.desc || '', data: await photoB64(photoUrlNow(p.url))});
      const j = await ai({action: 'tag-photos', packageId: lookup.id, photos});
      for(const t of j.photos || []){ const p = need[+t.id.slice(1)]; if(!p) continue;
        lookup.tags[p.url] = {role: t.role, house: t.house || null, exterior: !!t.exterior};
        if(!p.room) p.room = PT.ROLE_ROOM[t.role] || ''; }
      lookup.tagCost = j.cost || 0;
      if(!$('#vStart').hidden) drawPicker();
    } catch(e) { /* labels then come from the captions alone */ }
  }
  async function loadPlan(files, source){
    const box = $('#planBody'); box.innerHTML = '<p class="fine">Reading your floor plan…</p>';
    try {
      const blobs = [];
      for(const f of files.slice(0, 4)){
        if(f.blob){ blobs.push(f.blob); continue; }
        const r = await fetch(`${FN_MATRIX}?plan=${encodeURIComponent(f.url)}`); if(!r.ok) throw new Error('plan');
        blobs.push(await r.blob());
      }
      const art = await PT.cleanPlan(blobs, files.map(f => /\b(1st|first|ground|main)\b/i.test(f.label || '') ? 'First floor' : /\b(2nd|second|upper)\b/i.test(f.label || '') ? 'Second floor' : ''));
      if(!art.length) throw new Error('plan');
      Object.assign(lookup.floorPlan, {source, art, active: true, removed: false});
    } catch(e) { Object.assign(lookup.floorPlan, {art: null, active: false, failed: true}); }
    drawPlanBox();
  }
  function drawPlanBox(){
    const F = lookup.floorPlan, box = $('#planBody'); $('#planBox').hidden = false;
    const from = {documents: "the listing's documents", gallery: "the listing's floor plans", photo: "the listing photos", upload: 'your upload'}[F.source] || 'your listing';
    const thumbs = () => `<div class="planthumbs">${F.art.map(a => `<img src="${esc(a.src)}" alt="Floor plan${a.label ? ', ' + esc(a.label) : ''}">`).join('')}</div>`;
    if(F.active && F.art){
      box.innerHTML = `<p>${F.source === 'upload' ? 'Your floor plan is in.' : `We found a floor plan in ${from}.`} It goes in your design.</p>${thumbs()}<p><button type="button" class="link" id="planOut">Remove the floor plan</button></p>`;
      $('#planOut').onclick = () => { F.active = false; F.removed = true; drawPlanBox(); };
    } else if(F.removed && F.art){
      box.innerHTML = `<p>Floor plan removed. Your design uses its version without a floor plan.</p><p><button type="button" class="link" id="planBack">Put the floor plan back</button></p>`;
      $('#planBack').onclick = () => { F.active = true; F.removed = false; drawPlanBox(); };
    } else if(F.asked === 'no'){
      box.innerHTML = `<p>No floor plan. Your design uses its version without one.</p><p><button type="button" class="link" id="planAsk">I have one after all</button></p>`;
      $('#planAsk').onclick = () => { F.asked = null; drawPlanBox(); };
    } else {
      // the floor plan question (versions-and-floor-plan-ask brief; proposed wording, the owner's call)
      box.innerHTML = `<p>${F.failed ? "We found a floor plan but couldn't open it." : "We didn't find a floor plan on this listing."} Do you have one?</p>
        <div class="row gap"><button type="button" class="btn" id="planYes">Yes, upload it</button><button type="button" class="btn line" id="planNo">No floor plan</button></div>
        <label class="planup" id="planUp" hidden>Floor plan (PDF, JPG or PNG; one file per floor is fine)<input type="file" id="planFile" accept="application/pdf,image/jpeg,image/png" multiple></label>`;
      $('#planYes').onclick = () => { $('#planUp').hidden = false; $('#planFile').click(); };
      $('#planNo').onclick = () => { F.asked = 'no'; drawPlanBox(); };
      $('#planFile').onchange = e => { const fs = [...e.target.files].slice(0, 4); if(!fs.length) return;
        F.files = fs.map(f => ({blob: f, label: f.name, kind: /pdf/.test(f.type) ? 'pdf' : 'image'})); loadPlan(F.files, 'upload'); };
    }
  }
  // Label what each photo shows (front of the house, kitchen, primary bedroom...) once per listing, in the background,
  // so every design can fill its photo spots on its own and keep the whole roof in exterior shots. Costs about a cent.
  async function tagPhotos(){
    const p = pkg; if(!p || p.photoTags) return;
    // photos the lookup already read, or whose caption names the room, aren't read again (one paid read per photo at most)
    const list = p.photos.map((ph, i) => ({id: 'p' + i, url: ph.url, desc: ph.desc || '', done: !!ph.role})).filter(x => !x.done && /^https:\/\//.test(x.url)).map(({done, ...x}) => x);
    if(!list.length) return;
    try {
      const j = await ai({action: 'tag-photos', packageId: p.id, photos: list});
      (j.photos || []).forEach(t => { const ph = p.photos[+t.id.slice(1)]; if(ph) Object.assign(ph, {role: t.role, exterior: t.exterior, house: t.house, note: t.note}); });
      p.photoTags = true; if(p === pkg) save();
    } catch(e) { /* labels are a helper: designs still fill from the MLS captions without them */ }
  }
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
  async function loadPhoto(url, viaReader, direct){
    if(photoSrc.has(url)) return photoSrc.get(url);
    if(!viaReader && url.startsWith('/')){ photoSrc.set(url, url); return url; }
    // a brokerage site's own photos can't go through the reader (Matrix and HAR photos only); try them straight from the site
    const r = await fetch(direct ? url : `${FN_MATRIX}?photo=${encodeURIComponent(url)}`);
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
      const f = oh || by['open-house-flyer'] || S.pieces.find(x => x.variant === 'openhouse'); return f ? [{piece: f, label: oh ? f.title : 'Open House flyer'}] : null; }
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
    arr.forEach(i => { const ph = pkg.photos[i]; P['p' + i] = {src: photoUrlNow(ph.url), tags: [ph.desc || '', ph.note || ''].filter(Boolean).join(', '), role: ph.role, exterior: ph.exterior, house: ph.house, fullHouse: ph.house ? true : undefined}; });
    const S = d.sample || {};
    const fonts = fontsFor(pkg, fs);
    const kit = kitOverride !== undefined ? kitOverride : brandKit();
    const brand = Object.assign({}, SAMPLE_BRAND, S.brokerage ? {brokerage: S.brokerage, logo: S.logo, web: S.web} : {}, kitBrand(kit), {accent: pkg.brand.accent},
      Object.keys(fonts).length ? {fonts} : {});
    const agent = Object.assign({}, SAMPLE_AGENT, profile ? {name: profile.display_name || SAMPLE_AGENT.name, mailerName: profile.mailer_name || null, phone: profile.cell || SAMPLE_AGENT.phone,
      email: profile.preferred_email || SAMPLE_AGENT.email} : {}, S.qrLabel ? {qrLabel: S.qrLabel, web: S.agentWeb || SAMPLE_AGENT.web} : {},
      kit && kit.contact ? Object.fromEntries(Object.entries(kit.contact).filter(([, v]) => v)) : {});
    const written = final && pkg.copy[designId];
    const oh = pkg.openHouse && pkg.openHouse.date ? pkg.openHouse : null;
    // rough draft: real room headings and "what you'll get" lines, sized to each slot's real copy (preview-lines.json);
    // the simple floor plan sits in the plan spot. Both are preview only: the templates' checks block them on any export.
    const pre = written ? null : await previewCopy(designId, ids);
    const fp = pkg.floorPlan, plan = !written && fp && fp.active && fp.art ? fp.art.map(a => ({src: a.src, tinted: a.tinted, label: a.label})) : null;
    return Object.assign({template: designId, sample: true, brand, agent, listing: pkg.listing, mailVendor: null, photos: P,
      openHouse: final ? oh : null,
      copy: written ? written.copy : pre.copy,
      companion: written ? Object.assign({fineprint: FINE_PRINT}, written.companion) : pre.companion,
      copyPending: false}, written ? {} : {preview: true}, plan ? {planPreview: plan, planNote: PLAN_NOTE} : {},
      // the redrawn plan is saved as linework (rooms, walls, levels); each design restyles it in code, never a second redraw
      written && pkg.plan ? {plan: pkg.plan} : {});
  }
  // The design's own example copy gives the shape and the length of every slot. Photo sections get the room heading of
  // the photo placed there and a line about that room; other text gets a line about what that part will say.
  async function previewCopy(designId, ids){
    await PT.load();
    const ex = await example(designId), base = {copy: draftCopy(ids), companion: draftCompanion(ids)};
    if(!ex || !ex.copy) return base;
    const rest = ids.length > 1 ? ids.slice(1) : ids; let n = 0, seed = 0, first = true;
    const roomOf = id => { const ph = pkg.photos[+String(id).slice(1)]; return (ph && ph.room) || 'room'; };
    const at = (o, path) => path.reduce((v, k) => v == null ? v : v[k], o);
    const KEEP = /^(location|stats|variant|footnote|planDisclosures|flyerPhotos|eyebrow|fineprint|stat\d)$/;
    const TEXT = {kicker: 'kicker', title: 'headline', q: 'headline', heading: 'headline', intro: 'intro', summary: 'summary', notes: 'summary', body: 'feature',
      a: 'feature', detail: 'feature', locationBody: 'location', locationTitle: 'heading:Location', nearbyTitle: 'heading:Nearby'};
    function walk(v, path, group){
      const key = path[path.length - 1], b = at(base, path);
      if(typeof key === 'string' && KEEP.test(key)) return b !== undefined ? b : v;
      if(Array.isArray(v)){
        if(v.every(x => typeof x === 'string') && /photos$/i.test(key)) return b !== undefined ? b : [];
        return v.map((x, i) => walk(x, path.concat(i), group));
      }
      if(v && typeof v === 'object'){
        if('walls' in v || 'rooms' in v && 'w' in v) return null;   // the sample's drawn plan: never shown for another listing
        // a photo's own fields take its room; any other object is a section that collects the rooms placed in it
        const o = {}, g = {rooms: []};
        if('photo' in v){ o.photo = first ? ids[0] : rest[n++ % rest.length]; first = false; g.room = roomOf(o.photo); if(group) group.rooms.push(g.room); }
        for(const [k, x] of Object.entries(v)) if(k !== 'photo') o[k] = walk(x, path.concat(k), g);
        // a section's kicker names the rooms in it (after its photos are placed)
        if(typeof o.kicker === 'string' && g.rooms.length) o.kicker = [...new Set(g.rooms.map(PT.heading))].slice(0, 2).join(' + ');
        return o;
      }
      if(typeof v !== 'string') return v;
      const len = v.length, room = group && group.room;
      if(room && key === 'caption') return '';   // the heading sits over the copy; a caption would only repeat it
      if(room && /^(title|q|label|name)$/.test(key)) return PT.heading(room);
      if(room && key === 'lead') return '';
      if(room && /^(body|a|detail|notes)$/.test(key)) return PT.line(room, len, seed++);
      const t = TEXT[key];
      if(!t) return b !== undefined ? b : v.length < 24 ? v : PT.line('feature', len, seed++);
      if(t.startsWith('heading:')) return t.slice(8);
      if(t === 'kicker') return v;
      return PT.line(t, len, seed++);
    }
    return {copy: walk(ex.copy, ['copy']), companion: Object.assign({fineprint: FINE_PRINT}, walk(ex.companion || {}, ['companion']))};
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
          .then(() => { if(d.preview) PT.fitPreview(fr.contentDocument); fit(s); if(onReady) onReady(fr, s, pt); }); fit(s); };
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
    $('#personal').innerHTML = `<div class="offer"><h3>Want your own design?</h3><p>We'll build a full matching set around your brand and keep it in your account.</p>
      <p><a href="/preview/own-design/?as=agent">See how it works</a></p></div>`;
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
    // plan-only designs (Room Proportions) are made for homes with a floor plan
    const hasPlan = !!(pkg.floorPlan && pkg.floorPlan.active);
    for(const {d} of list) if(d.planOnly && !hasPlan){
      const el = $(`.dset[data-design="${d.id}"]`); el.classList.add('grayed'); el.querySelector('[data-use]').disabled = true;
      el.querySelector('.row').insertAdjacentHTML('beforeend', `<button type="button" class="link" data-why="${d.id}">Why is this grayed out?</button>`); }
    $$('[data-why]').forEach(b => b.onclick = () => ask('<h2>Made for a floor plan</h2><p>This design is built around the floor plan. Add your floor plan on the listing step to use it.</p>', [['OK', 'ok', 'line']]));
    $$('[data-use]').forEach(b => b.onclick = () => { pkg.design = b.dataset.use; save(); openRough(); });
    // the Just Listed / Just Sold library: pieces picked one by one (test)
    const lib = designs.find(d => d.library);
    $('#libEntry').hidden = !lib;
    if(lib) $('#libEntry').innerHTML = `<div class="offer"><h3>Just Listed and Just Sold library <span class="badge">test</span></h3>
      <p>35 postcard and social designs. Pick any of them on their own, made from your listing.</p><p><button class="btn" type="button" id="toLib">Open the library</button></p></div>`;
    if(lib) $('#toLib').onclick = () => openLib();
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

  // ---------- 2b. Just Listed / Just Sold library (test, 10/22/2026) ----------
  // Designs from templates/announce, picked one by one. The Just Listed copy is written once for all of them (one writer
  // call); Just Sold wording is the agent's picks plus the playbook (no AI). Photos are read once (Haiku) for each one's
  // room and the box around the whole house, so every crop keeps the whole house.
  const LIB = 'announce', PLAY = (window.ANN && ANN.PLAYBOOK) || {ctas: []};
  const LIB_TABS = [{id: 'jl-mail', label: 'Just Listed postcards', card: 'listed', social: false}, {id: 'jl-social', label: 'Just Listed social', card: 'listed', social: true},
    {id: 'js-mail', label: 'Just Sold postcards', card: 'sold', social: false}, {id: 'js-social', label: 'Just Sold social', card: 'sold', social: true}];
  // the sample listing's two exterior photos, measured by hand (same boxes as samples/announce/data.json)
  const SAMPLE_HOUSES = {'front.jpg': {kind: 'front', room: 'Front', house: {left: .14, top: .05, right: .88, bottom: .74}},
    'family.jpg': {kind: 'side', room: 'Front', house: {left: .2, top: .19, right: .83, bottom: .67}}};
  const ISSUE = {'off-page': 'Text runs off the page', 'overflow': 'Text doesn\'t fit its space', 'text-runs-into-band': 'Text runs into a color band',
    'house-cut-off': 'The house is cut off', 'house-covered': 'Something covers the house', 'empty-photo-slot': 'A photo spot is empty', 'photo-missing': 'A photo didn\'t load',
    'photo-repeated': 'The same photo is used twice', 'no-front-of-house': 'The front of the house isn\'t on this postcard', 'logo-missing': 'The logo is missing',
    'logo-version-missing': 'This spot needs a white version of your logo', 'trec-logo-too-small': 'The logo is too small next to your name (TREC)', 'logo-under-0.35in': 'The logo is under 0.35 in',
    'outside-safe-zone': 'Something is too close to the trim', 'type-too-small': 'Some type is under 8 pt', 'fine-print-below-6pt': 'Fine print is under 6 pt',
    'low-contrast': 'Some text is hard to read on its color', 'story-safe-zone': 'Text sits under the Instagram/Facebook bars', 'outside-grid-crop': 'Address or name falls outside the grid crop',
    'banned-phrase': 'A phrase we don\'t allow', 'neighborhood-name': 'The neighborhood name shows', 'missing-copy': 'Some copy is missing'};
  const libState = p => p.lib || (p.lib = {houses: null, housesNote: '', copy: null, cost: 0, tab: 'jl-mail', picks: [],
    sold: {headline: 'Just Sold', side: '', days: '', offers: '', offersOk: false, cta: 3, own: ''}, ordered: null});
  function libSold(s){
    const t = (s.own || '').trim() || PLAY.ctas[s.cta] || PLAY.ctas[0] || '', q = t.indexOf('?');
    const cta = q > 0 && q < t.length - 1 ? {ctaHead: t.slice(0, q + 1), ctaShort: t.slice(q + 1).trim()} : {ctaHead: t};
    return Object.assign({headline: s.headline, side: s.side || null, days: s.days ? +s.days : null,
      offers: s.offers ? (/^\d+$/.test(s.offers.trim()) ? s.offers.trim() : 'multiple') : null, offersOk: !!s.offersOk}, cta);
  }
  function libData(){
    const s = libState(pkg), P = {}, order = [];
    pkg.photos.forEach((ph, i) => {
      const h = (s.houses || {})['p' + i] || {};
      if(['plan', 'aerial', 'other'].includes(h.kind)) return;   // floor plans, maps and aerials never go in a photo spot
      const kind = {front: 'front exterior', side: 'side angle exterior', rear: 'rear exterior', yard: 'backyard'}[h.kind] || '';
      P['p' + i] = {src: photoUrlNow(ph.url), tags: [kind, h.room, ph.desc].filter(Boolean).join(', '), room: h.room || '', role: h.role || undefined, house: h.house || undefined};
      order.push('p' + i);
    });
    order.sort((a, b) => (P[b].house ? 1 : 0) - (P[a].house ? 1 : 0));   // whole-house exteriors first
    const agent = Object.assign({}, SAMPLE_AGENT, {nar: true}, profile ? {name: profile.display_name || SAMPLE_AGENT.name, phone: profile.cell || SAMPLE_AGENT.phone,
      email: profile.preferred_email || SAMPLE_AGENT.email} : {}, {headshot: null});
    const logos = Object.fromEntries(['black', 'gold', 'white', 'forest', 'color', 'gold-on-dark'].map(k => [k, `/designs/samples/larkspur/AnyBrokerage_${k}.png`]));
    // the agent's brand kit when saved (a brokerage switch rebrands these sets the same way); else the sample brand
    const kit = kitOverride !== undefined ? kitOverride : brandKit();
    const brand = kit && kit.logo ? {brokerage: kit.brokerage, address: kit.officeAddress || '', logo: kit.logo, logoKnockout: kit.logoOnDark || null, logos: {}}
      : {brokerage: 'Any Brokerage', address: '1200 Heights Blvd, Houston, TX 77008', sample: true, logo: logos.black, logoKnockout: logos.white, logos};
    return {template: LIB, sample: true, fontBase: '/fonts/pool/', agent, listing: pkg.listing, photos: P, photoOrder: order, mailVendor: null,
      brand,
      companion: {justListed: s.copy || {}, justSold: libSold(s.sold)}};
  }
  async function photoB64(url){
    const blob = await fetch(url).then(r => r.blob()), bmp = await createImageBitmap(blob);
    const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .8).split(',')[1];
  }
  async function readHouses(){
    const s = libState(pkg);
    if(pkg.photos.every(ph => ph.url.startsWith('/designs/samples/'))){   // the sample listing: known boxes, no AI call
      s.houses = Object.fromEntries(pkg.photos.map((ph, i) => [ 'p' + i, SAMPLE_HOUSES[ph.url.split('/').pop()] || {kind: 'interior', room: '', house: null}]));
      return;
    }
    // package-ai "tag-photos" (the one photo step): role, exterior, whole-house box. Kept here as kind / room / house.
    const KIND = {front:'front', side:'side', back:'rear', patio:'yard', pool:'yard', yard:'yard', aerial:'aerial', floorplan:'plan', street:'other', view:'other', amenity:'other', other:'other'};
    const ROOM = {front:'Front', side:'Side view', back:'Back of the house', aerial:'Aerial', living:'Living room', family:'Family room', kitchen:'Kitchen',
      dining:'Dining', nook:'Breakfast nook', primary:'Primary bedroom', bedroom:'Bedroom', bath:'Bathroom', office:'Study', entry:'Entry', stairs:'Stairs',
      laundry:'Laundry', garage:'Garage', patio:'Patio', pool:'Pool', yard:'Yard', view:'View', amenity:'Community', floorplan:'Floor plan', street:'Street', other:''};
    const fromTag = t => ({kind: KIND[t.role] || 'interior', room: ROOM[t.role] || '', role: t.role, house: t.house && ['front', 'side', 'back'].includes(t.role) ? t.house : null});
    // photos read right after the lookup, and captioned interiors, need no second read
    const known = {}, photos = [];
    for(const [i, ph] of pkg.photos.entries()){
      const t = (pkg.tags || {})[ph.url];
      if(t) known['p' + i] = fromTag(t);
      else if(ph.room && !/exterior|aerial/.test(ph.room)) known['p' + i] = {kind: 'interior', room: PT.heading(ph.room), house: null};
      else photos.push({id: 'p' + i, desc: ph.desc || '', data: await photoB64(photoUrlNow(ph.url))});
    }
    if(!photos.length){ s.houses = known; return; }
    try { const j = await ai({action: 'tag-photos', packageId: pkg.id, photos});
      s.houses = Object.assign(known, Object.fromEntries((j.photos || []).map(t => [t.id, fromTag(t)])));
      s.cost += j.cost || 0; s.housesNote = ''; }
    catch(e){ s.houses = {}; s.housesNote = "We couldn't read the photos this time, so crops can't check for the whole house yet."; }
  }
  async function writeLib(){
    const s = libState(pkg), ex = await example(LIB), exJL = Object.assign({}, ex.companion.justListed);
    delete exJL.photoRoles;
    exJL.captions = Object.entries(exJL.captions || {}).map(([photo, text]) => ({photo, text}));
    const ids = Object.keys(libData().photos);
    const draft = Object.fromEntries(Object.keys(exJL).map(k => [k, Array.isArray(exJL[k]) ? [] : typeof exJL[k] === 'string' ? '' : exJL[k]]));
    draft.captions = ids.map(photo => ({photo, text: ''}));
    // these designs never print the neighborhood name (city and state only), so the writer never sees it
    const hood = (pkg.listing.neighborhood || '').trim(), re = hood ? new RegExp('\\b' + hood.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi') : null;
    const strip = t => re ? String(t || '').replace(re, '') : t;
    const details = Object.fromEntries(Object.entries(pkg.listing.details || {}).map(([sec, f]) =>
      [sec, Object.fromEntries(Object.entries(f).filter(([k]) => !/subdivision|market area|legal/i.test(k)).map(([k, v]) => [k, strip(v)]))]));
    const listing = Object.assign({}, pkg.listing, {neighborhood: '', description: strip(pkg.listing.description), details,
      photoCaptions: (pkg.listing.photoCaptions || []).map(c => ({n: c.n, caption: strip(c.caption)}))});
    const j = await ai({action: 'write', packageId: pkg.id, design: 'Just Listed postcards and social posts (city and state only, never a neighborhood or area name)', style: pkg.copyStyle, listing,
      photos: Object.fromEntries(ids.map(id => [id, libData().photos[id].tags])), example: {copy: {}, companion: {justListed: exJL}},
      draft: {copy: {}, companion: {justListed: draft}}, pieces: ['Just Listed postcard (front and back)', 'Just Listed social posts and stories']});
    const jl = j.companion.justListed;
    jl.captions = Object.fromEntries((jl.captions || []).filter(c => ids.includes(c.photo)).map(c => [c.photo, c.text]));
    s.copy = jl; s.cost += j.cost || 0;
  }
  async function openLib(){
    if(!pkg) return openStart();
    const s = libState(pkg);
    pkg.lib = s; save();
    show('vLib');
    $('#libLede').textContent = `${pkg.listing.address}. Pick any postcard or social design; each is made from your listing.`;
    $('#libWrite').hidden = !!s.copy; $('#libBody').hidden = !s.copy; $('#libProof').hidden = true;
    $('#libStatus').textContent = s.housesNote || '';
    if(s.copy) libGrid();
  }
  $('#libGo').onclick = async () => {
    const s = libState(pkg), b = $('#libGo');
    b.disabled = true;
    try {
      $('#libStatus').textContent = 'Reading your photos…';
      if(!s.houses) await readHouses();
      save();
      $('#libStatus').textContent = 'Writing your Just Listed copy and checking every line…';
      await writeLib();
      store.event(pkg.id, 'library-write', {cost: s.cost});
      save(true); openLib();
    } catch(e) {
      $('#libStatus').textContent = e.message === 'daily-cap' ? "We've hit today's writing limit for test drives. Try again tomorrow." : "We couldn't finish writing just now. Try again.";
    } finally { b.disabled = false; }
  };
  function soldForm(){
    const s = libState(pkg).sold;
    $('#lsCta').innerHTML = PLAY.ctas.map((t, i) => `<option value="${i}">${esc(t)}</option>`).join('');
    $('#lsHead').value = s.headline; $('#lsSide').value = s.side; $('#lsDays').value = s.days; $('#lsOffers').value = s.offers;
    $('#lsOk').checked = s.offersOk; $('#lsCta').value = String(s.cta); $('#lsOwn').value = s.own;
    const upd = () => { Object.assign(s, {headline: $('#lsHead').value, side: $('#lsSide').value, days: $('#lsDays').value.replace(/\D/g, ''),
      offers: $('#lsOffers').value.trim(), offersOk: $('#lsOk').checked, cta: +$('#lsCta').value, own: $('#lsOwn').value}); save();
      if(libState(pkg).tab.startsWith('js')) libGrid(); };
    ['#lsHead', '#lsSide', '#lsCta', '#lsOk'].forEach(q => $(q).onchange = upd);
    ['#lsDays', '#lsOffers', '#lsOwn'].forEach(q => $(q).onchange = upd);
  }
  async function libGrid(){
    const s = libState(pkg), S = await spec(LIB), tab = LIB_TABS.find(t => t.id === s.tab);
    soldForm();
    $('#libTabs').innerHTML = LIB_TABS.map(t => `<button type="button" role="tab" aria-selected="${t.id === s.tab}" data-tab="${t.id}">${t.label}</button>`).join('');
    $$('[data-tab]').forEach(b => b.onclick = () => { s.tab = b.dataset.tab; save(); libGrid(); });
    $('#libSizeRow').hidden = tab.social;
    const size = pkg.order.size || '6x9';
    $$('input[name=libSize]').forEach(r => { r.checked = r.value === size; r.onchange = () => { pkg.order.size = r.value; save(); libGrid(); }; });
    const pieces = S.pieces.filter(p => p.card === tab.card && !p.auto && (tab.social ? p.kind === 'social' : p.size === size && p.side === 'front'));
    $('#libList').innerHTML = pieces.map(p => `<div class="dset${s.picks.includes(p.design) ? ' picked' : ''}" data-d="${p.design}"><div class="minis one"></div>
      <div class="row"><small>${esc(p.design.replace(/^J[LS]-/, ''))} · ${esc(p.title)}${p.category ? ' · ' + esc(p.category) : ''}</small>
      <button class="link" type="button" data-pick="${p.design}">${s.picks.includes(p.design) ? 'Remove' : 'Add'}</button></div></div>`).join('');
    const data = libData();
    for(const p of pieces) drawParts($(`.dset[data-d="${p.design}"] .minis`), LIB, [{piece: p, label: p.title}], data);
    $$('[data-pick]').forEach(b => b.onclick = () => { const d = b.dataset.pick; s.picks = s.picks.includes(d) ? s.picks.filter(x => x !== d) : s.picks.concat(d); save(); libGrid(); });
    $('#libCount').textContent = s.picks.length ? `${s.picks.length} picked: ${s.picks.join(', ')}` : 'Nothing picked yet.';
    $('#libReview').disabled = !s.picks.length;
  }
  const libParts = (S, d) => {
    const ps = S.pieces.filter(p => p.design === d), size = pkg.order.size || '6x9';
    const social = ps.find(p => p.kind === 'social');
    if(social) return [{piece: social, label: social.label}];
    return ['front', 'back'].map(side => ps.find(p => p.size === size && p.side === side)).map(p => ({piece: p, label: p.side === 'front' ? 'Front' : 'Back'}));
  };
  $('#libReview').onclick = async () => {
    const s = libState(pkg), S = await spec(LIB);
    $('#libBody').hidden = true; $('#libProof').hidden = false;
    $('#libProofs').innerHTML = s.picks.map(d => `<div class="libpk" data-pk="${d}"><h3>${esc(d)} · ${esc((S.pieces.find(p => p.design === d) || {}).title || '')}</h3>
      <div class="${libParts(S, d).length > 1 ? 'two' : 'one'}"></div><ul class="issues"></ul></div>`).join('');
    const data = libData();
    for(const d of s.picks){
      const box = $(`[data-pk="${d}"] > div`), found = [];
      let left = libParts(S, d).length;
      drawParts(box, LIB, libParts(S, d), data, fr => {
        try { found.push(...(fr.contentWindow.brochureCheck() || [])); } catch(e) {}
        if(--left) return;
        const kinds = [...new Set(found.map(c => c.kind))];
        $(`[data-pk="${d}"] .issues`).innerHTML = kinds.length ? kinds.map(k => `<li>${esc(ISSUE[k] || k)}</li>`).join('') : '<li class="ok">Passes every print check.</li>';
      });
    }
    $('#libOrderNote').textContent = s.ordered ? `Ordered ${dayFmt(s.ordered.at)} (test).` : '';
    libOrderButtons();
  };
  $('#libBack').onclick = () => { $('#libProof').hidden = true; $('#libBody').hidden = false; libGrid(); };
  function libOrderButtons(){
    const s = libState(pkg);
    $('#libOrder').textContent = s.ordered ? 'Download the files' : 'Approve and order (test)';
  }
  $('#libOrder').onclick = async () => {
    const s = libState(pkg);
    if(!s.ordered){
      const v = await ask(`<h2>Order these ${s.picks.length} pieces</h2><p>${esc(s.picks.join(', '))} for ${esc(pkg.listing.address)}.</p>
        <p class="fine"><b>Test checkout:</b> no card is charged. On the live site this step is Stripe, and the postcards go to your mail vendor's cart.</p>`,
        [['Approve and order (test)', 'pay'], ['Cancel', 'cancel', 'line']]);
      if(v !== 'pay') return;
      s.ordered = {at: new Date().toISOString(), picks: s.picks.slice(), size: pkg.order.size, test: true};
      store.event(pkg.id, 'library-order', {picks: s.picks, size: pkg.order.size, cost: s.cost, test: true});
      save(true); libOrderButtons();
      $('#libOrderNote').textContent = `Ordered ${dayFmt(s.ordered.at)} (test).`;
    }
    const S = await spec(LIB), btns = [];
    for(const d of s.ordered.picks) for(const pt of libParts(S, d)) btns.push([`${d} ${pt.piece.kind === 'social' ? '(full size)' : pt.label.toLowerCase() + ' (print PDF)'}`, pt.piece.id, 'line']);
    const id = await ask('<h2>Your files</h2><p>Postcards open the print box at the exact size with bleed (pick Save as PDF). Social pieces open full size in a new tab.</p>', btns.concat([['Done', 'done']]), true);
    if(!id || id === 'done') return;
    const piece = S.pieces.find(p => p.id === id);
    libFile(piece);
  };
  async function libFile(piece){
    const social = piece.kind === 'social';
    const data = Object.assign(libData(), {mode: social ? 'email' : 'print', piece});
    const html = srcdoc(LIB, await tpl(LIB, piece.file), data, null, true);
    if(social){   // a real link the agent clicks (a tab opened after loading counts as a pop-up and gets blocked)
      const url = URL.createObjectURL(new Blob([html], {type: 'text/html'}));
      await ask(`<h2>${esc(piece.design)} full size</h2><p><a class="btn" href="${url}" target="_blank" rel="noopener">Open it in a new tab</a></p>
        <p class="fine">${piece.px[0]} x ${piece.px[1]} px. A one-click image download comes with the server renderer.</p>`, [['Done', 'done', 'line']]);
      return;
    }
    document.querySelectorAll('iframe.bd-print').forEach(f => f.remove());
    const fr = document.createElement('iframe');
    fr.className = 'bd-print'; fr.setAttribute('aria-hidden', 'true');
    fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0';
    fr.onload = () => Promise.resolve(fr.contentWindow.brochureReady).then(() => setTimeout(() => fr.contentWindow.print(), 300));
    document.body.appendChild(fr);
    fr.srcdoc = html;
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
        allPhotos: Object.fromEntries(pkg.photos.map((p, i) => ['p' + i, [p.room, p.desc].filter(Boolean).join(': ')])),
        example: ex, draft: {copy: d.copy, companion: d.companion}, pieces: piecesOf(pkg).map(pieceLabel)};
      const j = await ai(body);
      pkg.copy[pkg.design] = {copy: j.copy, companion: j.companion, writtenAt: new Date().toISOString(), cost: j.cost};
      if(j.master) pkg.master = j.master;   // the master copy set: any other design fits from it (no rewrite)
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
    ohFields(); approveBox(); switchTiles(); await drawFinal();
  }

  // ---------- see it in another design (brief master-copy-design-switch-10-24) ----------
  // The master copy set fits the new design in code; only a spot no saved version fits gets one small rewrite. Photo
  // picks and the agent's text edits carry over; the floor plan keeps its redrawn linework (restyled by the design).
  async function switchTiles(){
    const box = $('#switchTiles'); if(!box) return;
    const l = (await eligible()).filter(({d}) => d.id !== pkg.design);
    $('#switchBox').hidden = !l.length || !!pkg.paid;
    box.innerHTML = l.map(({d}) => `<button type="button" class="btn line" data-switch="${d.id}">${esc(d.name)}</button>`).join('');
    $$('[data-switch]').forEach(b => b.onclick = () => switchDesign(b.dataset.switch));
  }
  const allStrings = o => typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(allStrings) : [];
  async function switchDesign(id){
    const say = t => { $('#swProgress').textContent = t; }, name = (designs.find(d => d.id === id) || {}).name || 'that design';
    $$('[data-switch]').forEach(b => b.disabled = true);
    try {
      const from = pkg.design;
      if(!pkg.arrangements[id]) pkg.arrangements[id] = arrangement(pkg, from).slice();   // the agent's photo picks carry over
      if(!pkg.copy[id]){
        if(!pkg.master){ say(`This package was written before designs could switch, so ${name} needs its own writing. Use Back to the rough draft and Finalize again.`); return; }
        say(`Fitting your copy to ${name}…`);
        await PT.load();
        const ex = await example(id), ids = arrangement(pkg, id).map(i => 'p' + i);
        // a design with more photo spots than the package has photos borrows from the listing's other photos (the
        // picker's lower box) before it repeats any; only the ones it places join the package
        const more = (pkg.morePhotos || []).filter(m => !pkg.photos.some(p => p.url === m.url));
        const extra = MasterFit.photoSpots(ex) > ids.length ? more.map((_, i) => 'm' + i) : [];
        const roomOf = pid => (pid[0] === 'm' ? more[+pid.slice(1)] : pkg.photos[+pid.slice(1)] || {}).room || '';
        const r = MasterFit.fit(pkg.master, ex, {ids, extra, roomOf, heading: PT.heading,
          base: {copy: draftCopy(ids), companion: draftCompanion(ids)}});
        const usedM = [...new Set(JSON.stringify([r.copy, r.companion]).match(/"m\d+"/g) || [])].map(q => q.slice(1, -1));
        if(usedM.length){
          const newId = {};
          for(const m of usedM){ pkg.photos.push(Object.assign({}, more[+m.slice(1)])); newId[m] = 'p' + (pkg.photos.length - 1); }
          pkg.arrangements[id] = arrangement(pkg, id).concat(usedM.map(m => +newId[m].slice(1)));
          const swap = o => typeof o === 'string' ? (newId[o] || o) : Array.isArray(o) ? o.map(swap) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, swap(v)])) : o;
          r.copy = swap(r.copy); r.companion = swap(r.companion);
          resolvePhotos(pkg);   // the added photos load like the rest
        }
        // the agent's edits: the same saved text in the new design takes their version (refit when it won't fit)
        const exLen = path => String(path.split('.').reduce((o, k) => o == null ? o : o[k], {copy: ex.copy, companion: ex.companion}) || '').length;
        const walk = (o, p) => typeof o === 'string' ? [[p, o]] : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => walk(v, p ? `${p}.${k}` : k)) : [];
        for(const e of pkg.textEdits || []) for(const [p, t] of walk({copy: r.copy, companion: r.companion}, '')) if(t === e.before){
          if(e.after.length <= exLen(p) * 1.06) MasterFit.place(r, p, e.after);
          else r.refits.push({path: p, budget: exLen(p), label: 'your edit', key: 'edit', versions: [e.after]});
        }
        let cost = 0, flagged = [];
        if(r.refits.length){
          say(`Rewriting ${r.refits.length} ${r.refits.length === 1 ? 'spot' : 'spots'} to fit ${name}, then checking every line…`);
          for(let i = 0; i < r.refits.length; i += 40){   // the function takes up to 40 spots a call
            const j = await ai({action: 'refit', packageId: pkg.id, slots: r.refits.slice(i, i + 40), facts: pkg.master.facts, listing: pkg.listing,
              photos: Object.fromEntries(pkg.photos.map((p, i) => ['p' + i, p.desc || ''])), others: allStrings(r.companion)});   // reuse is checked within the new design (fold-over vs its other pieces), never against the design it replaces
            for(const [p, t] of Object.entries(j.texts || {})) MasterFit.place(r, p, t);
            cost += j.cost || 0; flagged = flagged.concat(j.flagged || []);
          }
        }
        pkg.copy[id] = {copy: r.copy, companion: r.companion, writtenAt: new Date().toISOString(), fromMaster: true, refits: r.refits.length, cost, flagged};
        store.event(pkg.id, 'design-switch', {from, to: id, refits: r.refits.length, flagged: flagged.length, cost});
      }
      pkg.design = id; save();
      const fl = (pkg.copy[id].flagged || []).length;
      say(fl ? `Here it is in ${name}. ${fl} ${fl === 1 ? 'spot needs' : 'spots need'} a look: click it to change it.` : `Here it is in ${name}.`);
      await switchTiles(); await drawFinal();
    } catch(e) { say("We couldn't switch just now. Your proof is unchanged; try again."); }
    finally { $$('[data-switch]').forEach(b => b.disabled = false); }
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
    const before = getPath(pkg.copy[pkg.design], edit.path);
    setPath(pkg.copy[pkg.design], edit.path, v);
    pkg.edits = (pkg.edits || 0) + 1;
    // kept for a design switch: the same text in the new design takes the agent's version (refit if it won't fit)
    pkg.textEdits = (pkg.textEdits || []).filter(x => x.after !== before).concat([{before: (pkg.textEdits || []).find(x => x.after === before)?.before || before, after: v}]);
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
    pkg.brandAtOrder = brandKit();
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
    if(data.preview || data.planPreview || PT.isPreview(JSON.stringify([data.copy, data.companion]))){
      await ask('<h2>Not ready to download</h2><p>This piece still has rough-draft text. Finalize the design first.</p>', [['OK', 'ok', 'line']]); return; }
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
