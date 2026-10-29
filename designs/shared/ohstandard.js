/* Open House flyer standard: the checks a template can't pass by accident (10/19/2026).
   Runs inside a rendered Open House flyer, after the template's own print checks. The renderer calls it on every
   Open House render (renderer/render.py), and the open house picker (openhouse.js) calls it on each preview.
     OHStandard.check(D) -> [{slot, kind, detail}]   empty = passes
   What it checks:
     event-loud      the label is 20 pt or larger, the date is the largest type on the page, the time is 18 pt or larger
     event-hidden    a public open house shows no refreshments or special-notes line; an empty field draws nothing
     logo-count      exactly one brokerage logo (or one text brokerage when there is no logo file)
     qr              one QR code, at least 54 pt (0.75 in) square; none at all on pieces marked "qr": false
                     (the open house flyer library, 10/20/2026; Ivory's five Open House flyers, 10/22/2026)
     price / photo-number / staging   no listing price, no "Photo 12", no "virtually staged"
     banned-phrase   no "no pressure" wording (10/22/2026), no "rebuilt" (10/28/2026)
   The TREC broker-name size rule needs the logo's wordmark measured by eye; it is recorded with the owner's approval. */
(function(){
  const PT = 72 / 96;
  const size = el => parseFloat(getComputedStyle(el).fontSize) * PT;
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const same = (a, b) => { try { return a && b && new URL(a, document.baseURI).href === new URL(b, document.baseURI).href; } catch(e) { return false; } };

  function check(D){
    const out = [], add = (slot, kind, detail) => out.push({slot, kind, detail});
    const O = D.openHouse || {}, b = D.brand || {}, A = D.agent || {};
    const page = document.querySelector('.page') || document.body;
    const q = s => [...page.querySelectorAll(`[data-slot="${s}"]`)].filter(shown);

    // the event is first and loud
    // the date may be one line (oh.date) or a calendar tile (oh.day, the big day number)
    const label = q('oh.label')[0], date = q('oh.date')[0] || q('oh.day')[0], time = q('oh.time')[0];
    if(!label) add('oh.label', 'event-loud', 'no open house label');
    else if(size(label) < 20) add('oh.label', 'event-loud', `label is ${size(label).toFixed(1)} pt (20 pt minimum)`);
    if(O.date){
      if(!date) add('oh.date', 'event-loud', 'no date');
      else {
        const ds = size(date);
        const bigger = [...page.querySelectorAll('[data-slot]')].filter(el => shown(el) && !/^oh\./.test(el.dataset.slot) && size(el) > ds + 0.01);
        if(bigger.length) add('oh.date', 'event-loud', `${bigger[0].dataset.slot} (${size(bigger[0]).toFixed(1)} pt) is larger than the date (${ds.toFixed(1)} pt)`);
      }
    }
    if((O.start || O.timeText) && !time) add('oh.time', 'event-loud', 'no time');
    else if(time && size(time) < 18) add('oh.time', 'event-loud', `time is ${size(time).toFixed(1)} pt (18 pt minimum)`);

    // optional lines: broker and REALTOR(R) opens only, only when filled, never invented
    const pub = !O.kind || O.kind === 'public';
    [['oh.note', O.note], ['oh.refreshments', O.refreshments]].forEach(([slot, val]) => {
      const el = q(slot)[0], want = !pub && String(val || '').trim();
      if(el && !want) add(slot, 'event-hidden', pub ? 'shown on a public open house' : 'shown with no text entered');
      if(!el && want) add(slot, 'event-hidden', 'entered but not shown');
      if(el && want && el.textContent.trim() !== want) add(slot, 'event-hidden', 'text differs from what the agent entered');
    });

    // exactly one brokerage logo
    const imgs = [...page.querySelectorAll('img')].filter(shown);
    const logos = b.logo ? imgs.filter(i => same(i.getAttribute('src'), b.logo) || same(i.getAttribute('src'), b.logoOnDark) || same(i.getAttribute('src'), b.logoKnockout)).length
                         : [...page.querySelectorAll('.logo, .cc-brkname')].filter(shown).length;   // a card's typeset brokerage name (10/25)
    if(logos !== 1) add('brand.logo', 'logo-count', `${logos} brokerage logos (exactly 1 allowed)`);

    // QR code
    const qrs = A.qr ? imgs.filter(i => same(i.getAttribute('src'), A.qr)) : [];
    if(D.piece && D.piece.qr === false){ if(qrs.length) add('agent.qr', 'qr', 'this flyer takes no QR code'); }
    else if(qrs.length !== 1) add('agent.qr', 'qr', `${qrs.length} QR codes (exactly 1 needed)`);
    else { const r = qrs[0].getBoundingClientRect(), s = Math.min(r.width, r.height) * PT; if(s < 53.5) add('agent.qr', 'qr', `QR is ${s.toFixed(0)} pt (54 pt minimum)`); }

    // words that never go on a piece
    let text = page.innerText || '';   // the agent's own event lines may name co-op dollars; that isn't a listing price
    [...q('oh.note'), ...q('oh.refreshments')].forEach(el => { text = text.replace(el.innerText, ''); });
    if(/\$\s?\d/.test(text)) add('page', 'price', 'a dollar amount is on the page');
    if(/\bphoto\s*#?\s*\d+/i.test(text)) add('page', 'photo-number', 'a photo number is on the page');
    if(/virtual(ly)?\s+stag/i.test(text)) add('page', 'staging', '"virtually staged" is on the page');
    if(/\bno[\s-]+pressure\b/i.test(text)) add('page', 'banned-phrase', '"no pressure" is on the page');
    if(/\brebuil(t|d)/i.test(text)) add('page', 'banned-phrase', '"rebuilt" is on the page');
    return out;
  }
  window.OHStandard = {check};
})();
