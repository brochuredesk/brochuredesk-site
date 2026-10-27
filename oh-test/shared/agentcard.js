/* templates/_shared/agentcard.js: the Right panel contact card (design 4), the standard contact card for every BrochureDesk
   design set (owner, 10/25/2026; brief docs/briefs/contact-card-right-panel-standard-10-25.md, which replaced the Ledger
   brief the same night). Ported from the 10/25 redesign (Contact Card Redesign (10-25)/build/cc-designs.js, design 4).

   The card: full width at the bottom of the panel. With a headshot, the photo bleeds off the card's left edge at full
   height; with none, a 3 pt stripe in the agent's accent color sits at the left edge and the card closes up (no empty
   box). Agent column: name, REALTOR(R), then the cell number beside the email and website, then the fine print. The
   brokerage panel sits flush to the right edge, tinted with the agent's accent color, logo and office lines centered.

   Each design gives it its own look through CSS variables (falling back to the design's own tokens):
     --cc-paper  --cc-ink  --cc-muted  --cc-accent  --cc-line  --cc-display (name, typeset brokerage)  --cc-body
   The layout is the same in every design. Units are pt.

     ContactCard.html(box, agent, brand, opts) -> html     box [x, y, w, h] in pt inside the panel
     ContactCard.fit(root)                                   lay out every card under root (after fonts load; it refits
                                                             itself when the logo or headshot finishes loading)
     ContactCard.check(root) -> issues                       print checks (call at check time, after images load)

   agent: name, designation ('Realtor' -> REALTOR(R)) or nar, phoneLabel, phone, email, web, headshot (url or '')
   brand: brokerage, logo (url or ''), shape ('wide' | 'square' | 'tall'; read from the logo when not given), phone,
          web, address (one or two lines: a string with '\n' or an array), officeLabel
   opts:  layout 'panel' (agent column | brokerage panel; fold-over backs, Open House flyers) or 'band' (the brokerage
          on a tinted band along the card's bottom; postcard backs, too narrow for a 204 pt panel beside a headshot).
          Default by box width: 420 pt and up panel, else band.
          size   type-size preset (SIZES key): 'full' (fold-over), 'mid' (Open House flyers), 'short' (cards about
                 0.9 in tall), 'band'. Default: full at 600 pt and wider, mid under that, band for the band layout.
          fine   the fine-print line printed on the card (6 pt), or '' when the piece prints its own
          grow   pt the card may grow upward for square and stacked logos or a two-line address (default 10)
          s      size overrides
          brokerage false  the piece shows its one logo elsewhere: no panel, the agent column only
          logoStyle        extra style on the logo image (a white knockout filter on dark fields)
          bottomGap        pt every line of contact text keeps above the card's bottom edge while fitting (Ivory: 0.5)
          panelBg          the panel's fill when the card sits on a colored field (else the guarded accent tint)
          floor            type floor in pt for the checks (default 8; the Open House library passes 8.6 so type
                           prints at 8 pt after the home-printer scale-down)

   Rules (10/25): one card, with or without a headshot. Long names shrink to the floor, then the website drops, then the
   name breaks at the hyphen (the website comes back if there's room); a name with no hyphen that still won't fit breaks
   first over last, and on a narrow card a hyphenated name whose first line still won't fit goes first over the
   hyphenated last name, then three lines. A long typeset brokerage name shrinks first. Square and stacked logos also get the brokerage name
   set in type under the mark (the lettering inside those marks prints too small for TREC). The office number stays
   9-10 pt so it never competes with the cell. Logos keep their true shape inside a max-width/max-height box. The card
   carries the panel's one brokerage logo.

   Tint guard: the panel tint is the accent mixed into the paper. Before mixing, an accent that is very light is darkened
   and one that is very saturated is toned down, so the panel always reads as a soft tint; the panel's text must keep
   4.5:1 contrast on it, and the accent used for small labels keeps 4.5:1 on the paper. */
