/* Account menu for the header's account button (initials + name). Shared by the team pages and, when it exists,
   the solo agent header; colors come from the page's own tokens (--team-* on team pages, plain look otherwise).

     AccountMenu.mount(button, items)   items: [{label, onSelect}], the last one usually Sign out
     AccountMenu.signOutStorage()       forgets everything this site remembers in the browser (session, role)

   Click or tap opens it; Enter, Space or Arrow Down opens it from the keyboard and focuses the first item. Arrow keys,
   Home and End move; Tab and Shift+Tab stay inside the menu; Escape closes and returns to the button; a click or tap
   outside closes it. */
(function(){
  let css = false;
  function style(){
    if(css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `.am-wrap{position:relative;display:inline-flex}
    .am-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:50;min-width:230px;margin:0;padding:6px 0;list-style:none;
      background:var(--paper,#fff);border:1px solid var(--line,#e2dddb);border-top:4px solid var(--team-primary,var(--emerald,#1F4D3F));
      box-shadow:0 12px 32px rgba(0,0,0,.18);font-family:var(--team-body,inherit)}
    .am-menu[hidden]{display:none}
    .am-menu button{display:block;width:100%;text-align:left;background:none;border:0;font:inherit;font-size:15px;
      color:var(--team-ink,var(--ink,#1E2226));padding:11px 18px;cursor:pointer}
    .am-menu button:hover,.am-menu button:focus{background:var(--mist,#f4f2f1);outline:none}
    .am-menu button:focus-visible{box-shadow:inset 3px 0 0 var(--team-primary,var(--emerald,#1F4D3F))}
    .am-menu li.am-sep{border-top:1px solid var(--line,#e2dddb);margin-top:6px;padding-top:6px}
    @media (max-width:640px){.am-menu{position:fixed;left:12px;right:12px;min-width:0}.am-menu button{padding:14px 18px;font-size:16px}}`;
    document.head.appendChild(s);
  }

  function mount(btn, items){
    style();
    const id = (btn.id || 'acct') + 'Menu';
    let menu = document.getElementById(id);
    if(!menu){
      const wrap = document.createElement('span'); wrap.className = 'am-wrap';
      btn.parentNode.insertBefore(wrap, btn); wrap.appendChild(btn);
      menu = document.createElement('ul'); menu.id = id; menu.className = 'am-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
      menu.setAttribute('aria-label', 'Account');
      wrap.appendChild(menu);
      btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-controls', id); btn.setAttribute('aria-expanded', 'false');
    }
    menu.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li'); li.setAttribute('role', 'none');
      if(it.separator || (i === items.length - 1 && items.length > 1)) li.className = 'am-sep';
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.tabIndex = -1; b.textContent = it.label;
      b.addEventListener('click', () => { close(false); it.onSelect(); });
      li.appendChild(b); menu.appendChild(li);
    });
    const list = () => [...menu.querySelectorAll('[role=menuitem]')];
    const isOpen = () => !menu.hidden;
    function open(focusFirst){
      // on a phone the menu spans the screen just under the button
      menu.style.top = matchMedia('(max-width:640px)').matches ? Math.round(btn.getBoundingClientRect().bottom + 8) + 'px' : '';
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
      if(focusFirst) list()[0].focus();
    }
    function close(refocus){
      if(!isOpen()) return;
      menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
      if(refocus) btn.focus();
    }
    if(btn._am) return btn._am;           // listeners already attached; items replaced above
    btn.addEventListener('click', e => { e.preventDefault(); isOpen() ? close(false) : open(e.detail === 0); });
    btn.addEventListener('keydown', e => {
      if(e.key === 'ArrowDown' || ((e.key === 'Enter' || e.key === ' ') && !isOpen())){ e.preventDefault(); open(true); }
      else if(e.key === 'Escape') close(true);
    });
    menu.addEventListener('keydown', e => {
      const l = list(), i = l.indexOf(document.activeElement);
      const go = n => { e.preventDefault(); l[(n + l.length) % l.length].focus(); };
      if(e.key === 'Escape'){ e.preventDefault(); close(true); }
      else if(e.key === 'ArrowDown') go(i + 1);
      else if(e.key === 'ArrowUp') go(i - 1);
      else if(e.key === 'Home') go(0);
      else if(e.key === 'End') go(l.length - 1);
      else if(e.key === 'Tab') go(e.shiftKey ? i - 1 : i + 1);       // focus stays in the menu until it closes
    });
    document.addEventListener('pointerdown', e => { if(isOpen() && !menu.contains(e.target) && !btn.contains(e.target)) close(false); });
    btn._am = {open, close, isOpen};
    return btn._am;
  }

  // Everything the site keeps in this browser: the Supabase session (sb-*) and our own remembered settings, such as the
  // Agent / Team-Broker role (bd-*). Cleared on sign-out so the next person on this browser starts clean.
  function signOutStorage(){
    [window.localStorage, window.sessionStorage].forEach(st => {
      try { Object.keys(st).filter(k => /^(sb-|bd-|supabase\.)/.test(k)).forEach(k => st.removeItem(k)); } catch(_) {}
    });
  }

  window.AccountMenu = {mount, signOutStorage};
})();
