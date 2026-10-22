/* Just Listed social (approved: posts JL-S04, S07, S12, S13, S14, S18, S19, S20 at 1080 x 1350; stories JL-S01, S15, S17
   at 1080 x 1920). Ported from docs/briefs/approved-designs-handoff/briefs/just-listed/src/social.py. Stories keep text out
   of the top and bottom 250 px while the design runs full-bleed behind them; posts keep the address and agent name inside the
   middle 3:4 (x 34-1046). Copy comes from data only (annlib.js lists the fields). */
(function(){
  const A = ANN;
  const W = 1080;

  // REALTOR(R) on its own line right under the agent's name (empty for non-NAR agents)
  const RT = (font, color, size, align, mt) => A.title
    ? `<div style="${align ? `text-align:${align};` : ''}font:600 ${size || 20}px/1.2 '${font}';letter-spacing:3px;color:${color};margin-top:${mt == null ? 4 : mt}px">${A.title}</div>` : '';
  // agent block: name, REALTOR(R), cell, email, stacked and aligned
  const AG = (color, font, size, sub, align) => {
    sub = sub || color; size = Math.max(size || 30, 34); align = align || 'left';
    return `<div style="text-align:${align}"><div data-fitw="22" style="font:600 ${size}px/1.2 '${font}';color:${color};white-space:nowrap;overflow:hidden">${A.name}</div>` +
      RT(font, sub) +
      `<div style="font:500 28px/1.4 '${font}';color:${sub};margin-top:2px">${A.phone}<br>${A.email}</div></div>`;
  };

  // the short write-up cut to two lines: whole sentences from the write-up, as many as fit (falls back to the lead line)
  const two = (font, w) => {
    const ss = String(A.blurb || A.aboutShort || '').match(/[^.!?]+[.!?]+\s*/g) || [];
    let out = '';
    for(const x of ss){ const c = (out + x).trim(); if(A.textWidth(c, font) > 1.94 * w) break; out = c + ' '; }
    return (out || A.lead).trim();
  };

  // whole sentences of the full write-up, as many as fit in `max` lines of a narrow column (S18)
  const lines = (text, font, w) => {
    let n = 1, cur = 0;
    for(const wd of text.split(/\s+/)){ const ww = A.textWidth(wd, font), sp = A.textWidth(' ', font); if(cur && cur + sp + ww > w){ n++; cur = ww; } else cur += (cur ? sp : 0) + ww; }
    return n;
  };
  const column = (font, w, max) => {
    const ss = String(A.about || '').match(/[^.!?]+[.!?]+\s*/g) || [];
    let out = '';
    for(const x of ss){ const c = (out + x).trim(); if(lines(c, font, w * 0.97) > max) break; out = c + ' '; }
    return (out || A.lead).trim();
  };

  // JL-S01 story: ivory vertical hero; the house photo runs off the bottom edge
  A.design('JL-S01', {card: 'listed', render(A){
    let h = A.logo('gold', 400, 380, 84);
    h += A.t(0, 490, W, `<div style="text-align:center;font:300 104px 'cormorant-garamond';letter-spacing:10px;color:#2d2822">JUST LISTED</div>` +
      `<div style="text-align:center;font:500 25px 'jost';letter-spacing:6px;color:#5d554c;margin-top:16px">${A.U(A.addr)} </div>` +
      `<div style="text-align:center;font:400 24px 'jost';letter-spacing:3px;color:#8a7f73;margin-top:14px">${A.FACTS_SHORT}</div>`);
    h += A.t(0, 760, W, `<div style="text-align:center"><div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;height:150px;padding:0 44px;background:#e4dccf;white-space:nowrap;color:#3b3631">` +
      `<div style="font:500 27px/1.2 'jost';letter-spacing:2px">${A.name}</div>` +
      (A.title ? `<div style="font:500 17px/1.2 'jost';letter-spacing:4px;color:#6d645a;margin-top:7px">${A.title}</div>` : '') +
      `<div style="font:500 25px/1.2 'jost';letter-spacing:2px;margin-top:9px">${A.phone}</div></div></div>`);
    h += A.ph('front', 0, 950, 1080, 970);
    return {html: h, bg: '#f4efe7', font: 'jost'};
  }});

  // JL-S04 white portrait, highlight behind "Just"
  A.design('JL-S04', {card: 'listed', render(A){
    let h = A.t(0, 52, W, `<div style="text-align:center"><span style="font:400 140px 'cormorant-garamond';color:#2a2622;background:linear-gradient(transparent 38%,#ece2d6 38%,#ece2d6 86%,transparent 86%);padding:0 18px">Just</span>` +
      `<span style="font:400 140px 'cormorant-garamond';color:#2a2622;margin-left:18px">Listed</span></div>` +
      `<div style="text-align:center;font:500 25px 'jost';letter-spacing:5px;color:#3b3631;margin-top:4px">${A.U(A.addr)}, ${A.U(A.cityOnly)}</div>`);
    h += A.ph('front', 80, 280, 920, 760);
    h += A.box(250, 940, 580, 170, '#fff');
    h += A.t(250, 970, 580, `<div style="text-align:center;font:500 22px 'jost';letter-spacing:6px;color:#8a6f5a">${A.U(A.hook)}</div>` +
      `<div style="text-align:center;font:400 52px 'allura';color:#8a6f5a;margin-top:6px">${A.hookTail}</div>`);
    h += A.box(490, 1128, 100, 2, '#c9b6a3');
    h += A.t(80, 1146, 600, AG('#2a2622', 'jost', 34, '#4d453c'));
    h += A.logo('gold', 744, 1190, 76);
    return {html: h, bg: '#fff', font: 'jost'};
  }});

  // JL-S07 olive photo-first; status centered in the gold circle
  A.design('JL-S07', {card: 'listed', render(A){
    const GD = '#d6b45a';
    let h = A.ph('living', 60, 60, 960, 840);
    h += A.box(28, 28, 250, 250, GD, 'border-radius:50%');
    h += A.t(28, 28, 250, `<div style="height:250px;display:flex;align-items:center;justify-content:center;text-align:center;font:500 68px/0.98 'oswald';color:#fff;letter-spacing:2px;padding-left:2px">JUST<br>LISTED</div>`);
    h += A.t(70, 930, 940, `<div style="font:500 32px 'montserrat';color:#fff">${A.ic('pin', 36, '#fff')} &nbsp;${A.addr}, ${A.cityOnly}</div>` +
      `<div style="font:700 36px 'montserrat';color:${GD};margin-top:18px">${A.hook}</div>` +
      `<div style="font:500 30px 'montserrat';color:#fff;margin-top:18px">${A.ic('bed', 38, '#fff')} ${A.beds} &nbsp;&nbsp; ${A.ic('bath', 38, '#fff')} ${A.baths} &nbsp;&nbsp; ${A.ic('area', 36, '#fff')} ${A.sqft} sq ft</div>`);
    h += A.t(70, 1146, 600, AG('#fff', 'montserrat', 30, '#dfe3d4'));
    h += A.logo('white', 744, 1196, 78);
    return {html: h, bg: '#4b5636', font: 'montserrat'};
  }});

  // JL-S12 tan side gallery + fine script, circles for facts
  A.design('JL-S12', {card: 'listed', render(A){
    const TN = '#c8a982', S12_TOP = 482;
    let h = A.box(0, 0, 400, 1350, TN);
    h += A.ph('kitchen', 40, 40, 320, 410) + A.ph('nook', 40, 470, 320, 410) + A.ph('living', 40, 900, 320, 410);
    h += A.box(400, 0, 680, 470, TN);
    h += A.ph('front', 432, 40, 608, 400);
    h += A.t(400, S12_TOP, 680, `<div style="height:200px;display:flex;align-items:center;justify-content:center;white-space:nowrap"><span style="font:400 178px/1 'mrs-saint-delafield';color:#2b2622;position:relative;top:14px">Just</span><span style="font:600 82px/1 'cormorant-garamond';letter-spacing:5px;color:#2b2622;margin-left:40px">LISTED</span></div>`);
    const c = (a, b) => `<div style="width:150px;height:150px;border-radius:50%;border:3px solid #2b2622;text-align:center;padding-top:38px"><div style="font:600 38px 'montserrat'">${a}</div><div style="font:500 20px 'montserrat'">${b}</div></div>`;
    h += A.t(450, 700, 600, `<div style="display:flex;gap:40px">${c(A.beds, 'Beds')}${c(A.baths, 'Baths')}${c(A.sqft, 'Sq Ft')}</div>`);
    h += A.box(470, 892, 540, 74, '#7a6a4f', 'border-radius:37px');
    h += A.t(470, 910, 540, `<div style="text-align:center;font:600 30px 'montserrat';color:#fff">${A.hook}</div>`);
    h += A.t(455, 1000, 590, `<div data-fitw="22" style="text-align:center;font:600 34px 'montserrat';white-space:nowrap;overflow:hidden">${A.name}</div>${RT('montserrat', '#555', 20, 'center')}<div style="text-align:center;font:500 30px/1.5 'montserrat';color:#333;margin-top:4px">${A.phone}</div><div style="text-align:center;font:400 26px/1.4 'montserrat';color:#333">${A.email}</div>`);
    h += A.logo('black', 640, 1196, 72);
    return {html: h, bg: '#f1ede6', font: 'montserrat'};
  }});

  // JL-S13 white editorial frame; two-line write-up about the house
  A.design('JL-S13', {card: 'listed', render(A){
    let h = A.t(70, 40, 700, `<div style="font:600 70px 'montserrat';letter-spacing:8px;color:#222">JUST LISTED</div>`);
    h += A.box(800, 84, 210, 3, '#b89b5e');
    h += A.ph('front', 70, 150, 940, 730);
    h += A.t(70, 908, 940, `<div style="font:500 34px 'montserrat';letter-spacing:2px;color:#222">${A.U(A.addr)}</div>` +
      `<div style="font:400 26px/1.45 'montserrat';color:#444;margin-top:12px" id="wu">${two("400 26px 'montserrat'", 940)}</div>`);
    h += A.t(70, 1066, 940, `<div style="display:flex;justify-content:space-between;font:500 24px/1 'montserrat';color:#666;letter-spacing:.5px"><span>${A.beds} Beds</span><span>|</span><span>${A.baths} Baths</span><span>|</span><span>${A.sqft} Sq Ft</span><span>|</span><span>Built ${A.built}</span></div>`);
    h += A.box(70, 1126, 940, 1, '#ccc');
    h += A.t(70, 1146, 600, AG('#222', 'montserrat', 30, '#666'));
    h += A.logo('black', 744, 1190, 76);
    return {html: h, bg: '#fff', font: 'montserrat'};
  }});

  // JL-S14 espresso split gallery
  A.design('JL-S14', {card: 'listed', render(A){
    const ES = '#2c211b';
    let h = A.box(0, 0, 640, 1350, ES);
    h += A.t(0, 56, 640, `<div style="text-align:center;font:800 172px/0.92 'montserrat';color:#fff;letter-spacing:6px;padding-left:6px">JUST</div><div style="text-align:center;font:800 118px/1 'montserrat';color:#fff;letter-spacing:2px;margin-top:6px">LISTED</div>`);
    h += A.box(110, 410, 420, 84, '#fff', 'border-radius:42px');
    h += A.t(110, 430, 420, `<div data-nofit="1" style="text-align:center;font:700 34px 'montserrat';color:${ES}">BUILT IN ${A.built}</div>`);
    const st = (k, l) => `<div style="text-align:center;margin-bottom:24px">${A.ic(k, 48, '#fff')}<div style="font:500 26px 'montserrat';letter-spacing:2px;color:#e9dfd6;margin-top:6px">${l}</div></div>`;
    h += A.t(0, 530, 640, st('bed', `${A.beds} BEDROOMS`) + st('bath', `${A.baths} BATHROOMS`) + st('area', `${A.sqft} SQ FT`));
    h += A.t(0, 880, 640, `<div style="text-align:center;font:700 32px 'montserrat';color:#fff;letter-spacing:1px">${A.U(A.addr)}<br>${A.U(A.cityZip)}</div>`);
    h += A.t(40, 1010, 560, AG('#fff', 'montserrat', 30, '#d9cec4', 'center'));
    h += A.logo('white', 200, 1220, 72);
    h += A.ph('front', 650, 0, 430, 360) + A.ph('kitchen', 650, 366, 430, 490) + A.ph('living', 650, 862, 430, 488);
    return {html: h, bg: ES, font: 'montserrat'};
  }});

  // JL-S15 story: gold arch; photos run off the top and bottom edges and fade into the gold
  A.design('JL-S15', {card: 'listed', render(A){
    const GA = '#7d6a43';
    let h = A.ph('living', 0, 0, 1080, 420);
    h += A.box(0, 0, 1080, 422, 'linear-gradient(180deg,rgba(125,106,67,0) 0%,rgba(125,106,67,0) 45%,' + GA + ' 100%)');
    h += A.ph('kitchen', 0, 1720, 1080, 200);
    h += A.box(0, 1718, 1080, 202, 'linear-gradient(0deg,rgba(125,106,67,0) 0%,rgba(125,106,67,0) 40%,' + GA + ' 100%)');
    h += A.t(0, 432, W, `<div style="text-align:center;font:400 100px 'cormorant-garamond';color:#fff;letter-spacing:6px">JUST LISTED</div><div style="text-align:center;font:500 30px 'jost';letter-spacing:4px;color:#fff;margin-top:2px">${A.U(A.addr)}</div>`);
    h += A.ph('front', 140, 640, 800, 660, 'border-radius:400px 400px 0 0 / 190px 190px 0 0');
    h += A.box(80, 1324, 920, 2, '#e9dcbf');
    const it = (k, l) => `<div style="text-align:center;flex:1">${A.ic(k, 46, '#fff')}<div style="font:500 24px 'jost';color:#fff;margin-top:6px">${l}</div></div>`;
    h += A.t(80, 1340, 920, `<div style="display:flex">${it('bed', `${A.beds} Beds`)}${it('bath', `${A.baths} Baths`)}${it('area', `${A.sqft} Sq Ft`)}${it('pin', A.cityOnly)}</div>`);
    h += A.t(80, 1462, 920, `<div style="font:400 28px/1.45 'jost';color:#f6eedc;text-align:center">${two("400 28px 'jost'", 920)}</div>`);
    h += A.t(80, 1564, 600, AG('#fff', 'jost', 34, '#f6eedc'));
    h += A.logo('white', 716, 1590, 78);
    return {html: h, bg: GA, font: 'jost'};
  }});

  // JL-S17 story: charcoal card with ochre badge; a room photo fills the whole story behind it
  A.design('JL-S17', {card: 'listed', render(A){
    const OC = '#b8823c';
    let h = A.ph('living', 0, 0, 1080, 1920, '', '62% center');
    h += A.box(0, 0, 1080, 1920, 'rgba(20,18,16,.28)');
    h += A.box(90, 300, 900, 1320, '#2b2b2b', 'border-radius:44px;box-shadow:0 18px 60px rgba(0,0,0,.35)');
    h += A.ph('front', 120, 330, 840, 740, 'border-radius:30px');
    h += A.box(230, 1020, 620, 120, OC, 'border-radius:14px');
    h += A.t(230, 1038, 620, `<div style="text-align:center;font:400 72px 'cormorant-garamond';color:#fff;letter-spacing:3px">JUST LISTED</div>`);
    h += A.t(90, 1160, 900, `<div style="text-align:center;font:600 34px 'montserrat';color:#fff">${A.beds} Bedrooms &nbsp;|&nbsp; ${A.baths} Baths &nbsp;|&nbsp; ${A.sqft} Sq Ft</div>` +
      `<div style="text-align:center;font:400 30px/1.35 'montserrat';color:#ddd;margin-top:14px">${A.addr}<br>${A.city}</div>`);
    h += A.box(220, 1334, 640, 180, 'transparent', `border:2px solid ${OC};border-radius:18px`);
    h += A.t(220, 1334, 640, `<div style="height:180px;display:flex;align-items:center;justify-content:center">${AG('#fff', 'montserrat', 36, '#eee', 'center')}</div>`);
    h += A.logo('white', 422, 1532, 66);
    return {html: h, bg: '#2b2b2b', font: 'montserrat'};
  }});

  // JL-S18 white side column with full-height interior
  A.design('JL-S18', {card: 'listed', render(A){
    let h = A.ph('living', 30, 30, 700, 1150);
    h += A.t(740, 60, 320, `<div style="text-align:center;font:600 92px/1 'montserrat';color:#222;letter-spacing:4px;padding-left:4px">JUST</div><div style="text-align:center;font:600 70px/1.05 'montserrat';color:#222">LISTED</div>` +
      `<div style="text-align:center;font:500 25px/1.45 'montserrat';color:#333;margin-top:24px">${A.addr}<br>${A.city}</div>` +
      `<div style="height:2px;width:80px;background:#222;margin:26px auto"></div>` +
      `<div style="text-align:center;font:400 23px/1.6 'montserrat';color:#444;padding:0 4px">${column("400 23px 'montserrat'", 312, 12)}</div>`);
    const nm = A.textWidth(A.name.replace(/&amp;/g, '&'), "600 34px 'montserrat'") > 290 && A.name.includes(' ') ? A.name.replace(' ', '<br>') : A.name;   // a very long name takes two lines in this narrow column
    h += A.t(744, 920, 296, `<div style="text-align:center">${nm.split('<br>').map(n => `<div data-fitw="20" style="font:600 34px 'montserrat';color:#222;white-space:nowrap;overflow:hidden">${n}</div>`).join('')}${RT('montserrat', '#555', 19)}<div style="font:500 27px/1.4 'montserrat';color:#555;margin-top:4px">${A.phone}</div></div>`);
    h += A.logo('black', 790, 1078, 66);
    h += A.box(30, 1200, 1020, 120, '#ecebea');
    h += A.t(30, 1236, 1020, `<div style="display:flex;justify-content:space-around;font:500 28px 'montserrat';color:#444"><span>${A.ic('bed', 38, '#444')} ${A.beds} bedrooms</span><span>${A.ic('bath', 38, '#444')} ${A.baths} bathrooms</span><span>${A.ic('area', 36, '#444')} ${A.sqft} sq ft</span></div>`);
    return {html: h, bg: '#fff', font: 'montserrat'};
  }});

  // JL-S19 beige center stripe with angled side graphics
  A.design('JL-S19', {card: 'listed', render(A){
    const BG = '#e8dccb';
    const slashes = (x, y, n, color) => Array.from({length: n}, (_, i) => `<div class="a" style="left:${x + i * 26}px;top:${y}px;width:12px;height:180px;background:${color};transform:skewX(-24deg)"></div>`).join('');
    let h = slashes(860, 40, 7, '#c9b394') + slashes(30, 1130, 7, '#c9b394');
    h += A.box(190, 60, 700, 1230, BG);
    h += A.t(190, 100, 700, `<div style="text-align:center;font:400 92px 'josefin-sans';letter-spacing:4px;color:#4a3f33">JUST LISTED</div>`);
    h += A.ph('living', 90, 240, 900, 620);
    h += A.t(190, 892, 700, `<div style="text-align:center;font:500 30px 'josefin-sans';letter-spacing:3px;color:#4a3f33">${A.U(A.addr)}, ${A.U(A.cityOnly)}</div>` +
      `<div style="text-align:center;font:400 27px 'josefin-sans';letter-spacing:2px;color:#6d5f4f;margin-top:12px">${A.beds} BED &nbsp;|&nbsp; ${A.baths} BATH &nbsp;|&nbsp; ${A.sqft} SQ FT</div>` +
      `<div style="text-align:center;margin-top:28px"><div data-fitw="22" style="font:600 38px 'josefin-sans';letter-spacing:1px;color:#3a3127;white-space:nowrap;overflow:hidden">${A.name}</div>` +
      RT('josefin-sans', '#6d5f4f', 20) +
      `<div style="font:500 30px/1.4 'josefin-sans';color:#4a3f33;margin-top:4px">${A.phone}<br><span style="font-size:26px">${A.email}</span></div></div>`);
    h += A.logo('black', 432, 1206, 60);
    return {html: h, bg: '#fff', font: 'josefin-sans'};
  }});

  // JL-S20 asymmetric three-photo grid
  A.design('JL-S20', {card: 'listed', render(A){
    let h = A.ph('front', 0, 0, 540, 450) + A.ph('kitchen', 540, 450, 540, 450) + A.ph('living', 0, 900, 540, 450);
    h += A.t(540, 60, 540, `<div style="text-align:center;font:700 116px/0.95 'montserrat';color:#222;letter-spacing:4px;padding-left:4px">JUST</div><div style="text-align:center;font:700 84px 'montserrat';color:#222">LISTED</div>` +
      `<div style="text-align:center;font:500 28px 'montserrat';color:#888;margin-top:8px;letter-spacing:2px">BUILT IN ${A.built}</div>`);
    const fl = (k, l) => `<div style="text-align:center;margin-bottom:22px">${A.ic(k, 44, '#999')}<div style="font:500 23px 'montserrat';letter-spacing:2px;color:#777">${l}</div></div>`;
    h += A.t(0, 500, 540, fl('bed', `${A.beds} BEDROOMS`) + fl('bath', `${A.baths} BATHROOMS`) + fl('area', `${A.sqft} SQ FT`));
    h += A.t(540, 940, 540, `<div style="text-align:center;font:500 30px/1.45 'montserrat';color:#555;letter-spacing:1px">${A.U(A.addr)}<br>${A.U(A.cityZip)}</div>`);
    h += A.t(556, 1050, 486, AG('#222', 'montserrat', 28, '#666', 'center'));
    h += A.logo('black', 700, 1250, 62);
    return {html: h, bg: '#fff', font: 'montserrat'};
  }});
})();
