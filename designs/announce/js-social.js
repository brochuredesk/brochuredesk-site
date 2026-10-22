/* Just Sold social posts (approved: JS-S01, S02, S03, S04, S06; all 1080 x 1350). Ported from
   docs/briefs/approved-designs-handoff/briefs/just-sold/src/social.py. Every post carries the logo, the seller CTA,
   the agent's name and phone (email under them). Address and agent name stay inside the middle 3:4 (x 34-1046).
   Script fonts never sit on photos. Copy comes from data only (annlib.js lists the fields). */
(function(){
  const A = ANN;
  // social logos are never under 70 px (handoff social.py logo override)
  const logo = (kind, x, y, h, st) => {
    const h2 = Math.max(h, 70); if(h2 > h) x -= (h2 - h) * 10 / 3 / 2;
    return A.logo(kind, Math.round(x), y - (h2 - h) / 2, h2, st);
  };
  // a line of type that shrinks to fit its width (long headline wordings, long street names)
  const fit = (text, font, size, maxW, ls) => {
    const w = A.textWidth(text, font.replace('{s}', size)) + (ls || 0) * String(text).length;
    return w > maxW ? Math.floor(size * maxW / w * 10) / 10 : size;
  };
  // agent block (handoff AG): name 46 px, phone 36 px, email 26 px under it; the CTA question sits above
  function AG(color, font, sub, align, size, cta, ctaColor){
    sub = sub || color; size = Math.max(size || 46, 46);
    const c = cta ? `<div style="font:600 32px/1.3 '${font}';color:${ctaColor || color};margin-bottom:14px">${cta}</div>` : '';
    return `<div style="text-align:${align || 'left'}">${c}<div data-fitw="22" style="font:600 ${size}px/1.12 '${font}';color:${color};white-space:nowrap;overflow:hidden">${A.name}</div>` +
      `<div style="font:600 36px/1.3 '${font}';color:${sub};margin-top:4px">${A.phone}</div>` +
      `<div style="font:400 26px/1.35 '${font}';color:${sub}">${A.email}</div></div>`;
  }
  const split = () => [A.U(A.headSplit[0]), A.U(A.headSplit[1])];

  // S01 airy serif headline with gray photo slivers at the edges
  A.design('JS-S01', {card: 'sold',
    render(A){
      let h = A.ph('kitchen', 0, 150, 170, 420, 'filter:grayscale(1)') + A.ph('living', 860, 0, 220, 360, 'filter:grayscale(1)') + A.ph('front', 640, 1000, 300, 350, 'filter:grayscale(.85)');
      h += logo('black', 70, 50, 92) + A.box(560, 96, 450, 2, '#222');
      const [l1, l2] = split(), hs = fit(l1.length > l2.length ? l1 : l2, "400 {s}px 'bodoni-moda'", 250, 960, -4 * 0.0);
      h += A.t(0, 420, A.W, `<div style="text-align:center;font:400 ${hs}px/0.88 'bodoni-moda';color:#1b1b1b;letter-spacing:-4px">${l1}<br>${l2}</div>`);
      const al = `${A.U(A.addr)} &middot; ${A.U(A.cityOnly)}`;
      h += A.t(0, 890, A.W, `<div style="text-align:center;font:500 ${fit(al.replace(/&middot;/g, '-'), "500 {s}px 'jost'", 30, 940, 6)}px 'jost';letter-spacing:6px;color:#444">${al}</div>`);
      h += A.t(70, 1010, 540, AG('#1b1b1b', 'jost', '#444', 'left', 46, A.ctaHead));
      h += A.box(70, 1290, 520, 2, '#222');
      return {html: h, bg: '#f1ece6', font: 'jost', color: '#1d1d1d'};
    }
  });

  // S02 bold headline, rounded-square photo (not a circle) over a black block + dot grid
  A.design('JS-S02', {card: 'sold',
    render(A){
      let dots = '';
      for(let i = 0; i < 10; i++) for(let j = 0; j < 7; j++) dots += `<div class="a" style="left:${780 + i * 22}px;top:${150 + j * 22}px;width:6px;height:6px;border-radius:50%;background:#111"></div>`;
      const hu = A.U(A.head), hs = fit(hu, "800 {s}px 'montserrat'", 120, 960, -2);
      let h = A.t(60, 50, 960, `<div style="font:800 ${hs}px/1 'montserrat';color:#111;letter-spacing:-2px;white-space:nowrap">${hu}</div>`);
      h += dots + A.box(60, 260, 380, 640, '#111');
      h += A.ph('front', 150, 210, 800, 760, 'border-radius:60px');
      const ad = `${A.addr}, ${A.cityOnly}`;
      h += A.t(60, 1010, 640, `<div style="font:700 ${fit(ad, "700 {s}px 'montserrat'", 34, 640)}px 'montserrat';color:#111;white-space:nowrap">${ad}</div>` +
        `<div style="font:600 46px/1.2 'montserrat';color:#333;margin-top:10px">${A.ctaHead}</div>`);
      h += A.t(60, 1150, 640, `<div style="display:flex;gap:18px;align-items:center">${A.ic('phone', 54, '#111', 1.8)}<div><div data-fitw="22" style="font:700 46px 'montserrat';color:#111;white-space:nowrap;overflow:hidden;width:560px">${A.name}</div>` +
        `<div style="font:600 36px 'montserrat';color:#111">${A.phone}</div><div style="font:400 26px 'montserrat';color:#333">${A.email}</div></div></div>`);
      h += logo('black', 720, 1190, 84);
      return {html: h, bg: '#eceef0', font: 'montserrat', color: '#1d1d1d'};
    }
  });

  // S03 dim interior, serif headline; logo, CTA, agent
  A.design('JS-S03', {card: 'sold',
    render(A){
      let h = A.ph('living', 0, 0, A.W, A.H) + A.box(0, 0, A.W, A.H, 'rgba(12,12,12,.62)');
      h += logo('white', 395, 90, 86) + A.box(120, 132, 230, 2, '#fff') + A.box(730, 132, 230, 2, '#fff');
      const [l1, l2] = split(), hs = fit(l1.length > l2.length ? l1 : l2, "500 {s}px 'playfair-display'", 200, 960);
      h += A.t(0, 420, A.W, `<div style="text-align:center;font:500 ${hs}px/0.95 'playfair-display';color:#fff">${l1}<br>${l2}</div>`);
      const al = `${A.U(A.addr)}, ${A.U(A.cityOnly)}`;
      h += A.t(0, 840, A.W, `<div style="text-align:center;font:500 ${fit(al, "500 {s}px 'montserrat'", 32, 940, 3)}px 'montserrat';letter-spacing:3px;color:#eee">${al}</div>`);
      h += A.t(0, 1000, A.W, AG('#fff', 'montserrat', '#ddd', 'center', 46, A.ctaHead));
      return {html: h, bg: '#111', font: 'montserrat', color: '#1d1d1d'};
    }
  });

  // S04 photo top, angled teal panel below
  A.design('JS-S04', {card: 'sold',
    render(A){
      const TL = '#0f6b5c';
      let h = A.ph('front', 0, 0, A.W, 760) + `<div class="a" style="left:0;top:620px;width:${A.W}px;height:730px;background:${TL};clip-path:polygon(0 22%,100% 0,100% 100%,0 100%)"></div>`;
      h += logo('white', 56, 52, 80, 'filter:drop-shadow(0 1px 6px rgba(0,0,0,.5))');
      const hu = A.U(A.head) + '!', hs = fit(hu, "800 {s}px 'montserrat'", 108, 920);
      const ad = `${A.addr}, ${A.cityOnly}`;
      h += A.t(80, 830, 920, `<div style="font:800 ${hs}px 'montserrat';color:#fff;white-space:nowrap">${hu}</div><div style="font:500 ${fit(ad, "500 {s}px 'montserrat'", 34, 920)}px 'montserrat';color:#d8efe9;margin-top:6px;white-space:nowrap">${ad}</div>`);
      h += A.t(80, 1050, 920, AG('#fff', 'montserrat', '#d8efe9', 'left', 46, A.ctaHead));
      return {html: h, bg: '#fff', font: 'montserrat', color: '#1d1d1d'};
    }
  });

  // S06 dark glass panel over the room
  A.design('JS-S06', {card: 'sold',
    render(A){
      let h = A.ph('living', 0, 0, A.W, A.H) + A.box(0, 0, 560, A.H, 'rgba(20,24,26,.84)');
      h += logo('white', 70, 80, 74);
      const [l1, l2] = split(), hs = fit(l1.length > l2.length ? l1 : l2, "700 {s}px 'montserrat'", 128, 440);
      h += A.t(70, 300, 460, `<div style="font:700 ${hs}px/0.95 'montserrat';color:#fff">${l1}<br>${l2}</div><div style="font:400 31px/1.45 'montserrat';color:#ddd;margin-top:36px">${A.ctaShort} ${A.ctaNext}</div>`);
      h += A.box(0, 940, 560, 410, '#cfe3e0');
      h += A.t(70, 940, 460, A.flexc(410, `<div style="font:500 28px/1.35 'montserrat';color:#1f2a2c;margin-bottom:34px">${A.addr}<br>${A.city}</div>` + AG('#1f2a2c', 'montserrat', '#333', 'left', 46), 'flex-start'));
      return {html: h, bg: '#111', font: 'montserrat', color: '#1d1d1d'};
    }
  });
})();
