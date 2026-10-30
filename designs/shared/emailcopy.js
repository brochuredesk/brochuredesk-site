/* designs/shared/emailcopy.js: the Open House email version panel (brief docs/briefs/open-house-email-build.md in the
   BrochureDesk repo, 10/20/2026). The agent sees the email version inside a simple mock email window, then copies
   it as ONE image and pastes it into any email (Gmail, Outlook, Apple Mail). One image, never an HTML email: pasted
   email HTML breaks in most clients and Outlook blocks hosted images. The clipboard carries the PNG and, beside it,
   a one-tag HTML copy of the same picture (<img> with the PNG inline as a data URL, width 600): the paste test of
   10/30/2026 found Gmail fitting a bare PNG to the window (260 px) and Outlook web pasting it at its full 1200 px.
   Apps that read HTML take the sized copy; the rest take the PNG.

     EmailCopy.mount(el, {png, printPng, subject, to, text, name, hooks})
       png       the 600 px email version (1200 px PNG at 2x), same origin
       printPng  optional: the print flyer, for the Print tab
       subject   the mock window's subject line; text: the plain lines for "Copy the date and address as text"
       name      file name for Download image
       hooks.log(row)        {event: 'copy'|'copy-failed'|'share'|'download'|'text-copy', flyer, browser, os, detail}
       hooks.hintSeen()      true when this agent account has seen the first-use hint (saved on the account, not
                             browser storage); hooks.markHintSeen() saves it
   Desktop: "Copy for email" (navigator.clipboard.write with a ClipboardItem of image/png and text/html; fetched ahead,
   and a Promise goes into the ClipboardItem so Safari keeps the write inside the click). Phones and tablets: "Share"
   (navigator.share with the PNG file; the agent picks Mail or Gmail). If the copy fails or isn't supported: says so in
   plain words and offers Download image right there.
   Skin: --ec-accent, --ec-ink, --ec-paper, --ec-line, --ec-font (a team page passes its team colors).
   All wording is a draft. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[c]);
  const ua = navigator.userAgent || '';
  const isMac = /Mac/i.test(navigator.platform || ua) && !/iPhone|iPad/i.test(ua);
  const touch = /iPhone|iPad|iPod|Android/i.test(ua) || (/Mac/i.test(ua) && navigator.maxTouchPoints > 1);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'other';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : isMac ? 'macOS' : /Windows/.test(ua) ? 'Windows' : 'other';
  const CLIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="12" height="16" rx="2"/><path d="M5 8v12a2 2 0 0 0 2 2h9"/><path d="M10 4V3h6v1"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';

  const CSS = `
  .ec{font-family:var(--ec-font,system-ui,sans-serif);color:var(--ec-ink,#1d2326);max-width:680px}
  .ec-tabs{display:flex;gap:6px;margin-bottom:12px}
  .ec-tab{border:1px solid var(--ec-line,#d5d8db);background:#fff;border-radius:999px;padding:7px 16px;font:600 14px inherit;cursor:pointer;color:inherit}
  .ec-tab[aria-selected="true"]{background:var(--ec-accent,#1f4e5f);border-color:var(--ec-accent,#1f4e5f);color:#fff}
  .ec-win{border:1px solid var(--ec-line,#d5d8db);border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.08)}
  .ec-bar{display:flex;gap:6px;padding:9px 12px;background:#f2f3f4;border-bottom:1px solid var(--ec-line,#d5d8db)}
  .ec-bar i{width:11px;height:11px;border-radius:50%;background:#d0d3d6;display:block}
  .ec-hd{padding:10px 16px;border-bottom:1px solid #eceef0;font-size:14px;line-height:1.7}
  .ec-hd b{display:inline-block;width:62px;color:#6b7378;font-weight:500}
  .ec-body{padding:16px;background:#fff;max-height:70vh;overflow:auto}
  .ec-body img{display:block;width:100%;max-width:600px;height:auto;margin:0 auto}
  .ec-print img{display:block;width:100%;height:auto;border:1px solid var(--ec-line,#d5d8db)}
  .ec-go{margin-top:16px;text-align:center}
  .ec-btn{display:inline-flex;align-items:center;gap:10px;border:0;border-radius:10px;padding:15px 28px;background:var(--ec-accent,#1f4e5f);color:#fff;font:700 18px inherit;cursor:pointer;min-width:260px;justify-content:center}
  .ec-btn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8}
  .ec-btn[data-done="1"]{background:#2d6a3e}
  .ec-sub{margin:8px 0 0;font-size:14px;color:#5b6468}
  .ec-links{margin-top:10px;display:flex;gap:18px;justify-content:center;flex-wrap:wrap;font-size:14px}
  .ec-links button{background:none;border:0;padding:0;color:var(--ec-accent,#1f4e5f);text-decoration:underline;cursor:pointer;font:inherit}
  .ec-msg{margin:12px auto 0;max-width:520px;padding:10px 14px;border-radius:8px;background:#fff4e5;border:1px solid #f0c98a;font-size:14px;display:none}
  .ec-msg[data-on="1"]{display:block}
  .ec-hint{position:relative;margin:12px auto 0;width:240px;height:110px;border:1px solid var(--ec-line,#d5d8db);border-radius:8px;background:#fafbfb;overflow:hidden;font-size:12px}
  .ec-hint .a,.ec-hint .b{position:absolute;inset:10px;border-radius:6px;background:#fff;border:1px solid #e3e6e8;padding:8px}
  .ec-hint .b{opacity:0;animation:ecB 3s infinite}
  .ec-hint .a{animation:ecA 3s infinite}
  .ec-hint .pic{margin-top:6px;height:46px;border-radius:4px;background:linear-gradient(135deg,var(--ec-accent,#1f4e5f),#9fb4bc)}
  @keyframes ecA{0%,40%{opacity:1}50%,100%{opacity:0}}
  @keyframes ecB{0%,45%{opacity:0}55%,100%{opacity:1}}`;

  function mount(el, o){
    const hooks = o.hooks || {};
    const log = (event, detail) => hooks.log && hooks.log({event, flyer: o.name, browser, os, detail: detail || ''});
    if(!document.getElementById('ec-css')){ const s = document.createElement('style'); s.id = 'ec-css'; s.textContent = CSS; document.head.appendChild(s); }
    const paste = isMac ? '⌘V' : 'Ctrl+V';
    const canCopy = !touch && !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
    // the PNG is fetched ahead so the click copies at once (and Safari keeps the write inside the click)
    const blob = fetch(o.png).then(r => { if(!r.ok) throw new Error('image ' + r.status); return r.blob(); })
      .then(b => b.type === 'image/png' ? b : new Blob([b], {type: 'image/png'}));
    blob.catch(() => {});
    // the same picture as one sized <img> (600 px wide at its own proportions), for mail apps that paste HTML
    const html = blob.then(b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(b); })
      .then(url => b.slice(16, 24).arrayBuffer().then(buf => {   // the PNG header holds the pixel size
        const v = new DataView(buf), w = v.getUint32(0), hh = v.getUint32(4), W = 600, H = Math.round(hh*W/w);
        return new Blob([`<img src="${url}" width="${W}" height="${H}" alt="${esc(o.text || 'Open House flyer')}" style="width:${W}px;max-width:100%;height:auto;display:block">`], {type: 'text/html'});
      })));
    html.catch(() => {});
    const fileName = (o.name || 'open-house') + '-email.png';
    el.innerHTML = `<div class="ec">
      ${o.printPng ? `<div class="ec-tabs" role="tablist"><button class="ec-tab" role="tab" data-t="print" aria-selected="false">Print</button><button class="ec-tab" role="tab" data-t="email" aria-selected="true">Email</button></div>` : ''}
      <div class="ec-pane" data-p="email">
        <div class="ec-win"><div class="ec-bar"><i></i><i></i><i></i></div>
          <div class="ec-hd"><div><b>To</b>${esc(o.to || 'Your contacts')}</div><div><b>Subject</b>${esc(o.subject || 'Open House')}</div></div>
          <div class="ec-body"><img src="${esc(o.png)}" alt="${esc(o.text || 'Open House flyer')}"></div></div>
        <div class="ec-go">
          <button class="ec-btn" type="button">${touch ? SHARE + '<span>Share</span>' : CLIP + '<span>Copy for email</span>'}</button>
          <p class="ec-sub">${touch ? 'Pick Mail or Gmail, and it goes in as the picture.' : 'Paste it into any email.'}</p>
          <div class="ec-msg" role="status"></div>
          <div class="ec-links"><button type="button" data-a="download">Download image</button>${o.text ? '<button type="button" data-a="text">Copy the date and address as text</button>' : ''}</div>
          ${!touch && hooks.hintSeen && !hooks.hintSeen() ? `<div class="ec-hint" aria-hidden="true"><div class="a">Click <b>Copy for email</b><div class="pic"></div></div><div class="b">New message · ${paste}<div class="pic"></div></div></div>` : ''}
        </div>
      </div>
      ${o.printPng ? `<div class="ec-pane ec-print" data-p="print" hidden><img src="${esc(o.printPng)}" alt="Print flyer"></div>` : ''}
    </div>`;
    const btn = el.querySelector('.ec-btn'), label = btn.querySelector('span'), msg = el.querySelector('.ec-msg');
    const say = t => { msg.innerHTML = t; msg.dataset.on = t ? '1' : ''; };
    const download = () => blob.then(b => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); log('download');
    }).catch(() => { window.location.href = o.png; });
    const failed = why => {
      log('copy-failed', why);
      say(`This browser didn't let us copy the picture. <button type="button" class="ec-dl" style="background:none;border:0;padding:0;color:inherit;font:inherit;text-decoration:underline;cursor:pointer;font-weight:600">Download image</button> instead, then attach it or drag it into your email.`);
      msg.querySelector('.ec-dl').onclick = download;
    };
    let timer = 0;
    btn.onclick = () => {
      say('');
      if(touch){
        blob.then(b => {
          const file = new File([b], fileName, {type: 'image/png'});
          if(navigator.canShare && navigator.canShare({files: [file]})) return navigator.share({files: [file], title: o.subject || 'Open House'}).then(() => log('share'));
          failed('share-unsupported');
        }).catch(e => { if(e && e.name === 'AbortError') return; failed(String(e && e.name || e)); });
        return;
      }
      if(!canCopy) return failed('clipboard-unsupported');
      // a Promise inside the ClipboardItem: Safari needs the write to start inside the click
      const item = () => new ClipboardItem({'image/png': blob, 'text/html': html});
      navigator.clipboard.write([item()]).catch(e => {   // a browser that won't take the HTML copy gets the PNG alone
        if(e && e.name === 'NotAllowedError') throw e;
        return navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
      }).then(() => {
        log('copy');
        btn.dataset.done = '1'; label.textContent = `Copied. Now paste it into your email (${paste})`;
        hooks.markHintSeen && hooks.markHintSeen();
        const h = el.querySelector('.ec-hint'); if(h) h.remove();
        clearTimeout(timer); timer = setTimeout(() => { btn.dataset.done = ''; label.textContent = 'Copy for email'; }, 6000);
      }).catch(e => failed(String(e && e.name || e)));
    };
    el.querySelector('[data-a="download"]').onclick = download;
    const tx = el.querySelector('[data-a="text"]');
    if(tx) tx.onclick = () => (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(o.text) : Promise.reject())
      .then(() => { log('text-copy'); tx.textContent = 'Copied the text'; setTimeout(() => tx.textContent = 'Copy the date and address as text', 4000); })
      .catch(() => say('Copying text isn’t allowed in this browser. Select the lines under the picture and copy them.'));
    el.querySelectorAll('.ec-tab').forEach(t => t.onclick = () => {
      el.querySelectorAll('.ec-tab').forEach(x => x.setAttribute('aria-selected', x === t));
      el.querySelectorAll('.ec-pane').forEach(p => p.hidden = p.dataset.p !== t.dataset.t);
    });
  }
  window.EmailCopy = {mount, touch, browser, os};
})();
