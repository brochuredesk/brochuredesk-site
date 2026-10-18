// "How do I create a Matrix link?" walkthrough: a short looping animation drawn with HTML/CSS, no video, no outside files.
// The screens are a simplified, generic MLS look in BrochureDesk's colors. Not a copy of anyone's screen.
// EASY TO EDIT: the words on the buttons and the captions live in MATRIX_STEPS below.
// OWNER CHECK NEEDED: the button names ("Email", "Send") are the likely ones from Matrix's own help pages, not yet confirmed on screen.
(function(){
  const MATRIX_STEPS = [
    {screen:'list',  seconds:5,  title:'Find your listing',      caption:'Open the listing in Matrix, the same way you would to send it to a client.', button:'Email'},
    {screen:'email', seconds:5,  title:'Choose Email',           caption:'Tick the listing and choose Email at the bottom. Send it to yourself.',        button:'Send'},
    {screen:'inbox', seconds:5.5,title:'Copy the link',          caption:'Open that email and copy the link to the listing.',                           button:'Copy link'},
    {screen:'paste', seconds:4.5,title:'Paste it here',          caption:'Come back to BrochureDesk and paste it in the box. That is all.',             button:'Go'}
  ];
  const dlg = document.getElementById('mx-help'); if(!dlg) return;
  const stage = dlg.querySelector('.mx-stage'), cap = dlg.querySelector('.mx-cap'), dots = dlg.querySelector('.mx-dots');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let timer = null, step = 0;

  // static numbered list: shown instead of the animation when motion is reduced
  dlg.querySelector('.mx-list').innerHTML = MATRIX_STEPS.map(s => `<li><b>${s.title}.</b> ${s.caption}</li>`).join('');
  stage.querySelectorAll('[data-btn]').forEach(el => { el.textContent = MATRIX_STEPS[+el.dataset.btn].button; });
  dots.innerHTML = MATRIX_STEPS.map((s, i) => `<span data-i="${i}"></span>`).join('');

  function show(i){
    step = i; stage.dataset.step = i;
    cap.textContent = `${i + 1}. ${MATRIX_STEPS[i].caption}`;
    dots.querySelectorAll('span').forEach((d, k) => d.classList.toggle('on', k === i));
  }
  function stop(){ clearTimeout(timer); timer = null; }
  function run(i){
    show(i);
    timer = setTimeout(() => run((i + 1) % MATRIX_STEPS.length), MATRIX_STEPS[i].seconds * 1000);
  }
  function play(){
    stop(); dlg.classList.toggle('still', still.matches);
    if(still.matches) return;
    stage.classList.remove('go'); void stage.offsetWidth; stage.classList.add('go');
    run(0);
  }
  window.openMatrixHelp = function(opener){
    if(!dlg.open) dlg.showModal();
    dlg._opener = opener || null; play();
    dlg.querySelector('.mx-close').focus();
  };
  dlg.querySelector('.mx-replay').addEventListener('click', play);
  dlg.querySelector('.mx-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if(e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { stop(); if(dlg._opener) dlg._opener.focus(); });
  still.addEventListener && still.addEventListener('change', () => { if(dlg.open) play(); });
  document.querySelectorAll('[data-mx-help]').forEach(b => b.addEventListener('click', () => window.openMatrixHelp(b)));
})();
