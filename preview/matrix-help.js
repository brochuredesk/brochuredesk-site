// "How do I create a Matrix link?" walkthrough: a short looping animation drawn with HTML/CSS, no video, no outside files.
// Rewritten 10/19/2026 from a real run-through on HAR's Matrix (Members Only Portal > ACCESS MATRIX MLS > search the MLS# >
// tick the listing > Email > Preview > copy the address of the tab that opens). Preview opens the public listing page without
// sending anything, and that page's address is exactly the link the reader takes.
// Self-contained: this file adds its own styles and dialog, so a page only needs a button with data-mx-help and this script.
// The screens are a simplified look in BrochureDesk's colors, not a copy of HAR's screens or logos.
// EASY TO EDIT: step titles, captions and button words live in MATRIX_STEPS below.
(function(){
  const MATRIX_STEPS = [
    {screen:'portal',  seconds:4.5, url:'har.com/memberonlyarea',                     title:'Open Matrix',         caption:'On HAR.com, go to the Members Only Portal and click ACCESS MATRIX MLS.'},
    {screen:'search',  seconds:4.5, url:'matrix.harmls.com',                          title:'Find your listing',   caption:'Type your listing’s MLS number in the search box at the top and press Enter.'},
    {screen:'results', seconds:4.5, url:'matrix.harmls.com/Matrix/Results',           title:'Choose Email',        caption:'Tick the box next to your listing, then click Email in the Actions bar.'},
    {screen:'email',   seconds:5,   url:'matrix.harmls.com/Matrix/EmailTagged',       title:'Click Preview',       caption:'Click Preview at the bottom. You don’t need to fill anything in or send an email.'},
    {screen:'copy',    seconds:5,   url:'matrix.harmls.com/Matrix/Public/Portal.aspx?ID=10461877392', title:'Copy the address', caption:'Your listing opens in a new tab. Copy the web address at the top of that tab.'},
    {screen:'paste',   seconds:4.5, url:'brochuredesk.com',                           title:'Paste it here',       caption:'Come back to BrochureDesk, paste it in the box and click Go. That’s it.'}
  ];

  const CSS = `
#mx-help{border:0;padding:0;margin:auto;max-width:min(680px,calc(100vw - 24px));width:100%;background:#FBFBF9;color:#1E2226;box-shadow:0 20px 60px rgba(30,34,38,.35);
  --mx-ink:#1E2226;--mx-slate:#4A5157;--mx-line:#D5D6D1;--mx-marble:#ECECE9;--mx-emerald:#1F4D3F;--mx-brass:#9C7B45;--mx-navy:#1d2f6f;--mx-red:#d63a3a;
  font-family:"Figtree",system-ui,-apple-system,sans-serif}
#mx-help::backdrop{background:rgba(30,34,38,.55)}
#mx-help .mxin{padding:clamp(16px,3vw,28px);display:grid;gap:14px}
#mx-help .mxhead{display:flex;justify-content:space-between;align-items:center;gap:12px}
#mx-help .mxhead h3{margin:0;font-family:"Bodoni Moda",Georgia,serif;font-weight:400;font-size:clamp(22px,3vw,28px);line-height:1.1}
#mx-help .mx-close{border:1px solid var(--mx-line);background:#fff;border-radius:2px;font:600 14px inherit;font-family:inherit;padding:8px 12px;cursor:pointer;color:var(--mx-ink)}
#mx-help .mx-stage{position:relative;aspect-ratio:16/10;background:var(--mx-marble);border:1px solid var(--mx-line);overflow:hidden;container-type:inline-size}
#mx-help .mx-win{position:absolute;inset:5% 4%;background:#fff;border:1px solid #C9CBC6;box-shadow:0 6px 18px rgba(30,34,38,.12);font-size:clamp(8px,2.4cqw,13px);overflow:hidden}
#mx-help .mx-bar{position:absolute;left:0;right:0;top:0;height:2.6em;display:flex;gap:.5em;align-items:center;padding:0 .8em;border-bottom:1px solid var(--mx-line);background:#F4F4F1;z-index:2}
#mx-help .mx-bar b{width:.7em;height:.7em;border-radius:50%;background:#CFCFCA;flex:none}
#mx-help .mx-url{flex:1;margin-left:.6em;background:#fff;border:1px solid var(--mx-line);border-radius:1em;padding:.2em .9em;color:var(--mx-slate);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .3s,color .3s}
#mx-help .mx-scr{position:absolute;left:0;right:0;top:2.6em;bottom:0;opacity:0;transition:opacity .45s;padding:1em;display:flex;flex-direction:column;gap:.7em}
#mx-help .mx-stage[data-s="portal"] .mx-scr.portal,#mx-help .mx-stage[data-s="search"] .mx-scr.search,#mx-help .mx-stage[data-s="results"] .mx-scr.results,
#mx-help .mx-stage[data-s="email"] .mx-scr.email,#mx-help .mx-stage[data-s="copy"] .mx-scr.copy,#mx-help .mx-stage[data-s="paste"] .mx-scr.paste{opacity:1}
#mx-help .mx-ln{height:.65em;background:#E4E4E0;border-radius:.4em}
#mx-help .mx-ln.s{width:45%}#mx-help .mx-ln.m{width:70%}#mx-help .mx-ln.l{width:90%}
#mx-help .mx-btn{display:inline-flex;align-items:center;border:1px solid #B9BBB5;background:#fff;padding:.4em .9em;border-radius:2px;font-weight:600;color:var(--mx-ink);white-space:nowrap}
#mx-help .mx-field{border:1px solid #B9BBB5;padding:.45em .7em;color:var(--mx-slate);background:#fff;display:flex;gap:.6em;align-items:center}
#mx-help .mx-field i{font-style:normal;color:var(--mx-slate);min-width:4em}
#mx-help .mx-nav{margin:-1em -1em 0;background:var(--mx-navy);color:#fff;padding:.6em 1em;display:flex;gap:1.2em;font-weight:600;font-size:.9em}
#mx-help .mx-nav span{opacity:.85}
/* portal */
#mx-help .portal .mx-cols{display:grid;grid-template-columns:1.4fr 1fr;gap:1em;flex:1}
#mx-help .portal h4{margin:0;font-size:1.5em}
#mx-help .portal .mx-card{background:#e9ecf8;padding:1em;display:flex;flex-direction:column;gap:.6em;align-items:flex-start}
#mx-help .portal .mx-red{background:var(--mx-red);color:#fff;border-color:var(--mx-red);border-radius:.3em;font-weight:700;letter-spacing:.02em}
#mx-help .portal .mx-box{border:1px solid var(--mx-line);padding:.8em;display:grid;gap:.5em}
/* search */
#mx-help .search .mx-q{display:flex;margin-top:1em}
#mx-help .search .mx-q .mx-field{flex:1;border-radius:2px 0 0 2px}
#mx-help .search .mx-go{background:var(--mx-navy);color:#fff;border-color:var(--mx-navy);border-radius:0 2px 2px 0}
/* results */
#mx-help .results .mx-row{display:flex;gap:.8em;align-items:center;border:1px solid var(--mx-line);padding:.6em;background:#fff}
#mx-help .mx-tick{width:1em;height:1em;border:1.5px solid #9AA0A5;flex:none;position:relative;background:#fff}
#mx-help .results .mx-acts{display:flex;gap:.4em;flex-wrap:wrap;background:var(--mx-navy);padding:.45em;border-radius:.3em}
#mx-help .results .mx-acts .mx-btn{border-color:transparent;background:#fff}
/* email */
#mx-help .email h4{margin:0;font-size:1.2em}
#mx-help .email .mx-body{height:3.4em}
#mx-help .email .mx-foot{margin-top:auto;display:flex;gap:.5em;border-top:1px solid var(--mx-line);padding-top:.6em}
#mx-help .email .mx-send{background:var(--mx-navy);color:#fff;border-color:var(--mx-navy);opacity:.55}
/* copy */
#mx-help .copy .mx-list-card{display:grid;grid-template-columns:9em 1fr;gap:1em;margin-top:.4em}
#mx-help .mx-ph{background:linear-gradient(135deg,#cfd8d3,#9fb3a9);height:6.5em}
#mx-help .copy .mx-copied{align-self:flex-start;background:var(--mx-emerald);color:#F4F2EC;border-color:var(--mx-emerald);opacity:0}
/* paste */
#mx-help .paste .mx-brand{font-family:"Bodoni Moda",Georgia,serif;font-size:1.4em}
#mx-help .paste .mx-q{display:flex;gap:.5em}
#mx-help .paste .mx-q .mx-field{flex:1}
#mx-help .paste .mx-go2{background:var(--mx-emerald);color:#F4F2EC;border-color:var(--mx-emerald)}
#mx-help .mx-typed{display:inline-block;overflow:hidden;white-space:nowrap;max-width:0;vertical-align:bottom;color:var(--mx-ink)}
/* the thing to click this step */
#mx-help .mx-hot{box-shadow:0 0 0 0 rgba(31,77,63,.0)}
#mx-help .mx-stage.go[data-s="portal"] .portal .mx-hot,#mx-help .mx-stage.go[data-s="search"] .search .mx-hot,#mx-help .mx-stage.go[data-s="results"] .results .mx-hot,
#mx-help .mx-stage.go[data-s="email"] .email .mx-hot,#mx-help .mx-stage.go[data-s="paste"] .paste .mx-hot{animation:mxhit 1.4s 1.9s both}
@keyframes mxhit{0%{transform:none}30%{transform:scale(.94)}60%{transform:none;box-shadow:0 0 0 .35em rgba(156,123,69,.45)}100%{box-shadow:0 0 0 .35em rgba(156,123,69,0)}}
#mx-help .mx-stage.go[data-s="results"] .results .mx-tick::after{content:"";position:absolute;inset:2px;background:var(--mx-emerald);animation:mxtick 4.5s .9s both}
@keyframes mxtick{0%{opacity:0}8%,100%{opacity:1}}
#mx-help .mx-stage.go[data-s="search"] .search .mx-typed{animation:mxtype 1.1s .5s steps(8) both}
#mx-help .mx-stage.go[data-s="paste"] .paste .mx-typed{animation:mxtype 1.2s .5s steps(24) both}
@keyframes mxtype{to{max-width:30em}}
#mx-help .mx-stage.go[data-s="copy"] .mx-url{animation:mxsel 1.2s 1s both}
@keyframes mxsel{to{background:#cfe1d9;color:var(--mx-ink)}}
#mx-help .mx-stage.go[data-s="copy"] .copy .mx-copied{animation:mxshow .4s 2.6s both}
@keyframes mxshow{to{opacity:1}}
/* cursor */
#mx-help .mx-cursor{position:absolute;width:1.6em;height:1.6em;z-index:3;left:0;top:0;pointer-events:none;font-size:clamp(8px,2.4cqw,13px);
  transition:transform 1.1s cubic-bezier(.5,0,.2,1);filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
#mx-help .mx-stage[data-s="portal"] .mx-cursor{transform:translate(71cqw,21cqw)}
#mx-help .mx-stage[data-s="search"] .mx-cursor{transform:translate(83cqw,20cqw)}
#mx-help .mx-stage[data-s="results"] .mx-cursor{transform:translate(12cqw,20cqw)}
#mx-help .mx-stage[data-s="email"] .mx-cursor{transform:translate(25cqw,50cqw)}
#mx-help .mx-stage[data-s="copy"] .mx-cursor{transform:translate(50cqw,8.5cqw)}
#mx-help .mx-stage[data-s="paste"] .mx-cursor{transform:translate(84cqw,18.5cqw)}
#mx-help .mx-cap{font-size:17px;min-height:3.2em;margin:0}
#mx-help .mx-dots{display:flex;gap:7px}
#mx-help .mx-dots span{width:26px;height:4px;background:var(--mx-line)}
#mx-help .mx-dots span.on{background:var(--mx-emerald)}
#mx-help .mx-list{margin:0;padding-left:1.3em;display:none;font-size:16px}
#mx-help .mx-list li{margin-bottom:8px}
#mx-help .mxfoot{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
#mx-help .mx-replay{display:inline-flex;border:0;border-radius:2px;background:var(--mx-emerald);color:#F4F2EC;font:600 15px/1 inherit;font-family:inherit;padding:12px 18px;cursor:pointer}
#mx-help .mx-note{font-size:13px;color:var(--mx-slate)}
#mx-help.still .mx-stage,#mx-help.still .mx-cap,#mx-help.still .mx-dots,#mx-help.still .mx-replay{display:none}
#mx-help.still .mx-list{display:block}
@media (prefers-reduced-motion:reduce){#mx-help .mx-cursor,#mx-help .mx-scr{transition:none}}`;

  const HTML = `
<div class="mxin">
  <div class="mxhead"><h3 id="mx-help-h">How to get your Matrix link</h3><button type="button" class="mx-close">Close</button></div>
  <div class="mx-stage" aria-hidden="true">
    <div class="mx-cursor"><svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4 2l15 9-6.5 1.5L9 19z" fill="#1E2226" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg></div>
    <div class="mx-win">
      <div class="mx-bar"><b></b><b></b><b></b><span class="mx-url"></span></div>
      <div class="mx-scr portal">
        <h4>Members Only Portal</h4>
        <div class="mx-cols">
          <div class="mx-box"><div class="mx-ln m"></div><div class="mx-ln l"></div><div class="mx-ln s"></div><div class="mx-ln m"></div></div>
          <div class="mx-card"><span class="mx-btn mx-red mx-hot">ACCESS MATRIX MLS</span><div class="mx-ln m"></div><div class="mx-ln s"></div></div>
        </div>
      </div>
      <div class="mx-scr search">
        <div class="mx-nav"><span>MY MATRIX</span><span>ADD/EDIT</span><span>SEARCH</span><span>TAX</span></div>
        <div class="mx-q"><div class="mx-field">Enter Shorthand or MLS# <span class="mx-typed">&nbsp;42988262</span></div><span class="mx-btn mx-go mx-hot">Search</span></div>
        <div class="mx-ln m"></div><div class="mx-ln s"></div>
      </div>
      <div class="mx-scr results">
        <div class="mx-row"><i class="mx-tick"></i><span style="font-weight:600">42988262</span><span style="flex:1">5317 Pease Street</span><span>A</span></div>
        <div class="mx-acts"><span class="mx-btn mx-hot">Email</span><span class="mx-btn">Print/Email PDF</span><span class="mx-btn">CMA</span><span class="mx-btn">Text/Share</span></div>
        <div class="mx-ln m"></div><div class="mx-ln s"></div>
      </div>
      <div class="mx-scr email">
        <h4>Email 1 Listing</h4>
        <div class="mx-field"><i>To:</i></div>
        <div class="mx-field"><i>Subject:</i></div>
        <div class="mx-field mx-body"><i>Email Body:</i></div>
        <div class="mx-foot"><span class="mx-btn">Cancel</span><span class="mx-btn mx-hot">Preview</span><span class="mx-btn mx-send">Send</span></div>
      </div>
      <div class="mx-scr copy">
        <span class="mx-btn mx-copied">Address copied</span>
        <div class="mx-list-card"><div class="mx-ph"></div><div style="display:grid;gap:.5em;align-content:start"><b>5317 Pease Street</b><div class="mx-ln m"></div><div class="mx-ln s"></div><div class="mx-ln m"></div></div></div>
      </div>
      <div class="mx-scr paste">
        <span class="mx-brand">BrochureDesk</span>
        <div class="mx-q"><div class="mx-field"><span class="mx-typed">matrix.harmls.com/Matrix/Public/Portal.aspx?ID=…</span></div><span class="mx-btn mx-go2 mx-hot">Go</span></div>
        <div class="mx-ln m"></div><div class="mx-ln s"></div>
      </div>
    </div>
  </div>
  <p class="mx-cap" aria-live="polite"></p>
  <ol class="mx-list"></ol>
  <div class="mx-dots" aria-hidden="true"></div>
  <div class="mxfoot"><button type="button" class="mx-replay">Play again</button><span class="mx-note">You never have to send an email. Preview opens the link you need.</span></div>
</div>`;

  // add styles once; replace any older walkthrough dialog a page still has
  if (!document.getElementById('mx-help-css')) {
    const st = document.createElement('style'); st.id = 'mx-help-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const old = document.getElementById('mx-help'); if (old) old.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'mx-help'; dlg.className = 'mxdlg'; dlg.setAttribute('aria-labelledby', 'mx-help-h'); dlg.innerHTML = HTML;
  document.body.appendChild(dlg);

  const stage = dlg.querySelector('.mx-stage'), cap = dlg.querySelector('.mx-cap'), dots = dlg.querySelector('.mx-dots'), url = dlg.querySelector('.mx-url');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let timer = null;

  dlg.querySelector('.mx-list').innerHTML = MATRIX_STEPS.map(s => `<li><b>${s.title}.</b> ${s.caption}</li>`).join('');
  dots.innerHTML = MATRIX_STEPS.map((s, i) => `<span data-i="${i}"></span>`).join('');

  function show(i){
    const s = MATRIX_STEPS[i];
    stage.classList.remove('go'); stage.dataset.s = s.screen; void stage.offsetWidth; stage.classList.add('go');
    url.textContent = s.url;
    cap.textContent = `${i + 1}. ${s.caption}`;
    dots.querySelectorAll('span').forEach((d, k) => d.classList.toggle('on', k === i));
  }
  function stop(){ clearTimeout(timer); timer = null; }
  function run(i){ show(i); timer = setTimeout(() => run((i + 1) % MATRIX_STEPS.length), MATRIX_STEPS[i].seconds * 1000); }
  function play(){ stop(); dlg.classList.toggle('still', still.matches); if (still.matches) return; run(0); }

  window.openMatrixHelp = function(opener){
    if (!dlg.open) dlg.showModal();
    dlg._opener = opener || null; play();
    dlg.querySelector('.mx-close').focus();
  };
  dlg.querySelector('.mx-replay').addEventListener('click', play);
  dlg.querySelector('.mx-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { stop(); if (dlg._opener) dlg._opener.focus(); });
  still.addEventListener && still.addEventListener('change', () => { if (dlg.open) play(); });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-mx-help]'); if (b) { e.preventDefault(); window.openMatrixHelp(b); } });
})();