(function(){
  const PT = 96 / 72;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[c]);
  const SIZES = {
    full:  {pad: [16, 24, 10], hsGap: 22, stripeGap: 27, name: 30, nameFloor: 22, desig: 8, label: 8, phone: 20, line: 10, office: 9,
            rowGap: 24, panelW: 204, panelPad: [10, 16], panelGap: 9, hsW: 100, fineH: 0,
            logo: {wide: [160, 48], square: [52, 52], tall: [56, 56]}, lock: 15, type: 16, typeW: 172, typeLines: 3, tint: 12},
    mid:   {pad: [10, 16, 8], hsGap: 16, stripeGap: 19, name: 24, nameFloor: 17, desig: 8, label: 8, phone: 16, line: 9, office: 9,
            rowGap: 18, panelW: 160, panelPad: [8, 12], panelGap: 7, hsW: 76,
            logo: {wide: [128, 36], square: [40, 40], tall: [44, 44]}, lock: 12.5, type: 13, typeW: 136, typeLines: 3, tint: 12},
    short: {pad: [5, 12, 5], hsGap: 12, stripeGap: 15, name: 18, nameFloor: 15, desig: 8.6, label: 8.6, phone: 12.5, line: 9, office: 9,
            rowGap: 14, panelW: 170, panelPad: [5, 10], panelGap: 3, hsW: 46, inlineLabel: true, officeLH: 1.18,
            logo: {wide: [150, 30], square: [30, 30], tall: [32, 32]}, lock: 9.5, type: 12, typeW: 150, typeLines: 2, lockDir: 'right', tint: 12},
    band:  {pad: [10, 14, 6], hsGap: 12, stripeGap: 15, name: 22, nameFloor: 14, desig: 8, label: 8, phone: 14, line: 9, office: 9,
            rowGap: 14, bandH: 40, panelPad: [4, 14], panelGap: 12, hsW: 62, inlineLabel: true, wrap: true, officeLH: 1.15,
            logo: {wide: [120, 26], square: [30, 30], tall: [32, 32]}, lock: 11, type: 12, typeW: 150, typeLines: 2, lockDir: 'right', tint: 12},
  };
  const C = window.ContactCard = {SIZES};
  const V = (k, d) => `var(--cc-${k},var(--${d}))`;

  const css = `
  .cc{position:absolute;box-sizing:border-box;overflow:hidden;background:${V('paper', 'paper')};border:.45pt solid ${V('line', 'line')};
      color:${V('ink', 'ink')};font-family:${V('body', 'font-body')};text-align:left}
  .cc *{box-sizing:border-box}
  .cc .cc-stripe{position:absolute;left:0;top:0;bottom:0;width:3pt;background:${V('accent', 'accent')}}
  .cc .cc-acc{color:${V('accent', 'accent')}}
  .cc .cc-row{display:flex;height:100%}
  .cc .cc-hs{object-fit:cover;object-position:center 22%;display:block;flex:none;height:100%}
  .cc .cc-agent{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between}
  .cc .cc-name{font-family:${V('display', 'font-display')};font-weight:400;white-space:nowrap;color:${V('ink', 'ink')}}
  .cc .cc-desig,.cc .cc-lab{font-weight:600;line-height:1;letter-spacing:1.4pt;text-transform:uppercase;white-space:nowrap}
  .cc .cc-desig{color:${V('muted', 'muted')};margin-top:4pt}
  .cc .cc-phone{font-weight:700;white-space:nowrap;line-height:1.1;color:${V('ink', 'ink')}}
  .cc .cc-line,.cc .cc-office{white-space:nowrap}
  .cc .cc-office b{font-weight:600}
  .cc .cc-fine{font-size:6pt;line-height:7.5pt;color:${V('muted', 'muted')};white-space:nowrap;overflow:hidden}
  .cc .cc-panel{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden}
  .cc .cc-logo{display:flex;align-items:center;justify-content:center;flex:none}
  .cc .cc-logo img{display:block;width:auto;height:auto}
  .cc .cc-brkname{font-family:${V('display', 'font-display')};line-height:1.32;color:${V('ink', 'ink')};overflow:hidden;flex:none}
  .cc .cc-lock{font-weight:600;line-height:1.15;color:${V('ink', 'ink')};white-space:nowrap}`;
  const addCss = () => { if(document.getElementById('cc-css')) return; const st = document.createElement('style'); st.id = 'cc-css'; st.textContent = css; document.head.appendChild(st); };

  const addrLines = b => [].concat(b.address || []).flatMap(a => String(a).split('\n')).map(s => s.trim()).filter(Boolean).slice(0, 2);

  C.html = (box, agent, brand, opts) => {
    addCss();
    opts = opts || {};
    const [x, y, w, h] = box, a = agent || {}, b = brand || {};
    const layout = opts.layout || (w >= 420 ? 'panel' : 'band');
    const S = Object.assign({}, SIZES[opts.size || (layout === 'band' ? 'band' : w >= 600 ? 'full' : 'mid')], opts.s || {});
    const hs = !!a.headshot, fine = opts.fine || '', brk = opts.brokerage !== false;
    const desig = a.designation || (a.nar ? 'Realtor' : '');
    const lockSize = Math.max(S.lock, S.name * 0.5 + 0.5);   // TREC: at least half the name's start size
    const name = `<div class="cc-name" data-slot="agent.name" data-name="${esc(a.name)}" data-size="${S.name}" data-floor="${S.nameFloor}" style="font-size:${S.name}pt;line-height:${S.name * 1.12}pt">${esc(a.name)}</div>`;
    const desigHTML = desig ? `<div class="cc-desig" style="font-size:${S.desig}pt">${esc(/^realtor/i.test(desig) ? 'REALTOR®' : desig)}</div>` : '';
    const lab = esc(a.phoneLabel || 'Call / Text');
    const line = (k, t, cls = '') => t ? `<div class="cc-line ${cls}" data-slot="agent.${k}" style="font-size:${S.line}pt;line-height:${S.line * 1.3}pt">${esc(t)}</div>` : '';
    // the label sits over the cell number; on short and band cards it rides on the number's line, to save height
    const phone = S.inlineLabel
      ? `<div class="cc-phone" data-slot="agent.phone" style="font-size:${S.phone}pt"><span class="cc-lab cc-acc" style="font-size:${S.label}pt;margin-right:6pt;vertical-align:1.5pt">${lab}</span>${esc(a.phone)}</div>`
      : `<div class="cc-lab cc-acc cc-lab-over" style="font-size:${S.label}pt">${lab}</div><div class="cc-phone" data-slot="agent.phone" style="font-size:${S.phone}pt;margin-top:3pt">${esc(a.phone)}</div>`;
    const contact = `<div class="cc-contact" style="display:flex;flex-wrap:${S.wrap ? 'wrap' : 'nowrap'};column-gap:${S.rowGap}pt;align-items:flex-end"><div style="flex:none">${phone}</div><div class="cc-lines" style="flex:none">${line('email', a.email)}${line('web', a.web, 'cc-web')}</div></div>`;
    const [pt, px, pb] = S.pad, left = hs ? S.hsGap : S.stripeGap;
    const agentCol = `<div class="cc-agent" data-fit="agent" style="padding:${pt}pt ${px}pt ${pb}pt ${left}pt">` +
      `<div class="cc-nameblock" style="overflow:hidden;flex:none">${name}${desigHTML}</div>${contact}` +
      (fine ? `<div class="cc-fine" data-slot="back.footnote" data-fine="1">${esc(fine)}</div>` : '') + `</div>`;
    const photo = hs ? `<img class="cc-hs" data-slot="agent.headshot" src="${esc(a.headshot)}" alt="" style="width:${S.hsW}pt">` : '';

    // brokerage: wide wordmark alone; square or stacked mark plus the name in type; no logo, the name in type
    const ad = addrLines(b), olh = S.officeLH || 1.33, ol = (t, slot, cls = '') => `<div class="cc-office ${cls}" data-slot="${slot}" style="font-size:${S.office}pt;line-height:${S.office * olh}pt">${t}</div>`;
    const offLines = ad.map(t => ol(esc(t), 'broker.address')).join('') +
      (b.phone ? ol(`${esc(b.officeLabel || 'Office')} <b>${esc(b.phone)}</b>`, 'broker.phone') : '') + (b.web ? ol(esc(b.web), 'broker.web', 'cc-brkweb') : '');
    const below = S.lockDir !== 'right';
    const mark = b.logo
      ? `<div class="cc-mark" style="display:flex;flex-direction:${below ? 'column' : 'row'};align-items:center;gap:${below ? 5 : 8}pt">` +
          `<div class="cc-logo"><img src="${esc(b.logo)}" alt="" data-slot="broker.logo" style="${esc(opts.logoStyle || '')}"></div>` +
          `<div class="cc-lock" data-slot="broker.name" style="font-size:${lockSize}pt;display:none">${esc(b.brokerage)}</div></div>`
      : `<div class="cc-brkname" data-fit="brk-name" data-slot="broker.name" data-size="${S.type}" data-lines="${S.typeLines}" style="font-size:${S.type}pt;max-width:${S.typeW}pt">${esc(b.brokerage)}</div>`;
    const [qy, qx] = S.panelPad, bg = opts.panelBg ? `background:${opts.panelBg}` : '';
    const panel = !brk ? '' : layout === 'band'
      ? `<div class="cc-panel cc-band" data-fit="panel" style="height:${S.bandH}pt;flex-direction:row;gap:${S.panelGap}pt;padding:${qy}pt ${qx}pt;${bg}">${mark}<div style="text-align:left">${offLines}</div></div>`
      : `<div class="cc-panel" data-fit="panel" style="width:${S.panelW}pt;gap:${S.panelGap}pt;padding:${qy}pt ${qx}pt;${bg}">${mark}<div>${offLines}</div></div>`;
    const stripe = hs ? '' : '<div class="cc-stripe cc-accbg"></div>';
    const inner = layout === 'band'
      ? `<div style="display:flex;flex-direction:column;height:100%"><div class="cc-row" style="flex:1;min-height:0">${photo}${agentCol}</div>${panel}</div>`
      : `<div class="cc-row">${photo}${agentCol}${panel}</div>`;
    return `<div class="cc cc-${layout}" data-contactcard data-layout="${layout}" data-h="${h}" data-grow="${opts.grow != null ? opts.grow : 10}" data-shape="${esc(b.shape || '')}" data-bgap="${+opts.bottomGap || 0}"` +
      ` data-floor="${opts.floor || 8}" data-brk="${brk ? 1 : 0}" data-tinted="${opts.panelBg ? 0 : 1}" data-opts="${esc(JSON.stringify(S))}" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${h}pt">${stripe}${inner}</div>`;
  };

  // ---- colors: the tint guard ----
  const rgb = s => { const m = String(s).match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if(mx !== mn){ const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l]; };
  const fromHsl = ([h, s, l]) => { if(!s) return [l, l, l].map(v => Math.round(v * 255));
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1/6 ? p + (q - p) * 6 * t : t < 1/2 ? q : t < 2/3 ? p + (q - p) * (2/3 - t) * 6 : p; };
    return [f(h + 1/3), f(h), f(h - 1/3)].map(v => Math.round(v * 255)); };
  const mix = (a, b, k) => a.map((v, i) => Math.round(v * k + b[i] * (1 - k)));
  const css3 = c => `rgb(${c.join(',')})`;
  // an accent tamed for the tint: lightness held to 22-55%, saturation to 55% or less
  C.guard = accent => { const [h, s, l] = toHsl(accent); return fromHsl([h, Math.min(s, 0.55), Math.min(0.55, Math.max(0.22, l))]); };
  const colors = card => {
    const probe = document.createElement('div'); probe.style.cssText = `position:absolute;visibility:hidden;color:${V('accent', 'accent')};background:${V('paper', 'paper')}`;
    card.appendChild(probe); const cs = getComputedStyle(probe), acc = rgb(cs.color); let paper = rgb(cs.backgroundColor);
    if(/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor)) paper = [255, 255, 255];
    probe.remove();
    const S = JSON.parse(card.dataset.opts), ink = rgb(getComputedStyle(card).color), g = C.guard(acc);
    // the tint: the guarded accent at the design's share (12%), lighter still if the panel text would drop under 4.5:1
    let k = S.tint / 100, tint = mix(g, paper, k);
    while(contrast(ink, tint) < 4.5 && k > 0.04){ k -= 0.02; tint = mix(g, paper, k); }
    // small accent labels (CALL / TEXT): the agent's accent, darkened until it reads on the paper
    let la = acc; for(let i = 0; i < 12 && contrast(la, paper) < 4.5; i++){ const [h, s, l] = toHsl(la); la = fromHsl([h, Math.min(s, 0.8), l - 0.06]); }
    return {tint: css3(tint), label: css3(la), stripe: css3(g), guarded: g.join(',') !== acc.join(',') || k < S.tint / 100};
  };

  // ---- fitting ----
  const shapeOf = (card, img) => card.dataset.shape || (() => { const r = img.naturalWidth / img.naturalHeight; return !r ? 'wide' : r < 0.85 ? 'tall' : r < 1.6 ? 'square' : 'wide'; })();
  const vis = e => !!(e.offsetParent || e.getClientRects().length);
  const overflow = card => {
    const bad = [];
    card.querySelectorAll('[data-fit]').forEach(e => { if(!vis(e)) return;
      if(e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) bad.push(e.dataset.fit); });
    // the name never runs wider than its column (it is clipped there, so check it by its own width)
    card.querySelectorAll('.cc-name').forEach(e => { if(e.scrollWidth > e.clientWidth + 1) bad.push('name'); });
    const ag = card.querySelector('.cc-agent'), ar = ag.getBoundingClientRect();   // nothing in the agent column runs past it
    ag.querySelectorAll('*').forEach(e => { if(!vis(e)) return; const q = e.getBoundingClientRect(); if(q.width && q.right > ar.right + 1) bad.push('agent-width:' + (e.dataset.slot || e.className)); });
    const r = card.getBoundingClientRect(), k = r.width / card.offsetWidth || 1;
    // opts.bottomGap (pt): no line of contact text may end closer than this to the card's bottom edge (owner 10/25/2026:
    // the contact info never touches the bottom line). Opt-in per piece; Ivory passes 0.5.
    const bg = +card.dataset.bgap || 0;
    if(bg) card.querySelectorAll('.cc-agent *, .cc-panel *').forEach(e => { if(!vis(e) || ![...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) return;
      const rg = document.createRange(); rg.selectNodeContents(e);
      if([...rg.getClientRects()].some(q => q.width && q.bottom > r.bottom - bg * PT * k)) bad.push('bottom-gap:' + (e.dataset.slot || e.className)); });
    card.querySelectorAll('*').forEach(e => { if(!vis(e) || e.classList.contains('cc-stripe')) return; const q = e.getBoundingClientRect();
      if(q.width && (q.right > r.right + k || q.left < r.left - k || q.bottom > r.bottom + k || q.top < r.top - k)) bad.push('outside:' + (e.dataset.slot || e.className || e.tagName)); });
    return bad;
  };

  const fitOne = card => {
    const S = JSON.parse(card.dataset.opts), layout = card.dataset.layout;
    const n = card.querySelector('.cc-name'), web = card.querySelector('.cc-web'), brkweb = card.querySelector('.cc-brkweb');
    const name = n.dataset.name, start = +n.dataset.size, floor = +n.dataset.floor;
    const steps = [];
    // reset (fit runs again once the logo loads)
    const lo = card.querySelector('.cc-lab-over');
    if(lo && card.dataset.inline){ const ph = lo.nextElementSibling; lo.classList.remove('cc-lab-over');
      lo.style.cssText += `;display:inline;margin-right:6pt;vertical-align:1.5pt`; ph.style.marginTop = '0'; ph.prepend(lo); }
    n.textContent = name; card.classList.remove('two-line'); if(web) web.style.display = ''; if(brkweb) brkweb.style.display = '';
    const top0 = card.dataset.top0 ? +card.dataset.top0 : parseFloat(card.style.top); card.dataset.top0 = top0;
    card.style.top = top0 + 'pt'; card.style.height = card.dataset.h + 'pt';

    // colors (tint guard)
    // (a card on a colored field keeps the field's own accent and panel: the piece set them for that field)
    const col = colors(card);
    if(card.dataset.tinted === '1'){
      card.querySelectorAll('.cc-acc').forEach(e => e.style.color = col.label);
      card.querySelectorAll('.cc-accbg').forEach(e => e.style.background = col.stripe); }
    const panel = card.querySelector('.cc-panel');
    if(panel && card.dataset.tinted === '1') panel.style.background = col.tint;
    card.dataset.tint = col.tint; card.dataset.tintGuarded = col.guarded ? '1' : '';

    // logo: true shape inside its max box; square and stacked marks show the name in type and the card grows
    const img = card.querySelector('.cc-logo img'), lock = card.querySelector('.cc-lock');
    let grow = 0;
    if(img){
      const shape = img.naturalWidth ? shapeOf(card, img) : (card.dataset.shape || 'wide'), [lw, lh] = S.logo[shape] || S.logo.wide;
      img.style.maxWidth = lw + 'pt'; img.style.maxHeight = lh + 'pt'; img.parentElement.style.height = lh + 'pt';
      if(lock) lock.style.display = shape === 'wide' ? 'none' : '';
      if(shape !== 'wide' && S.lockDir !== 'right') grow += 10;
      card.dataset.logoShape = shape;
    }
    if(card.querySelectorAll('[data-slot="broker.address"]').length > 1) grow += S.lockDir === 'right' ? 12 : 10;
    grow = Math.min(grow, +card.dataset.grow);
    if(grow){ card.style.height = (+card.dataset.h + grow) + 'pt'; card.style.top = (top0 - grow) + 'pt';
      if(layout === 'band') panel.style.height = (S.bandH + grow) + 'pt'; }

    // the brokerage panel: a typeset name shrinks first (never under half the name's start size: TREC), then the
    // brokerage web line drops, then the logo box gets shorter (never under 0.85 x the name's start size)
    const panelOver = () => panel && panel.scrollHeight > panel.clientHeight + 1;
    const bt = card.querySelector('.cc-brkname');
    if(bt){ const lines = +bt.dataset.lines || 2;
      for(let s = +bt.dataset.size; s >= Math.max(8, start * 0.5) - 0.01; s -= 0.5){ bt.style.fontSize = s + 'pt'; bt.style.maxHeight = (s * 1.32 * lines + 1) + 'pt';
        if(bt.scrollWidth <= bt.clientWidth + 1 && bt.scrollHeight <= bt.clientHeight + 3 && !panelOver()) break; } }
    // band: a typeset name that wrapped is shrink-wrapped to its longest line, so the name and the office lines sit
    // centered as one group on the band (owner 10/25: brokerage centered in its own space)
    if(bt && layout === 'band'){ bt.style.width = ''; const rg = document.createRange(); rg.selectNodeContents(bt);
      const rs = [...rg.getClientRects()], k = card.getBoundingClientRect().width / card.offsetWidth || 1;
      if(rs.length){ const wpx = (Math.max(...rs.map(r => r.right)) - Math.min(...rs.map(r => r.left))) / k; bt.style.width = Math.ceil(wpx + 1) + 'px'; } }
    if(brkweb && panelOver()){ brkweb.style.display = 'none'; steps.push('brokerage web dropped'); }
    if(img && panelOver()){ let mh = parseFloat(img.style.maxHeight);
      while(panelOver() && mh > start * 0.85 + 1){ mh -= 1; img.style.maxHeight = mh + 'pt'; img.parentElement.style.height = mh + 'pt'; } }

    // the name: shrink to the floor, then drop the website, then break at the hyphen (or first over last)
    const setSize = s => { n.style.fontSize = s + 'pt'; n.style.lineHeight = (s * 1.12) + 'pt'; };
    const tryFit = () => { for(let s = start; s >= floor - 0.01; s -= 0.5){ setSize(s); if(!overflow(card).length) return s; } return 0; };
    const breakAt = (i, keep) => { n.innerHTML = esc(name.slice(0, i + keep)) + '<br>' + esc(name.slice(i + 1)); card.classList.add('two-line'); };
    let size = tryFit();
    if(!size && web){ web.style.display = 'none'; steps.push('website dropped'); size = tryFit(); }
    const hy = name.indexOf('-'), sp = name.trim().indexOf(' ');
    if(!size && hy > 0){ breakAt(hy, 1); steps.push('broke at hyphen'); size = tryFit();
      // a narrow card whose first line is still too wide: first over the hyphenated last name, then three lines
      if(!size && sp > 0 && sp < hy){ breakAt(sp, 0); steps.push('first over last'); size = tryFit(); }
      if(!size && sp > 0 && sp < hy){ n.innerHTML = esc(name.slice(0, sp)) + '<br>' + esc(name.slice(sp + 1, hy + 1)) + '<br>' + esc(name.slice(hy + 1)); steps.push('three lines'); size = tryFit(); } }
    else if(!size && sp > 0){ breakAt(sp, 0); steps.push('first over last'); size = tryFit(); }
    // the website comes back if the broken name leaves room for it
    if(size && web && web.style.display === 'none' && card.classList.contains('two-line')){
      web.style.display = ''; if(overflow(card).length) web.style.display = 'none'; else steps.splice(steps.indexOf('website dropped'), 1); }
    // last: the label over the cell number moves onto the number's line, and the name gets the line it gave up
    const over = card.querySelector('.cc-lab-over');
    if(!size && over && !card.dataset.inline){ card.dataset.inline = '1'; return fitOne(card); }
    if(!size) setSize(floor);
    if(size && size < start) steps.unshift(`name ${start}→${size} pt`);
    if(card.dataset.inline) steps.push('label on the number line');
    card.dataset.steps = steps.join(', ');
    card.dataset.namePt = size || floor;
  };

  C._overflow = overflow;   // for test runners
  C.fit = root => {
    (root || document).querySelectorAll('.cc[data-contactcard]').forEach(card => {
      fitOne(card);
      card.querySelectorAll('img').forEach(i => { if(!i.complete) i.addEventListener('load', () => fitOne(card), {once: true}); });
    });
  };

  // ---- print checks: overflow, 8 pt minimum (6 pt fine print), TREC broker-name size, stretched logo, missing image,
  //      headshot under 300 ppi, panel text contrast (tint guard) ----
  C.check = root => {
    const issues = [];
    (root || document).querySelectorAll('.cc[data-contactcard]').forEach(card => {
      if(card.querySelector('.cc-logo img') && !card.dataset.logoShape) fitOne(card);
      const add = (kind, o) => issues.push(Object.assign({slot: 'contact-card', kind}, o));
      overflow(card).forEach(x => add('overflow', {detail: 'contact card: ' + x}));
      card.querySelectorAll('*').forEach(e => {
        if(!vis(e) || ![...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) return;
        const fs = parseFloat(getComputedStyle(e).fontSize) / PT, min = e.closest('.cc-fine') ? 6 : +card.dataset.floor || 8;
        if(fs < min - 0.05) add('type-too-small', {pt: +fs.toFixed(1), detail: e.textContent.trim().slice(0, 30)});
      });
      // TREC: broker name at least half the largest contact text. Typeset names are measured by size; a wide wordmark
      // prints its name at about 0.6 of the logo height, so the logo must be at least 0.85 x the largest text.
      const big = Math.max(...[...card.querySelectorAll('.cc-name, .cc-phone')].filter(vis).map(e => parseFloat(getComputedStyle(e).fontSize) / PT));
      const lg = card.querySelector('.cc-logo img'), typed = [...card.querySelectorAll('.cc-brkname, .cc-lock')].find(vis);
      if(card.dataset.brk === '0'){ /* the piece's own logo, checked by the piece (AgentCard.trec) */ }
      else if(typed){ const s = parseFloat(getComputedStyle(typed).fontSize) / PT;
        if(s < big * 0.5 - 0.05) add('trec-broker-too-small', {detail: `broker name ${s.toFixed(1)} pt, largest ${big.toFixed(1)} pt`}); }
      else if(lg){ const hpt = lg.getBoundingClientRect().height / (card.getBoundingClientRect().height / card.offsetHeight || 1) / PT;
        if(hpt < big * 0.85 - 0.05) add('trec-broker-too-small', {detail: `logo ${hpt.toFixed(1)} pt tall, largest ${big.toFixed(1)} pt`}); }
      else add('trec-broker-missing', {detail: 'no brokerage name or logo on the card'});
      if(lg && lg.naturalWidth){ const q = lg.getBoundingClientRect(), d = (q.width / q.height) / (lg.naturalWidth / lg.naturalHeight);
        if(Math.abs(d - 1) > 0.02) add('logo-stretched', {detail: `drawn ${d.toFixed(2)} x its true shape`}); }
      card.querySelectorAll('img').forEach(i => { if(!i.complete || !i.naturalWidth) add('image-missing', {slot: i.dataset.slot || 'contact-card', detail: i.getAttribute('src') || ''}); });
      const hs = card.querySelector('.cc-hs');
      if(hs && hs.naturalWidth){ const sc = Math.max(hs.clientWidth / hs.naturalWidth, hs.clientHeight / hs.naturalHeight), ppi = 96 / sc;
        if(ppi < 300) add('photo-under-300ppi', {slot: 'agent.headshot', ppi: Math.round(ppi)}); }
      // tint guard: every line on the panel keeps 4.5:1 on the tint; the accent labels keep 4.5:1 on the paper
      const panel = card.querySelector('.cc-panel');
      if(panel && card.dataset.tinted === '1'){ const bg = rgb(getComputedStyle(panel).backgroundColor);
        panel.querySelectorAll('*').forEach(e => { if(!vis(e) || ![...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) return;
          const r = contrast(rgb(getComputedStyle(e).color), bg); if(r < 4.5) add('tint-contrast', {detail: `${e.textContent.trim().slice(0, 24)}: ${r.toFixed(1)}:1 on the panel`}); }); }
      const paper = rgb(getComputedStyle(card).backgroundColor);
      if(!/rgba\(.*,\s*0\)/.test(getComputedStyle(card).backgroundColor))
        card.querySelectorAll('.cc-acc').forEach(e => { if(!vis(e)) return; const r = contrast(rgb(getComputedStyle(e).color), paper);
          if(r < 4.5) add('accent-contrast', {detail: `${e.textContent.trim()}: ${r.toFixed(1)}:1 on the paper`}); });
    });
    return issues;
  };

  // a summary for test runners: name size, steps taken, logo shape, tint
  C.report = root => [...(root || document).querySelectorAll('.cc[data-contactcard]')].map(c => ({namePt: +c.dataset.namePt, steps: c.dataset.steps || '', shape: c.dataset.logoShape || 'none', layout: c.dataset.layout, tint: c.dataset.tint, tintGuarded: !!c.dataset.tintGuarded}));
})();
/* AgentCard: what the Open House library and older tests still call (10/24/2026 API). The 10/24 card itself is retired;
   every card is the Right panel card now. */
(function(){
  const AC = window.AgentCard = {};
  const PT = 96 / 72;
  AC.TEST_SET = {names: ['Jordan Reyes', 'Christopher Montgomery', 'Alexandria Rodriguez-Garza', 'Maximiliana Vanderhoeven-Castillo'],
    email: 'maximiliana.vanderhoeven-castillo@anybrokeragehouston.com', phones: ['832.555.0188', '713.555.0142']};
  AC.fit = root => { ContactCard.fit(root); return []; };
  // A logo is never stretched: its drawn shape matches the file's (object-fit contain or scale-down draws it true)
  AC.logoCheck = els => [].concat(els || []).filter(Boolean).flatMap(l => {
    const img = l.tagName === 'IMG' ? l : l.querySelector('img'); if(!img || !img.naturalWidth || !img.clientWidth) return [];
    if(/contain|scale-down/.test(getComputedStyle(img).objectFit)) return [];
    const a = img.clientWidth / img.clientHeight, n = img.naturalWidth / img.naturalHeight;
    return Math.abs(a / n - 1) > 0.02 ? [{slot: 'logo', kind: 'logo-stretched', detail: `drawn ${a.toFixed(2)}:1, file ${n.toFixed(2)}:1`}] : [];
  });
  // TREC for a logo the piece shows outside the card: at least half the agent-name size. Run after the fit.
  // (A card that carries the brokerage checks its own, in ContactCard.check.)
  AC.trec = (root, logo) => {
    const issues = [], nm = [...(root || document).querySelectorAll('.cc-name')].find(e => e.offsetParent);
    if(!nm) return issues;
    const ns = parseFloat(getComputedStyle(nm).fontSize), els = logo ? [].concat(logo) : [];
    const typed = [...(root || document).querySelectorAll('.logo .text')].filter(e => e.offsetParent && !e.closest('.cc'));
    typed.forEach(t => { const s = parseFloat(getComputedStyle(t).fontSize);
      if(s < ns * 0.5 - 0.5) issues.push({slot: 'logo', kind: 'trec-broker-too-small', detail: `brokerage name ${(s / PT).toFixed(1)} pt, agent name ${(ns / PT).toFixed(1)} pt`}); });
    if(!els.length && !typed.length && !(root || document).querySelector('.cc[data-brk="1"]')) issues.push({slot: 'logo', kind: 'trec-logo-missing', detail: 'no broker logo found for the TREC size check'});
    els.forEach(l => { const hpx = l.getBoundingClientRect().height;
      if(hpx < ns * 0.5 - 0.5) issues.push({slot: 'logo', kind: 'trec-logo-too-small', detail: `logo ${(hpx / PT).toFixed(1)} pt tall, agent name ${(ns / PT).toFixed(1)} pt`}); });
    return issues;
  };
})();
