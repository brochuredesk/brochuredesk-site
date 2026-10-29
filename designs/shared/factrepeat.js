/* A write-up never repeats a fact the same piece already shows (the owner, 10/28/2026).
   Beds, baths, square feet, year built, lot size, stories and garage spaces printed as facts (a fact row, a stats bar,
   an icon list) are not said again in a paragraph on the same piece. Runs on every render (renderer/render.py, every
   design and piece kind) after the template's own checks, and templates may use it to leave such sentences out.
     FactRepeat.facts(text)            -> ['bed:3', 'bath:2', 'sqft:1385', 'year:1940', ...]  what a text states
     FactRepeat.repeats(sentence, shown) -> the facts in `sentence` that a list of shown fact texts already states
     FactRepeat.check()                -> [{slot, kind:'repeats-shown-fact', detail}]   empty = passes
   A paragraph is any [data-slot] element of 8 words or more that ends like a sentence (not a fact row or fine print); everything else on the piece (every text outside that
   paragraph, scripts and styles left out) counts as shown. A year counts only where the piece shows it as the year built. */
(function(){
  const WORDS = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, single:1};
  const num = s => { s = String(s).toLowerCase().replace(/,/g, ''); return WORDS[s] != null ? WORDS[s] : parseFloat(s); };
  const N = '(\\d[\\d,]*(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|single)';
  const RX = [
    ['bed', new RegExp(`\\b${N}[\\s-]+(?:bed(?:room)?s?|br)\\b`, 'g')],
    ['bath', new RegExp(`\\b${N}[\\s-]+(?:full[\\s-]+)?(?:bath(?:room)?s?|ba)\\b`, 'g')],
    ['bath', new RegExp(`\\b${N}\\s+full\\b`, 'g')],
    ['half', new RegExp(`\\b${N}[\\s-]+half(?:[\\s-]+bath(?:room)?s?)?\\b`, 'g')],
    ['lot', new RegExp(`\\b${N}[\\s-]*(?:sq\\.?\\s*ft\\.?|square[\\s-]+f(?:ee|oo)t|acres?)[\\s-]+lot\\b`, 'g')],
    ['lot', new RegExp(`\\blot(?:\\s+(?:of|size|is))?:?\\s+(?:about\\s+)?${N}[\\s-]*(?:sq\\.?\\s*ft\\.?|square[\\s-]+feet|acres?)`, 'g')],
    ['sqft', new RegExp(`\\b${N}[\\s-]*(?:sq\\.?\\s*ft\\.?|square[\\s-]+f(?:ee|oo)t|sf)\\b(?![\\s-]+lot)`, 'g')],
    ['stories', new RegExp(`\\b${N}[\\s-]+stor(?:y|ies)\\b`, 'g')],
    ['garage', new RegExp(`\\b${N}[\\s-]+car\\s+garage\\b`, 'g')],
  ];
  function facts(text, opts){
    const t = String(text || '').toLowerCase().replace(/[‐-—]/g, '-'), out = new Set();
    for(const [k, rx] of RX){ rx.lastIndex = 0; let m; while((m = rx.exec(t))){ const v = num(m[1]); if(isFinite(v) && v > 0) out.add(`${k}:${v}`); } }
    if(/\ball on one (floor|level)\b|\bsingle[\s-]+level\b/.test(t)) out.add('stories:1');
    // years: as the year built where it is shown ("Built in 1940", "Year built 1940"); any mention in a paragraph
    if(opts && opts.shown){ const rx = /\b(?:built(?:\s+in)?|year\s+built:?)\s+((?:18|19|20)\d\d)\b/g; let m; while((m = rx.exec(t))) out.add('year:' + m[1]); }
    else { const rx = /\b((?:18|19|20)\d\d)\b/g; let m; while((m = rx.exec(t))) out.add('year:' + m[1]); }
    return [...out];
  }
  const LABEL = {bed:'bedrooms', bath:'baths', half:'half baths', sqft:'square feet', year:'year built', lot:'lot size', stories:'stories', garage:'garage'};
  function repeats(sentence, shownTexts){
    const shown = new Set(shownTexts.flatMap(t => facts(t, {shown: true})));
    return facts(sentence).filter(f => shown.has(f));
  }
  // a fact row ("3 bedrooms | 2 baths | 1,385 square feet", slots fact.*, *.facts, *.stats) is what is shown, never a write-up;
  // fine print (a disclosure such as "Square footage from HCAD") is never one either
  const PROSE = el => !el.dataset.fine && !/fine ?print/i.test(el.dataset.slot) && !/(^|\.)(facts?|stats?\d*|status)(\.|\d|$)/i.test(el.dataset.slot) && /[a-z][.!?](\s|$)/i.test(el.textContent);
  const wordsIn = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  function visible(el){ const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  function textOutside(el){
    const parts = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: n => {
      for(let p = n.parentElement; p; p = p.parentElement){ if(p === el || /^(SCRIPT|STYLE|TEMPLATE)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT; }
      return visible(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }});
    while(w.nextNode()) parts.push(w.currentNode.textContent);
    return parts.join('\n');
  }
  function check(){
    const out = [];
    for(const el of document.querySelectorAll('[data-slot]')){
      if(!visible(el) || wordsIn(el.textContent) < 8 || el.querySelector('[data-slot]') || !PROSE(el)) continue;
      const hit = repeats(el.textContent, [textOutside(el)]);
      if(hit.length) out.push({slot: el.dataset.slot, kind: 'repeats-shown-fact',
        detail: `the write-up repeats ${hit.map(f => `${LABEL[f.split(':')[0]]} (${f.split(':')[1]})`).join(', ')}, already shown on this piece`});
    }
    return out;
  }
  window.FactRepeat = {facts, repeats, check};
})();
