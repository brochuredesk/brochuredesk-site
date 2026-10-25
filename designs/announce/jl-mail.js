/* Just Listed postcards (approved: JL-M01-M08, JL-M11). Ported from
   docs/briefs/approved-designs-handoff/briefs/just-listed/src/mail1.py. Coordinates are the 6x9 design's
   (864 x 576 px at 96 px/in); A.sx(v) stretches a horizontal position or width for the 6x11 (1056 px) so photos
   and columns widen and type keeps its size. Copy comes from data only (annlib.js lists the fields). */
(function(){
  const A = ANN;
  const sx = v => Math.round(v * A.W / 864 * 10) / 10;

  // JL-M01 airy script + interior triptych; bottom row = agent contact + brokerage logo (owner note)
  // "Listed" sits centered top to bottom in the space between the photos and the contact band (owner note 10/21)
  A.design('JL-M01', {card: 'listed', lscale: 1.18,
    front(A){
      const pw = (A.W - 6) / 3;
      let h = A.ph('kitchen', 0, 0, pw, 246) + A.ph('dining', pw + 3, 0, pw, 246) + A.ph('living', 2 * pw + 6, 0, pw, 246);
      h += A.t(sx(46), 294, 300, "<div style=\"font:300 82px 'cormorant-garamond';color:#2a2622\">Just</div>");
      h += A.t(sx(176), 302, 330, "<div style=\"font:400 120px/1 'mrs-saint-delafield';color:#2a2622;transform:rotate(-6deg)\">Listed</div>");
      h += A.t(sx(512), 292, 330, `<div style="font:500 24px/1.25 'jost';letter-spacing:1.5px;color:#2a2622;white-space:nowrap">${A.U(A.addr)}</div><div style="font:500 17px 'jost';letter-spacing:4px;color:#3b3631;margin-top:6px">${A.U(A.city)}</div>` +
        `<div style="font:500 13px 'jost';letter-spacing:1.2px;white-space:nowrap;color:#6d6257;margin-top:14px">${A.FACTS_SHORT}</div>`);
      h += A.box(0, 440, A.W, 136, '#efe9e1');
      h += A.t(sx(40), 440, 270, `<div style="height:136px;display:flex;flex-direction:column;justify-content:center"><div data-fitw="24" style="font:400 40px/1 'cormorant-garamond';color:#2a2622;white-space:nowrap;overflow:hidden">${A.name}</div>` +
        (A.title ? `<div style="font:500 12.5px 'jost';letter-spacing:2.5px;color:#7a6f63;margin-top:8px">${A.title}</div>` : '') + `</div>`);
      h += A.t(sx(310), 440, 270, `<div style="height:136px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"><div style="font:500 24px 'jost';color:#2a2622;letter-spacing:1px">${A.phone}</div><div style="font:400 14.5px/1.55 'jost';color:#4d453c;margin-top:4px">${A.email}<br>${A.web}</div></div>`);
      h += A.logo('gold', sx(622), 482, 54);
      return {html: h, bg: '#fbf9f6', font: 'jost'};
    },
    back: {bg: '#fbf9f6', ink: '#2a2622', acc: '#8a7f73', fd: 'cormorant-garamond', fb: 'jost', logo: 'gold', variant: 'photos', photos: ['primary', 'lawn'], band: '#efe9e1'}
  });

  const ent = x => String(x).replace(/&amp;(\w+;)/g, '&$1');
  const nameT = () => A.name + (A.title ? ', ' + A.title : '');

  // JL-M02 ivory panoramic; status centered on its own line (no seal). No logo on the front (owner note 10/21).
  A.design('JL-M02', {card: 'listed', lscale: 1.18, noFrontLogo: true,
    front(A){
      let h = A.t(0, 26, A.W, "<div style=\"height:104px;display:flex;align-items:center;justify-content:center\"><span style=\"font:400 82px/1 'marcellus';letter-spacing:14px;margin-right:-14px;color:#3a3127\">JUST LISTED</span></div>");
      h += A.ph('front', sx(70), 136, A.W - 2 * sx(70), 334);
      h += A.t(0, 481, A.W, `<div style="text-align:center;font:400 32px 'marcellus';letter-spacing:5px;color:#3a3127">${A.U(A.addr)}</div>` +
        `<div style="text-align:center;font:400 italic 17px 'cormorant-garamond';color:#6e6152;margin-top:6px">${A.city} &nbsp;&nbsp;|&nbsp;&nbsp; ${A.beds} bedrooms &nbsp;&nbsp;|&nbsp;&nbsp; ${A.baths} full baths &nbsp;&nbsp;|&nbsp;&nbsp; ${A.sqft} square feet</div>`);
      return {html: h, bg: '#f5f0e7', font: 'marcellus'};
    },
    back: {bg: '#f5f0e7', ink: '#3a3127', acc: '#7a6a55', fd: 'marcellus', fb: 'lato', logo: 'gold', variant: 'story', name_size: 26}
  });

  // JL-M03 modern white card, black corner block
  A.design('JL-M03', {card: 'listed', lscale: 1.18,
    front(A){
      let h = A.box(0, 372, 306, 204, '#141414');
      h += A.t(sx(60), 27, A.W - 2 * sx(60), "<div style=\"font:800 44px 'archivo';letter-spacing:9px\">JUST LISTED</div>");
      h += A.ph('front', sx(60), 84, A.W - 2 * sx(60), 384);
      h += A.t(36, 488, 262, `<div style="font:700 24px 'archivo';color:#fff;white-space:nowrap">${A.addr}</div><div style="font:400 13px 'archivo';color:#d8d8d8;margin-top:6px;letter-spacing:.5px">${A.beds} Beds &middot; ${A.baths} Baths &middot; ${A.sqft} Sq Ft</div>`);
      // a name too long for one line stacks first / last (each still shrinks to its floor) so it never overflows
      const long = A.textWidth(A.name, "700 24px 'archivo'") > 240, nm = "font:700 %spx 'archivo';color:#141414;white-space:nowrap;overflow:hidden;max-width:240px";
      const nameHtml = long
        ? `<div data-fitw="16" style="${nm.replace('%s', 22)};margin-top:4px">${A.first}</div><div data-fitw="16" style="${nm.replace('%s', 22)}">${A.last}</div>`
        : `<div data-fitw="16" style="${nm.replace('%s', 24)};margin-top:4px">${A.name}</div>`;
      h += A.t(sx(312), long ? 452 : 456, 240, `<div style="height:${long ? 100 : 108}px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"><div style="font:500 12px 'archivo';letter-spacing:2.5px;color:#555">PRESENTED BY</div>${nameHtml}<div style="font:600 22px 'archivo';color:#141414;margin-top:2px">${A.phone}</div></div>`);
      h += A.logo('black', sx(640), 498, 48);
      return {html: h, bg: '#fff', font: 'archivo'};
    },
    back: {bg: '#fff', ink: '#141414', acc: '#141414', fd: 'archivo', fb: 'archivo', logo: 'black', variant: 'list', photos: ['kitchen'], name_w: 600, name_size: 26}
  });

  // JL-M04 charcoal status band
  A.design('JL-M04', {card: 'listed', lscale: 1.18,
    front(A){
      let h = A.box(0, 0, A.W, 118, '#2b2b2b');
      h += A.t(0, 24, A.W, `<div style="text-align:center;font:400 46px 'tenor-sans';letter-spacing:12px;color:#fff">JUST LISTED</div><div style="text-align:center;font:400 12px 'tenor-sans';letter-spacing:5px;color:#c9c6c0;margin-top:8px">${A.U(A.addr)}</div>`);
      h += A.ph('front', sx(24), 136, sx(540), 304) + A.ph('kitchen', sx(576), 136, sx(264), 148) + A.ph('living', sx(576), 292, sx(264), 148);
      h += A.box(0, 456, A.W, 120, '#eceae6');
      h += A.t(sx(24), 470, sx(600), `<div style="font:400 26px 'marcellus';letter-spacing:2px;color:#2b2b2b">${A.beds} BEDS &nbsp;|&nbsp; ${A.baths} BATHS &nbsp;|&nbsp; ${A.sqft} SQ FT</div>` +
        `<div data-fitw="13" style="font:400 19px 'tenor-sans';letter-spacing:3px;color:#6a6a6a;margin-top:10px;white-space:nowrap;overflow:hidden">${A.U(A.name)} &nbsp;&middot;&nbsp; ${A.phone}</div>`);
      h += A.logo('black', sx(640), 488, 56);
      return {html: h, bg: '#fff', font: 'tenor-sans'};
    },
    back: {bg: '#fff', ink: '#2b2b2b', acc: '#2b2b2b', fd: 'marcellus', fb: 'tenor-sans', logo: 'black', variant: 'photos', photos: ['primary', 'lawn'], band: '#eceae6'}
  });

  // JL-M05 offset twilight photo; status centered above the photo; feature list fills its column
  A.design('JL-M05', {card: 'listed', lscale: 1.18,
    front(A){
      let h = A.t(sx(60), 7, A.W - 2 * sx(60), "<div style=\"height:118px;display:flex;align-items:center;justify-content:center;font:400 54px 'jost';letter-spacing:15px;padding-left:15px;color:#1b1b1b\">JUST LISTED</div>");
      h += A.ph('family', sx(60), 118, sx(520), 330);
      h += A.t(sx(608), 118, sx(236), '<div style="height:300px;display:flex;flex-direction:column;justify-content:space-between;padding:4px 0">' +
        A.featuresShort.map(ent).map(f => `<div style="font:400 16px 'jost';color:#333;letter-spacing:.4px;white-space:nowrap">${f}</div>`).join('') + '</div>');
      h += A.logo('black', sx(40), 478, 46);
      h += A.box(sx(220), 448, sx(584), 84, '#151515');
      h += A.t(sx(250), 448, sx(540), `<div style="height:84px;display:flex;flex-direction:column;justify-content:center"><div style="font:500 italic 32px/1.05 'cormorant-garamond';color:#d5b77a">${A.addr}</div><div style="font:400 13px 'jost';letter-spacing:3px;color:#cdbf9f;margin-top:5px">${A.U(A.cityZip)}</div></div>`);
      return {html: h, bg: '#fff', font: 'jost'};
    },
    back: {bg: '#fff', ink: '#1b1b1b', acc: '#a8894f', fd: 'cormorant-garamond', fb: 'jost', logo: 'black', variant: 'photos', photos: ['kitchen', 'lawn'], name_size: 32}
  });

  // JL-M06 black + gold, text on solid black so it always pops (owner note)
  A.design('JL-M06', {card: 'listed', lscale: 1.18,
    front(A){
      let h = A.ph('front', 0, 0, A.W, 404);
      h += A.box(0, 404, A.W, 172, '#0e0e0e') + A.box(0, 404, A.W, 3, '#c9a55c');
      h += A.t(sx(34), 407, 450, "<div style=\"height:169px;display:flex;align-items:center\"><span style=\"font:300 84px/1 'cormorant-garamond';color:#e2c27f\">Just</span><span style=\"font:400 112px/1 'pinyon-script';color:#e2c27f;margin-left:12px;position:relative;top:12px\">Listed</span></div>");
      h += A.t(sx(500), 428, 330, `<div style="font:500 20px 'montserrat';letter-spacing:3px;color:#fff">${A.U(A.addr)}</div><div style="font:400 12px 'montserrat';letter-spacing:2.5px;color:#d9bf86;margin-top:6px">${A.U(A.city)}</div>` +
        `<div style="font:500 13px 'montserrat';letter-spacing:2px;color:#e2c27f;margin-top:12px">${A.beds} BEDS &nbsp;|&nbsp; ${A.baths} BATHS &nbsp;|&nbsp; ${A.sqft} SQ FT</div>`);
      h += A.logo('gold-on-dark', sx(500), 516, 42);
      return {html: h, bg: '#0e0e0e', font: 'montserrat'};
    },
    back: {bg: '#0e0e0e', ink: '#f2f2f2', acc: '#d9b874', fd: 'cormorant-garamond', fb: 'montserrat', logo: 'gold-on-dark', variant: 'photos', photos: ['living', 'lawn'], name_size: 34}
  });

  // JL-M07 vertical address stripe (number + street name), agent block bottom-aligned, logo above it
  A.design('JL-M07', {card: 'listed', lscale: 1.18,
    front(A){
      let h = A.box(0, 0, 118, 576, '#1f2a44');
      h += A.t(-229, 259, 576, `<div style="transform:rotate(-90deg);text-align:center;white-space:nowrap;font:700 38px 'libre-baskerville';letter-spacing:5px;color:#fff">${A.U(A.addrShort)}</div>`);
      h += A.ph('front', 118, 0, A.W - 118, 432);
      h += A.box(118, 432, A.W - 118, 3, '#c7b27f');
      h += A.t(146, 438, 440, `<div style="height:112px;display:flex;flex-direction:column;justify-content:flex-end"><div style="font:700 46px/1 'libre-baskerville';color:#1f2a44;letter-spacing:1px">Just Listed</div><div style="font:500 17px 'montserrat';color:#1f2a44;margin-top:14px">${A.addr}, ${A.cityOnly}</div>` +
        `<div style="font:400 12.5px/1 'montserrat';color:#555;margin-top:8px;letter-spacing:1px">${A.beds} Beds &middot; ${A.baths} Baths &middot; ${A.sqft} Sq Ft &middot; Built ${A.built}</div></div>`);
      h += A.t(A.W - 24 - 300, 438, 300, `<div style="height:112px;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-end;text-align:right">${A.logoi('black', 60)}` +
        `<div style="font:600 18px 'montserrat';color:#1f2a44;margin-top:8px">${nameT()}</div><div style="font:500 16px/1 'montserrat';color:#333;margin-top:6px">${A.phone}</div></div>`);
      return {html: h, bg: '#fff', font: 'montserrat'};
    },
    back: {bg: '#fff', ink: '#1f2a44', acc: '#a08a52', fd: 'libre-baskerville', fb: 'montserrat', logo: 'black', variant: 'list', photos: ['kitchen'], name_size: 26}
  });

  // JL-M08 blue sidebar; status centered in its band; sidebar of 8 facts; address alone; no logo on the front
  const B8 = '#1e4b8f';
  A.design('JL-M08', {card: 'listed', lscale: 1.18, noFrontLogo: true,
    front(A){
      let h = A.box(0, 0, A.W, 100, B8);
      h += A.t(0, 5, A.W, "<div style=\"height:100px;display:flex;align-items:center;justify-content:center;font:700 48px 'montserrat';letter-spacing:14px;color:#fff;padding-left:14px\">JUST LISTED</div>");
      h += A.box(0, 100, A.W, 4, '#fff');
      h += A.ph('front', 0, 104, sx(596), 356);
      h += A.box(sx(600), 104, A.W - sx(600), 356, B8);
      h += A.t(sx(612), 104, A.W - sx(612) - 14, '<div style="height:356px;display:flex;flex-direction:column;justify-content:space-evenly">' +
        A.featuresShort.map(ent).map(s => `<div style="font:500 13px 'montserrat';letter-spacing:.7px;color:#fff;white-space:nowrap">${A.U(s)}</div>`).join('') + '</div>');
      h += A.t(0, 460, A.W, `<div style="height:116px;display:flex;align-items:center;justify-content:center;font:600 46px 'montserrat';letter-spacing:8px;color:#151515;padding-left:8px;white-space:nowrap">${A.U(A.addr)}</div>`);
      return {html: h, bg: '#fff', font: 'montserrat'};
    },
    back: {bg: '#fff', ink: '#151515', acc: B8, fd: 'montserrat', fb: 'montserrat', logo: 'black', variant: 'photos', photos: ['kitchen', 'primary'], name_w: 600, name_size: 26, band: '#eef2f8'}
  });

  // JL-M11 twilight panorama
  A.design('JL-M11', {card: 'listed', lscale: 1.18,
    front(A){
      let h = A.ph('family', 0, 0, A.W, 576);
      h += A.box(0, 0, A.W, 576, 'radial-gradient(ellipse 640px 260px at 0 0,rgba(8,10,22,.88),rgba(8,10,22,.5) 55%,rgba(8,10,22,0))');
      h += A.box(0, 0, A.W, 576, 'linear-gradient(180deg,rgba(10,14,30,.55) 0%,rgba(10,14,30,0) 32%,rgba(10,14,30,0) 62%,rgba(8,10,20,.82) 100%)');
      h += A.t(36, 18, 500, "<div style=\"font:400 66px 'great-vibes';color:#fff\">Just Listed</div>");
      h += A.t(40, 104, 500, `<div style="font:600 16px 'montserrat';letter-spacing:2px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.8)">${A.addr} &middot; ${A.cityOnly}</div>`);
      h += A.t(40, 498, A.W - 174 - 60, `<div style="font:500 13px 'montserrat';color:#fff;letter-spacing:1px">${A.beds} Beds &nbsp;|&nbsp; ${A.baths} Baths &nbsp;|&nbsp; ${A.sqft} Sq Ft &nbsp;|&nbsp; Built ${A.built}</div>` +
        `<div data-fitw="10.7" style="font:600 italic 13px 'montserrat';color:#fff;margin-top:8px;white-space:nowrap;overflow:hidden">${nameT()} &nbsp;|&nbsp; ${A.phone} &nbsp;|&nbsp; ${A.email}</div>`);
      h += A.logo('white', A.W - 174, 494, 46);
      return {html: h, bg: '#000', font: 'montserrat'};
    },
    back: {bg: '#0f1424', ink: '#f4f4f4', acc: '#b9c4e0', fd: 'great-vibes', fb: 'montserrat', logo: 'white', variant: 'photos', photos: ['kitchen', 'living'], name_size: 44}
  });
})();
