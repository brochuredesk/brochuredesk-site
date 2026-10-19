/* BrochureDesk font picker, shared by every design that has a fonts.json.
   One picker per role (headings, body text). It lists only that design's approved fonts (fonts that keep the original
   fonts' width and letter heights, so the layout still fits), each name shown in its own typeface, with type-ahead.
   A name we don't carry gets a plain answer and the closest approved fonts. "Use the original fonts" resets both.

     FontPicker.mount(el, {spec, catalog, fontBase, value: {display, body}, onChange(value)})
*/
(function(){
  // Common font names we don't carry, by style, so we can suggest the closest approved ones.
  const KNOWN = {
    grotesque: 'helvetica,helvetica neue,arial,univers,akzidenz,neue haas,haas grotesk,sf pro,san francisco,din,franklin gothic,graphik,aktiv grotesk,apercu,neue montreal,suisse,arial nova,roboto',
    geometric: 'futura,avenir,avenir next,gotham,proxima nova,century gothic,brandon grotesque,circular,gilroy,sofia pro,museo sans,tt norms,eina,cera,montserrat,poppins,bauhaus,kabel,lexend',
    humanist: 'gill sans,myriad,myriad pro,frutiger,optima,segoe ui,calibri,verdana,tahoma,trebuchet,lucida grande,lucida sans,source sans,open sans,fira sans,ubuntu,corbel,candara,syntax',
    serif: 'times,times new roman,garamond,georgia,baskerville,caslon,didot,bodoni,palatino,book antiqua,cambria,minion,trajan,cormorant,libre caslon,adobe garamond,goudy,century schoolbook,canela,freight',
    slab: 'rockwell,clarendon,courier,courier new,museo slab,archer,memphis',
    script: 'brush script,lobster,pacifico,great vibes,dancing script,allura,sacramento,edwardian,snell roundhand,zapfino',
    condensed: 'impact,bebas,bebas neue,oswald,league gothic,anton,knockout,trade gothic condensed,roboto condensed,barlow condensed',
  };
  const classOf = name => { const n = name.toLowerCase().trim(); for(const [c, list] of Object.entries(KNOWN)) if(list.split(',').includes(n)) return c; return null; };
  const NEAR = {script:'serif', condensed:'grotesque', slab:'serif'};

  let css = false;
  function style(){
    if(css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `.fp{display:grid;gap:12px}.fp-role{display:grid;gap:5px;position:relative}.fp-role>span{font-size:13.5px;font-weight:600}
    .fp input{font:inherit;font-size:18px;padding:9px 12px;border:1px solid #B9BBB5;border-radius:2px;background:#fff;width:100%;min-width:0;color:#1E2226}
    .fp ul{position:absolute;z-index:20;top:100%;left:0;right:0;max-height:280px;overflow:auto;margin:2px 0 0;padding:4px 0;list-style:none;background:#fff;border:1px solid #B9BBB5;box-shadow:0 8px 22px rgba(30,34,38,.16)}
    .fp li{padding:7px 12px;font-size:18px;cursor:pointer;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
    .fp li small{font:12px system-ui,sans-serif;color:#6B7075}
    .fp li[aria-selected=true],.fp li:hover{background:#F3F7F5}
    .fp .fp-msg{display:block;padding:8px 12px 6px;font:14px/1.4 system-ui,sans-serif;color:#1E2226;cursor:default}
    .fp .fp-msg b{display:block;font-weight:600}
    .fp .fp-reset{justify-self:start}`;
    document.head.appendChild(s);
  }

  const loaded = {};
  function face(fontBase, f){
    // menu shows each name in its own face (400, or the nearest weight we have)
    if(loaded[f.id]) return;
    const w = f.weights.reduce((a,b) => Math.abs(b-400) < Math.abs(a-400) ? b : a);
    const ff = new FontFace('fp-' + f.id, `url(${fontBase}${f.id}-latin-${w}-normal.woff2)`);
    loaded[f.id] = ff.load().then(x => document.fonts.add(x)).catch(() => {});
  }

  function mount(el, o){
    style();
    const byId = Object.fromEntries(o.catalog.map(f => [f.id, f]));
    const value = Object.assign({}, o.value || {});
    el.innerHTML = '';
    el.classList.add('fp');
    const roles = Object.entries(o.spec.originals);
    for(const [role, orig] of roles){
      const approved = orig.approved.map(id => byId[id]).filter(Boolean);
      const wrap = document.createElement('label');
      wrap.className = 'fp-role';
      const lid = 'fp-' + role + '-' + Math.random().toString(36).slice(2, 7);
      wrap.innerHTML = `<span>${orig.label}</span><input role="combobox" aria-expanded="false" aria-controls="${lid}" aria-autocomplete="list" autocomplete="off" spellcheck="false"><ul role="listbox" id="${lid}" hidden></ul>`;
      el.appendChild(wrap);
      const input = wrap.querySelector('input'), list = wrap.querySelector('ul');
      let active = -1, shown = [];
      const current = () => byId[value[role] || orig.id];
      const showValue = () => { const f = current(); face(o.fontBase, f); input.value = f.name + (f.id === orig.id ? ' (original)' : ''); input.style.fontFamily = `'fp-${f.id}',system-ui`; };
      const item = (f, i) => { face(o.fontBase, f); return `<li role="option" id="${lid}-${i}" data-id="${f.id}" aria-selected="${i===active}" style="font-family:'fp-${f.id}',system-ui">${f.name}${f.id === orig.id ? '<small>original</small>' : ''}</li>`; };
      function closest(q){
        // what they asked for, if we have it in the pool, or its style from the names above; nearest approved first
        const asked = o.catalog.find(f => f.name.toLowerCase() === q.toLowerCase());
        let cls = asked ? asked.class : classOf(q);
        if(cls && NEAR[cls]) cls = NEAR[cls];
        const same = cls ? approved.filter(f => f.class === cls) : [];
        return (same.length ? same : approved).slice(0, 5);
      }
      function render(){
        const q = input.value.replace(/ \(original\)$/, '').trim().toLowerCase();
        const typed = q && document.activeElement === input && input.dataset.typed === '1';
        shown = typed ? approved.filter(f => f.name.toLowerCase().includes(q)) : approved;
        let h = '';
        if(typed && !shown.length){
          shown = closest(q);
          h = `<li class="fp-msg" role="presentation"><b>Unfortunately, this font will not work with our system.</b>Here's the closest to what you want.</li>`;
        }
        list.innerHTML = h + shown.map(item).join('');
        list.hidden = false; input.setAttribute('aria-expanded', 'true');
      }
      function close(){ list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; input.dataset.typed = ''; showValue(); }
      function pick(id){
        value[role] = id === orig.id ? undefined : id;
        close();
        o.onChange(Object.assign({}, value));
      }
      input.addEventListener('focus', () => { input.select(); render(); });
      input.addEventListener('input', () => { input.dataset.typed = '1'; active = -1; render(); });
      input.addEventListener('blur', () => setTimeout(close, 150));
      input.addEventListener('keydown', e => {
        if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
          e.preventDefault(); if(list.hidden) render();
          active = Math.max(0, Math.min(shown.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
          render(); const li = list.querySelector('[aria-selected=true]'); if(li){ li.scrollIntoView({block:'nearest'}); input.setAttribute('aria-activedescendant', li.id); }
        } else if(e.key === 'Enter'){
          e.preventDefault();
          if(active >= 0 && shown[active]) pick(shown[active].id);
          else if(shown.length === 1 || (shown[0] && shown[0].name.toLowerCase() === input.value.trim().toLowerCase())) pick(shown[0].id);
        } else if(e.key === 'Escape'){ close(); input.blur(); }
      });
      list.addEventListener('mousedown', e => { const li = e.target.closest('[data-id]'); if(li){ e.preventDefault(); pick(li.dataset.id); } });
      showValue();
    }
    const reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'linkbtn fp-reset'; reset.textContent = 'Use the original fonts';
    reset.onclick = () => { for(const [role] of roles) value[role] = undefined; mount(el, Object.assign({}, o, {value})); o.onChange(Object.assign({}, value)); };
    el.appendChild(reset);
  }

  window.FontPicker = {mount};
})();
