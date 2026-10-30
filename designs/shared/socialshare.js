/* designs/shared/socialshare.js: "Share your listing", the social sets panel (brief docs/briefs/social-graphics-build.md
   in the BrochureDesk repo, 10/20/2026). One labeled card per place agents post, grouped by moment, so the agent
   never thinks about sizes. Places that share a size share one image.

     SocialShare.mount(el, {moments, hooks})
       moments  [{id: 'jl'|'js'|'oh', title: 'Just Listed', base: 'url/to/socials-jl/', manifest: {places, carousel, files}}]
                manifest = the renderer's socials report: places [{id, label, shape, file, caption, carousel}],
                carousel [image names in order], files {name: {file}}
       hooks.log(row)          {event: 'share'|'download'|'download-all'|'copy-image'|'copy-caption'|'email-phone'|'copy-failed', place, moment, browser, os}
       hooks.hidden()          place ids this account hid; hooks.setHidden(ids) saves them on the account (not browser storage)
       hooks.emailToPhone(files, moment)   optional: the app emails the files to the agent from support@brochuredesk.com
   Phones: Share on each card (navigator.share with the files; a carousel shares every slide in order).
   Desktop: Download (a zip is the app's job; here each file in turn), Copy image (one PNG through the Clipboard API),
   Copy caption, and Email to my phone when the app passes hooks.emailToPhone.
   Wording is a draft. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[c]);
  const EC = window.EmailCopy || {};
  const touch = EC.touch != null ? EC.touch : /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const CSS = `
  .ssh{font-family:var(--ec-font,system-ui,sans-serif);color:var(--ec-ink,#1d2326)}
  .ssh h3{font:700 18px inherit;margin:22px 0 10px}
  .ssh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
  .ssh-card{border:1px solid var(--ec-line,#d5d8db);border-radius:10px;background:#fff;overflow:hidden;display:flex;flex-direction:column}
  .ssh-card[hidden]{display:none}
  .ssh-img{background:#eef0f1;display:flex;align-items:center;justify-content:center;height:220px;padding:8px}
  .ssh-img img{max-width:100%;max-height:100%;display:block;box-shadow:0 2px 8px rgba(0,0,0,.12)}
  .ssh-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px;flex:1}
  .ssh-name{font:700 15px inherit;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .ssh-hide{background:none;border:0;color:#7a8286;font-size:12px;cursor:pointer;text-decoration:underline;padding:0}
  .ssh-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}
  .ssh-btns button{border:1px solid var(--ec-line,#d5d8db);background:#fff;border-radius:7px;padding:7px 10px;font:600 13px inherit;cursor:pointer;color:inherit}
  .ssh-btns button.main{background:var(--ec-accent,#1f4e5f);border-color:var(--ec-accent,#1f4e5f);color:#fff}
  .ssh-cap{font-size:12.5px;color:#4b5357;max-height:54px;overflow:hidden;white-space:pre-line}
  .ssh-bar{display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:14px}
  .ssh-bar button{background:none;border:0;color:var(--ec-accent,#1f4e5f);text-decoration:underline;cursor:pointer;font:inherit;padding:0}
  .ssh-msg{font-size:13px;color:#8a4b00}`;

  function mount(el, o){
    const hooks = o.hooks || {};
    const hidden = new Set(hooks.hidden ? hooks.hidden() : []);
    const log = (event, place, moment, detail) => hooks.log && hooks.log({event, place, moment, browser: EC.browser, os: EC.os, detail: detail || ''});
    if(!document.getElementById('ssh-css')){ const s = document.createElement('style'); s.id = 'ssh-css'; s.textContent = CSS; document.head.appendChild(s); }
    const blobs = {};
    const get = url => blobs[url] || (blobs[url] = fetch(url).then(r => { if(!r.ok) throw new Error(r.status); return r.blob(); }));
    const save = (url, name) => get(url).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
    let html = '<div class="ssh">';
    o.moments.forEach(m => {
      html += `<h3>${esc(m.title)}</h3><div class="ssh-bar"><button type="button" data-all="${esc(m.id)}">Download all</button>${hooks.emailToPhone ? `<button type="button" data-phone="${esc(m.id)}">Email to my phone</button>` : ''}<span class="ssh-msg" data-msg="${esc(m.id)}"></span></div><div class="ssh-grid">`;
      m.manifest.places.forEach(p => {
        const src = m.base + p.file;
        html += `<div class="ssh-card" data-place="${esc(p.id)}" data-m="${esc(m.id)}"${hidden.has(p.id) ? ' hidden' : ''}>
          <div class="ssh-img"><img src="${esc(src)}" alt="${esc(p.label)}" loading="lazy"></div>
          <div class="ssh-body"><div class="ssh-name">${esc(p.label)}<button class="ssh-hide" type="button" title="Hide this place">Hide</button></div>
          ${p.caption ? `<div class="ssh-cap">${esc(p.caption)}</div>` : ''}
          <div class="ssh-btns">${touch ? '<button class="main" data-a="share" type="button">Share</button>' : '<button class="main" data-a="download" type="button">Download</button><button data-a="copy" type="button">Copy image</button>'}${p.caption ? '<button data-a="caption" type="button">Copy caption</button>' : ''}</div></div></div>`;
      });
      html += '</div>';
    });
    html += `<p class="ssh-bar" style="margin-top:14px"><button type="button" data-showall>Show hidden places</button></p></div>`;
    el.innerHTML = html;
    const find = (mid, pid) => { const m = o.moments.find(x => x.id === mid); return {m, p: m.manifest.places.find(x => x.id === pid)}; };
    const filesOf = (m, p) => (p.carousel ? m.manifest.carousel.map(n => m.manifest.files[n].file) : [p.file]);
    el.querySelectorAll('.ssh-card').forEach(card => {
      const {m, p} = find(card.dataset.m, card.dataset.place), btn = a => card.querySelector(`[data-a="${a}"]`);
      const flash = (b, t) => { const was = b.textContent; b.textContent = t; setTimeout(() => b.textContent = was, 3000); };
      if(btn('share')) btn('share').onclick = () => Promise.all(filesOf(m, p).map(f => get(m.base + f).then(b => new File([b], f, {type: b.type})))).then(files => {
        if(navigator.canShare && navigator.canShare({files})) return navigator.share({files, text: p.caption || ''}).then(() => log('share', p.id, m.id));
        files.forEach(f => save(m.base + f.name, f.name)); log('download', p.id, m.id, 'share-unsupported');
      }).catch(e => { if(!e || e.name !== 'AbortError') log('copy-failed', p.id, m.id, String(e && e.name || e)); });
      if(btn('download')) btn('download').onclick = () => { filesOf(m, p).forEach(f => save(m.base + f, `${m.id}-${p.id}-${f}`)); log('download', p.id, m.id); };
      if(btn('copy')) btn('copy').onclick = () => {
        if(!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem)){ flash(btn('copy'), 'Not in this browser: use Download'); return log('copy-failed', p.id, m.id, 'unsupported'); }
        // a PNG for the clipboard (browsers only take image/png): heavy social images may be JPG, so convert when needed
        const png = get(m.base + p.file).then(b => b.type === 'image/png' ? b : createImageBitmap(b).then(bm => { const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); return new Promise(r => c.toBlob(r, 'image/png')); }));
        navigator.clipboard.write([new ClipboardItem({'image/png': png})]).then(() => { flash(btn('copy'), 'Copied'); log('copy-image', p.id, m.id); })
          .catch(e => { flash(btn('copy'), 'Not allowed: use Download'); log('copy-failed', p.id, m.id, String(e && e.name || e)); });
      };
      if(btn('caption')) btn('caption').onclick = () => navigator.clipboard.writeText(p.caption).then(() => { flash(btn('caption'), 'Copied'); log('copy-caption', p.id, m.id); });
      card.querySelector('.ssh-hide').onclick = () => { card.hidden = true; hidden.add(p.id); hooks.setHidden && hooks.setHidden([...hidden]); };
    });
    el.querySelectorAll('[data-all]').forEach(b => b.onclick = () => {
      const m = o.moments.find(x => x.id === b.dataset.all);
      Object.values(m.manifest.files).forEach(f => save(m.base + f.file, `${m.id}-${f.file}`)); log('download-all', '', m.id);
    });
    el.querySelectorAll('[data-phone]').forEach(b => b.onclick = () => {
      const m = o.moments.find(x => x.id === b.dataset.phone), msg = el.querySelector(`[data-msg="${m.id}"]`);
      Promise.resolve(hooks.emailToPhone(Object.values(m.manifest.files).map(f => m.base + f.file), m.id))
        .then(() => { msg.textContent = 'Sent. Check your email on your phone.'; log('email-phone', '', m.id); })
        .catch(() => { msg.textContent = "That didn't send. Try Download all instead."; });
    });
    el.querySelector('[data-showall]').onclick = () => { hidden.clear(); hooks.setHidden && hooks.setHidden([]); el.querySelectorAll('.ssh-card').forEach(c => c.hidden = false); };
  }
  window.SocialShare = {mount};
})();
