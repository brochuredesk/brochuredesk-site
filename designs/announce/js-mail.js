/* Just Sold postcards (approved: JS-M03-M10 incl. M07-long, M13). Ported from
   docs/briefs/approved-designs-handoff/briefs/just-sold/src/mailA.py. Coordinates are the 6x9 design's
   (864 x 576 px at 96 px/in); sx(v) stretches a horizontal position or width for the 6x11 (1056 px) so photos
   and columns widen and type keeps its size. Copy comes from data only (annlib.js lists the fields). */
(function(){
  const A = ANN;
  const sx = v => Math.round(v * A.W / 864 * 10) / 10;
  const O = '#6f6957';
  // font size that keeps a line of text inside `avail` px (script and headline words change with the agent's wording)
  const fit = (text, weight, family, size, avail) => Math.round(Math.min(size, size * avail / A.textWidth(text, `${weight} ${size}px '${family}'`)) * 10) / 10;
  const opt = (s, pre) => s ? (pre || '') + s : '';
  const fl = (h, inner, align, just) => A.flexc(h, inner, align, just);
  // back headline on the "cta" variant: a long CTA question shrinks to one line in the 392 px column (never under 20 px)
  const backHs = (A, weight, family, size) => Math.max(20, fit(A.ctaHead, weight, family, size, A.W - 386 - 60 - 2));
  // number of lines a text takes in a column (rough, for stacks that must stay above the safe zone)
  const lines = (text, font, avail) => Math.max(1, Math.ceil(A.textWidth(text, font) / avail));

  // JS-M03 script "Just Sold" in a white band under a three-photo strip; CTA replaces the stats
  A.design('JS-M03', {card: 'sold',
    front(A){
      let h = A.ph('front', 0, 0, sx(560), 360) + A.ph('kitchen', sx(566), 0, sx(298), 177) + A.ph('living', sx(566), 183, sx(298), 177);
      const fs = fit(A.head, 400, 'mrs-saint-delafield', 104, 345);
      h += A.t(40, 360, 330, fl(150, `<div style="font:400 ${fs}px/1 'mrs-saint-delafield';color:#1e1e1e;transform:translateY(-4px);white-space:nowrap">${A.head}</div>`, 'flex-start'));
      h += A.box(sx(392), 385, 1, 100, '#bdb7ad');
      h += A.t(sx(414), 360, sx(420), fl(150, `<div style="font:600 19px 'montserrat';letter-spacing:1.5px;color:#1e1e1e">${A.U(A.addr)}</div><div style="font:500 13px 'montserrat';letter-spacing:2.5px;color:#6d665c;margin-top:4px">${A.U(A.city)}</div>` +
        `<div style="font:500 17px/1.4 'montserrat';color:#222;margin-top:12px">${A.ctaHead} ${A.ctaShort}</div>`, 'flex-start'));
      h += A.box(0, 510, A.W, 66, '#f1eee9');
      h += A.t(40, 502, sx(520), fl(66, `<div style="font:600 19px 'montserrat';color:#1e1e1e">${A.name}${A.title ? ` &nbsp;<span style="font-weight:500;color:#6d665c;font-size:15px">${A.title}</span>` : ''} &nbsp;&middot;&nbsp; ${A.phone}</div>`, 'flex-start'));
      h += A.logo('black', sx(664), 518, 50);
      return {html: h, bg: '#fff', font: 'montserrat'};
    },
    back: A => ({bg: '#fff', ink: '#1e1e1e', acc: '#6d665c', fd: 'mrs-saint-delafield', fd2: 'cormorant-garamond', fb: 'montserrat', variant: 'cta', photos: ['primary', 'lawn'], band: '#f6f4f0', hs: backHs(A, 500, 'cormorant-garamond', 28)})
  });

  // JS-M04 forest green, big round crop of the house, bold condensed headline.
  // Faithful to the approved picture: the circle cuts the house (the owner's open question), so the whole-house check flags it.
  A.design('JS-M04', {card: 'sold',
    front(A){
      const G = '#1f3a2b', Y = '#f0c75e', ex = A.W - 864;
      let h = '';
      const id = A.resolve('front');
      if(id){
        A.used.add(id);
        const p = A.D.photos[id], PA = p.w && p.h ? p.w / p.h : 1.5, S = 600;
        const [cwp, chp] = PA >= 1 ? [Math.round(S * PA * 10) / 10, S] : [S, Math.round(S / PA * 10) / 10];
        const ox = Math.round(-(cwp - S) * 0.4 * 10) / 10, oy = Math.round(-(chp - S) * 0.3 * 10) / 10;
        const hb = p.house ? ` data-house="${p.house.left},${p.house.top},${p.house.right},${p.house.bottom}"` : '';
        h += `<div class="a ph" data-photo="${A.esc(id)}"${hb} data-cw="${cwp}" data-ch="${chp}" data-ox="${ox}" data-oy="${oy}" style="left:${372 + ex}px;top:-118px;width:${S}px;height:${S}px;border-radius:50%;` +
          `background-image:url('${A.esc(p.src)}');background-repeat:no-repeat;background-size:${cwp}px ${chp}px;background-position:${ox}px ${oy}px;border:10px solid #fff"></div>`;
      } else A.issues.push({slot: 'front', kind: 'empty-photo-slot'});
      for(let i = 0; i < 6; i++) for(let j = 0; j < 3; j++)
        h += `<div class="a" style="left:${30 + i * 14}px;top:${30 + j * 14}px;width:3px;height:3px;border-radius:50%;background:${Y};opacity:.7"></div>`;
      h += A.logo('white', 34, 70, 64);
      const l1 = A.U(A.headSplit[0]), l2 = A.U(A.headSplit[1]);
      const hs = Math.min(fit(l1, 400, 'anton', 122, 330), fit(l2 || 'X', 400, 'anton', 122, 330));
      h += A.t(34, 180, 380, `<div style="font:500 15px 'montserrat';letter-spacing:3px;color:#fff">${A.U(A.addr)}</div><div style="font:400 ${hs}px/0.9 'anton';color:${Y};margin-top:10px">${l1}${l2 ? '<br>' + l2 : ''}</div>`);
      // a long CTA question or line wraps: the block moves up by the extra lines so it stays above the safe zone
      const extra = (lines(A.ctaHead, "700 30px 'montserrat'", 410) - 1) * 36 + (lines(A.ctaShort, "400 19px 'montserrat'", 410) - 1) * 27;
      h += A.t(34, 452 - extra, 420, `<div style="font:700 30px 'montserrat';color:#fff">${A.ctaHead}</div><div style="font:400 19px/1.4 'montserrat';color:#dfe8e0;margin-top:4px">${A.ctaShort}</div>`);
      h += A.t(520 + ex, 458, 316, fl(94, `<div data-fitw="16" style="text-align:right;font:600 23px 'montserrat';color:#fff;white-space:nowrap;overflow:hidden">${A.name}</div><div style="text-align:right;font:500 21px 'montserrat';color:${Y};margin-top:2px">${A.phone}</div>`, 'flex-end'));
      return {html: h, bg: G, font: 'montserrat'};
    },
    back: {bg: '#fff', ink: '#1f3a2b', acc: '#2f6a48', fd: 'anton', fd2: 'montserrat', fb: 'montserrat', variant: 'list', photos: ['kitchen'], band: '#f2f5f0', name_w: 600, name_size: 26, hw: 700}
  });

  // JS-M05 curved cream panel over the house, navy sweep with the CTA
  A.design('JS-M05', {card: 'sold',
    front(A){
      const N = '#16365c', ex = A.W - 864;
      let h = A.ph('front', 0, 0, A.W, 576, '', 'center 30%');
      h += `<svg class="a" style="left:${ex}px;top:0" width="864" height="576" viewBox="0 0 864 576"><path d="M512,0 L864,0 L864,176 C790,184 700,172 640,138 C586,106 542,58 512,0 Z" fill="#f6f1e8"/>` +
        `<path d="M430,576 C500,450 640,380 864,356 L864,576 Z" fill="${N}"/></svg>`;
      const [a, b] = A.headSplit, hs = fit(`${a} ${b}`, 800, 'playfair-display', 58, 262);
      h += A.t(568 + ex, 35, 268, `<div style="text-align:right;font:500 ${hs}px/1 'playfair-display';color:#1b1b1b;white-space:nowrap">${a} <b style='font-weight:800'>${b}</b></div><div style="text-align:right;font:500 15px 'montserrat';color:#333;margin-top:8px;letter-spacing:.5px">${A.addr}, ${A.cityOnly}</div>`);
      // the CTA, name and phone ride in the navy sweep as one stack ending where the approved picture ends (right edge inside the safe zone)
      h += A.t(516 + ex, 0, 320, fl(549, `<div style="text-align:right;font:700 27px 'montserrat';color:#fff">${A.ctaHead}</div>` +
        `<div style="text-align:right;font:400 16px 'montserrat';color:#cfe0f2;margin:2px 0 0 40px">${A.ctaShort}</div><div data-fitw="16" style="text-align:right;font:600 25px 'montserrat';color:#fff;margin-top:4px;white-space:nowrap;overflow:hidden">${A.name}</div><div style="text-align:right;font:500 22px 'montserrat';color:#cfe0f2">${A.phone}</div>`, 'flex-end', 'flex-end'));
      h += A.logo('white', 30, 28, 58, 'filter:drop-shadow(0 1px 6px rgba(0,0,0,.45))');
      return {html: h, bg: '#fff', font: 'montserrat'};
    },
    back: A => ({bg: '#fff', ink: '#1b1b1b', acc: '#16365c', fd: 'playfair-display', fb: 'montserrat', variant: 'cta', photos: ['living', 'kitchen'], hs: backHs(A, 500, 'playfair-display', 27)})
  });

  // medallion text: "Just / Sold" in script, sized to sit inside the circle
  const medallion = (size, S) => {
    const [a, b] = A.headSplit, w = Math.max(A.textWidth(a, `400 ${size}px 'allura'`), A.textWidth(b || 'x', `400 ${size}px 'allura'`));
    const fs = Math.round(Math.min(size, size * (S * 0.78) / w) * 10) / 10;
    return `<div style="font:400 ${fs}px/0.86 'allura';color:#fff;text-align:center;transform:translate(-12px,6px);white-space:nowrap" data-med>${a}${b ? '<br>' + b : ''}</div>`;
  };

  // JS-M06 round medallion beside the photo; address, CTA and agent in the right column
  A.design('JS-M06', {card: 'sold',
    front(A){
      let h = A.ph('front', 24, 24, sx(560), 528, 'border-radius:18px');
      h += `<div class="a" style="left:${sx(520)}px;top:40px;width:230px;height:230px;border-radius:50%;background:${O};border:7px solid #fff"></div>`;
      h += A.t(sx(520), 40, 230, fl(230, medallion(74, 230)));
      // a name wider than the column goes on two lines (first / last), each still shrinks to fit
      const colW = A.W - 28 - sx(596), nrow = t => `<div data-fitw="16" style="flex:none;width:100%;font:600 21px 'figtree';color:#333;white-space:nowrap;overflow:hidden">${t}</div>`;
      const nameRows = A.last && A.textWidth(A.name, "600 21px 'figtree'") > colW ? nrow(A.first) + nrow(A.last) : nrow(A.name);
      h += A.logo('black', sx(596) + (colW - 50 * 10 / 3) / 2, 506, 50, 'object-position:center');
      h += A.t(sx(596), 272, colW, fl(228, `<div style="font:600 23px/1.18 'figtree';color:#3f3b31">${A.addr}</div><div style="font:500 14px 'figtree';color:${O};margin-top:4px">${A.city}</div>` +
        `<div style="font:700 22px/1.25 'figtree';color:#333;margin-top:16px">${A.ctaHead}</div><div style="font:400 16px/1.35 'figtree';color:#444;margin-top:4px">${A.ctaShort}</div>` +
        `<div style="flex:none;width:60px;height:2px;background:${O};margin:12px 0 10px"></div>${nameRows}<div style="font:500 19px 'figtree';color:#444">${A.phone}</div>`, 'center', 'space-between'), 'text-align:center');
      return {html: h, bg: '#fff', font: 'figtree'};
    },
    back: {bg: '#fff', ink: '#3f3b31', acc: O, fd: 'allura', fd2: 'figtree', fb: 'figtree', variant: 'letter', photos: ['living'], band: '#f3f1ec', name_w: 600, name_size: 26, hw: 600}
  });

  // JS-M07 / JS-M07-long: four-room rounded mosaic + medallion; right panels = "Sold by" + seller CTA
  function m07(long){
    return function(A){
      const R = 'border-radius:14px', pw = sx(250), x2 = sx(280), px = sx(540), pwid = sx(304), cx = sx(535);
      let h = A.ph('front', sx(20), 20, pw, 262, R) + A.ph('kitchen', x2, 20, pw, 262, R) + A.ph('living', sx(20), 294, pw, 262, R) + A.ph('primary', x2, 294, pw, 262, R);
      h += A.box(px, 20, pwid, 262, O, R) + A.box(px, 294, pwid, 262, O, R);
      const label = A.listedAndSold ? 'LISTED &amp; SOLD BY' : 'ANOTHER HOME SOLD BY';
      const addrBlock = `${A.addr}<br>${A.city}`;
      const nm = `${A.first}${A.last ? '<br>' + A.last : ''}`;
      if(!long){
        const lab = A.listedAndSold ? 'LISTED &amp; SOLD<br>BY' : 'ANOTHER HOME<br>SOLD BY';
        h += A.t(sx(668), 20, sx(166), fl(262, `<div style="font:600 13.5px 'figtree';letter-spacing:2.4px;color:#e7e2d4">${lab}</div><div style="font:600 34px/1.05 'figtree';color:#fff;margin-top:10px">${nm}</div><div style="font:500 15.5px 'figtree';color:#efeadd;margin-top:14px;letter-spacing:.3px">${addrBlock}</div>`, 'flex-start'));
      } else {
        h += A.t(sx(560), 34, sx(276), `<div style="font:600 13.5px 'figtree';letter-spacing:2.4px;color:#e7e2d4;white-space:nowrap">${label}</div><div data-fitw="24" style="font:600 27px/1.08 'figtree';color:#fff;margin-top:8px;white-space:nowrap">${nm}</div>`);
        h += A.t(sx(668), 150, sx(170), `<div style="font:500 19px/1.3 'figtree';color:#efeadd;letter-spacing:.3px">${addrBlock}</div>`);
      }
      h += A.t(sx(668), 294, sx(166), fl(262, `<div style="font:700 25px/1.2 'figtree';color:#fff">${A.ctaHead}</div><div style="font:400 16.5px/1.4 'figtree';color:#efeadd;margin-top:8px">${A.ctaShort}</div>${A.logoi('white', 52, 'margin-top:16px')}`, 'flex-start'));
      h += `<div class="a" style="left:${cx - 126}px;top:166px;width:252px;height:252px;border-radius:50%;background:${O};border:7px solid #fff"></div>`;
      h += A.t(cx - 126, 166, 252, fl(252, medallion(78, 252)));
      return {html: h, bg: '#fff', font: 'figtree'};
    };
  }
  const back07 = {bg: '#fff', ink: '#fff', acc: '#e7e2d4', fd: 'figtree', fb: 'figtree', variant: 'list', photos: ['nook'], band: '#625c4b', name_w: 600, name_size: 28, rule: '#fff', hw: 600};   // back band a shade deeper so the 8.5 px notice reads at 4.5:1
  const std07 = m07(false), long07 = m07(true);
  // the standard panel holds the name at 34 px in 166 px (sx for 6x11); a wider name takes the long layout
  const tooLong07 = () => Math.max(A.textWidth(A.first, "600 34px 'figtree'"), A.textWidth(A.last || '', "600 34px 'figtree'")) > sx(166) - 2;
  A.design('JS-M07', {card: 'sold', front(A){ return tooLong07() ? long07(A) : std07(A); }, back: back07});
  A.design('JS-M07-long', {card: 'sold', front: long07, back: back07});

  // JS-M08 twilight photo, script on a solid night band (never on the photo)
  A.design('JS-M08', {card: 'sold',
    front(A){
      let h = A.box(0, 0, A.W, 138, '#0e1220') + A.ph('family', 0, 138, A.W, 334) + A.box(0, 472, A.W, 104, '#0e1220');
      const fs = fit(A.head, 400, 'great-vibes', 76, sx(440));
      h += A.t(36, 0, sx(520), fl(138, `<div style="font:400 ${fs}px/1 'great-vibes';color:#fff;transform:translateY(6px);white-space:nowrap">${A.head}</div>`, 'flex-start'));
      h += A.t(sx(500), 0, sx(334), fl(138, `<div style="text-align:right;font:600 15px 'montserrat';letter-spacing:2px;color:#fff">${A.U(A.addr)}</div><div style="text-align:right;font:500 13px 'montserrat';letter-spacing:3px;color:#b9c4e0;margin-top:4px">${A.U(A.city)}</div>`, 'flex-end'));
      h += A.t(36, 468, sx(580), fl(84, `<div style="font:600 18px 'montserrat';color:#fff">${A.ctaHead} <span style="font-weight:400;color:#c9d1e6">${A.ctaShort}</span></div><div data-fitw="12" style="font:600 17px 'montserrat';color:#fff;margin-top:8px;white-space:nowrap;overflow:hidden">${A.name}${opt(A.title, ', ')} &nbsp;|&nbsp; ${A.phone}</div>`, 'stretch'));
      h += A.logo('white', sx(640), 498, 52);
      return {html: h, bg: '#0e1220', font: 'montserrat'};
    },
    back: {bg: '#0f1424', ink: '#f4f4f4', acc: '#b9c4e0', fd: 'great-vibes', fd2: 'montserrat', fb: 'montserrat', logo: 'white', variant: 'cta', photos: ['kitchen', 'living'], name_size: 30, hw: 600}
  });

  // JS-M09 script line in the white band under the house; headshot lives on the back
  A.design('JS-M09', {card: 'sold',
    front(A){
      const x2 = 24 + sx(660) + 6;
      let h = A.ph('front', 24, 24, sx(660), 330) + A.ph('kitchen', x2, 24, A.W - 24 - x2, 330);
      const fs = fit(A.head, 400, 'great-vibes', 80, 385);
      h += A.t(40, 374, 400, `<div style="font:400 ${fs}px/1 'great-vibes';color:#2b2724;white-space:nowrap">${A.head}</div>`);
      h += A.t(44, 462, sx(540), `<div style="font:400 16px/1.5 'lato';color:#333">${A.addr} just sold. ${A.ctaHead} ${A.ctaShort}</div>`);
      h += A.t(44, 524, sx(500), `<div style="font:700 13px 'lato';letter-spacing:2.5px;color:#9a7b3c">ANOTHER SUCCESS &nbsp;&middot;&nbsp; ${A.U(A.city)}</div>`);
      h += A.t(sx(440), 372, sx(400), `<div data-fitw="16" style="text-align:right;font:700 22px 'lato';color:#2b2724;white-space:nowrap;overflow:hidden">${A.name}</div>` +
        (A.title ? `<div style="text-align:right;font:500 13px 'lato';letter-spacing:2px;color:#9a7b3c;margin-top:2px">${A.U(A.title)}</div>` : '') +
        `<div style="text-align:right;font:400 20px 'lato';color:#333;margin-top:6px">${A.phone}</div>`);
      h += A.logo('black', sx(646), 482, 58);
      return {html: h, bg: '#fff', font: 'lato'};
    },
    back: {bg: '#fff', ink: '#2b2724', acc: '#9a7b3c', fd: 'great-vibes', fd2: 'playfair-display', fb: 'lato', variant: 'letter', photos: ['lawn'], band: '#f7f4ee', sig: 'great-vibes'}
  });

  // JS-M10 "Your Neighbor's House Just Sold", black agent bar with the headshot (closes up without it)
  A.design('JS-M10', {card: 'sold',
    front(A){
      const nx = A.hasHeadshot ? 170 : 30;
      let h = A.ph('front', sx(300), 0, A.W - sx(300), 420);
      const l1 = A.U(A.headSplit[0]), l2 = A.U(A.headSplit[1]), lw = sx(248);
      const sz = Math.min(fit(l1, 400, 'bebas-neue', 80, lw), fit(l2 || 'X', 400, 'bebas-neue', 80, lw));
      h += A.t(30, 26, lw, `<div style="font:700 17px 'archivo';color:#111">Your Neighbor's House</div><div style="font:400 ${sz}px/0.92 'bebas-neue';color:#111;margin-top:4px">${l1}${l2 ? '<br>' + l2 : ''}</div>` +
        `<div style="font:600 14px 'archivo';color:#111;margin-top:10px">${A.addr}, ${A.cityOnly}</div>` +
        `<div style="font:400 14px/1.45 'archivo';color:#333;margin-top:12px">${A.ctaHead} ${A.ctaShort}</div>` +
        `<div style="font:700 20px 'archivo';color:#111;margin-top:12px">${A.phone}</div>`);
      h += A.box(0, 420, A.W, 156, '#141414');
      h += A.headshotImg(30, 440, 116, 116, 'border-radius:50%');
      h += A.t(nx, 420, sx(420), fl(156, `<div style="font:700 24px 'archivo';color:#fff">${A.name}${opt(A.title, ', ')}</div><div style="font:400 15px/1.5 'archivo';color:#ddd;margin-top:6px">${A.email}${A.web ? '<br>' + A.web : ''}</div>`, 'flex-start'));
      h += A.logo('white', sx(630), 466, 62);
      return {html: h, bg: '#fff', font: 'archivo'};
    },
    back: {bg: '#fff', ink: '#141414', acc: '#141414', fd: 'bebas-neue', fd2: 'archivo', fb: 'archivo', variant: 'cta', photos: ['kitchen', 'living'], name_w: 700, name_size: 26, hw: 700, noHeadshotCard: true}
  });

  // JS-M13 four-photo grid with a central card; the seller CTA replaces beds/baths/offers
  A.design('JS-M13', {card: 'sold',
    front(A){
      const c = sx(435), pw = c - 6;
      let h = A.ph('front', 0, 0, pw, 285) + A.ph('kitchen', c, 0, A.W - c, 285) + A.ph('living', 0, 291, pw, 285) + A.ph('primary', c, 291, A.W - c, 285);
      const cx = A.W / 2 - 160, U = A.U(A.head);
      let fs = fit(U, 800, 'montserrat', 46, 290), head = `<div style="font:800 ${fs}px 'montserrat';color:#141414;margin-top:20px;letter-spacing:1px;white-space:nowrap">${U}</div>`;
      if(fs < 34){
        const l1 = A.U(A.headSplit[0]), l2 = A.U(A.headSplit[1]);
        fs = Math.min(fit(l1, 800, 'montserrat', 46, 290), fit(l2 || 'X', 800, 'montserrat', 46, 290));
        head = `<div style="font:800 ${fs}px/1.1 'montserrat';color:#141414;margin-top:20px;letter-spacing:1px;text-align:center;white-space:nowrap">${l1}<br>${l2}</div>`;
      }
      h += A.box(cx, 40, 320, 496, '#fff', 'box-shadow:0 6px 24px rgba(0,0,0,.25)');
      h += A.t(cx, 40, 320, fl(496, `${A.logoi('black', 50)}${head}<div style="font:600 15px 'montserrat';color:#141414;margin-top:4px">${A.addr}, ${A.cityOnly}</div>` +
        `<div style="width:60px;height:2px;background:#141414;margin:16px 0"></div><div style="font:700 17px 'montserrat';color:#141414">${A.ctaHead}</div><div style="font:400 14px/1.45 'montserrat';color:#444;margin-top:4px;padding:0 26px;text-align:center">${A.cta}</div>` +
        `<div style="width:240px;height:1px;background:#ccc;margin:18px 0 14px"></div><div style="font:700 20px 'montserrat';color:#141414">${A.name}</div>` +
        (A.title ? `<div style="font:500 12.5px 'montserrat';letter-spacing:2px;color:#555">${A.U(A.title)}</div>` : '') +
        `<div style="font:600 18px 'montserrat';color:#141414;margin-top:4px">${A.phone}</div>`));
      return {html: h, bg: '#fff', font: 'montserrat'};
    },
    back: {bg: '#fff', ink: '#141414', acc: '#141414', fd: 'montserrat', fb: 'montserrat', variant: 'list', photos: ['nook'], name_w: 700, name_size: 26, hw: 800}
  });
})();
