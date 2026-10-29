/* Picture gallery for the unlisted test pages /preview/ivory/, /preview/answer-book/ and /preview/two-sided-flyers/.
   Reads ./pieces.json (written by the main repo's scripts/publish_preview_gallery.py): groups of pieces, each with its
   rendered sides. A piece not approved yet gets a small gray "In review" tag here on the page, never on the piece.
   Click a picture to see it full size. */
(function(){
  const root = document.getElementById('gallery'); if(!root) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const big = document.getElementById('big');
  fetch('pieces.json').then(r => r.json()).then(spec => {
    document.getElementById('g-title').textContent = spec.title + ' · test page'; document.title = spec.title + ' · test';
    document.getElementById('g-lede').textContent = spec.lede;
    const all = spec.groups.flatMap(g => g.items), rev = all.filter(i => !i.approved).length;
    document.getElementById('g-count').textContent = `${all.length} pieces: ${all.length - rev} approved, ${rev} in review.`;
    root.innerHTML = spec.groups.map(g => `<section class="grp"><h2>${esc(g.title)} <span class="n">${g.items.length}</span></h2>${g.note ? `<p class="note">${esc(g.note)}</p>` : ''}
      ${g.items.map(i => `<article class="piece" id="${esc(i.id.replace(/\s+/g, '-'))}"><h3>${esc(i.id)} <span class="t">${esc(i.title)}</span>${i.approved ? '' : `<span class="rev" title="Not approved yet${i.review && i.review.length ? ': ' + esc(i.review.join(' and ')) : ''}">In review</span>`}</h3>
        <div class="imgs">${i.images.map(m => `<figure><a href="${esc(m.src)}" data-big><img src="${esc(m.src)}" alt="${esc(i.id + ' ' + m.label)}" width="${m.wh[0]}" height="${m.wh[1]}" loading="lazy"></a><figcaption>${esc(m.label)}</figcaption></figure>`).join('')}</div></article>`).join('')}</section>`).join('');
  }).catch(e => { root.textContent = 'The pieces did not load: ' + e.message; });
  root.addEventListener('click', e => { const a = e.target.closest('a[data-big]'); if(!a || !big) return; e.preventDefault();
    big.querySelector('img').src = a.getAttribute('href'); big.hidden = false; });
  if(big) big.addEventListener('click', () => { big.hidden = true; big.querySelector('img').removeAttribute('src'); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && big) big.hidden = true; });
})();
