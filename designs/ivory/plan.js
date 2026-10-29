/* Floor plan drawing for Ivory (template readiness standard, sections 1 and 8).

   Input: data.plan, measured in feet, origin at the top-left of each level, the street at the bottom.
     { source: 'Redrawn from the listing floor plan',
       levels: [ { name:'First floor', living:true, inset:false,
                   rooms:[ {name:'Living', short:'Living', x:0, y:0, w:18, d:16, dims:'18 x 16',
                            kind:'room'|'wet'|'closet'|'outdoor'|'garage'|'open', minor:false,
                            crop:{side:'right', to:30}} ],
                   stairs:{x, y, w, d} } ],
       insets: [ { name:'Garage apartment', rooms:[...] } ] }
     A room may carry zone:'living'|'sleep'|'bath'|'service' (otherwise read from its name and kind).
     A level may carry doors:[{x, y, w, dir}] and windows:[{x, y, w, dir}] read from the listing plan (dir is the side of
     the wall the door swings into: 'up'|'down' on a horizontal wall, 'left'|'right' on a vertical one; x,y is the hinge).
     With no doors given, doors are placed where they normally go: bedrooms, baths and closets open onto the hall or
     the room they serve, and the front door sits on the street side. Windows likewise go on outside walls.

   Rules it enforces:
   - every full level drawn at the same scale, labeled by floor; 1-3 levels side by side, 4 levels in a 2 x 2 grid,
     ground floor first; interior stairs aligned (no interior stairs: footprints aligned at the top)
   - room labels 8 pt; a label that won't fit at 8 pt is reported, never shrunk
     (closets, baths and utility rooms marked minor may go unlabeled, the way printed plans do)
   - oversized outdoor areas are cut with a clean break and keep their real dimensions
   - when labels won't fit, levels marked living:false become small insets "drawn smaller" so the living level
     gets the larger spot (raised coastal homes); garage apartments are always insets
   - plans turn on their side when that draws them noticeably larger (tall, narrow townhomes in a 2 x 2 grid)
   - styled, not bare (10/21/2026): rooms tinted by zone (living, bedrooms, baths), door swings, windows,
     and a legend drawn by the template (IvoryPlan.ZONES); doors show as wall openings, no swings (second review round)
*/
(function(){
  const PT = 72/96;
  const LABEL = 8, LINE = 9.5;          // room label size and line step, pt
  const LEVEL_LABEL_H = 15;             // level name under each drawing
  const GAP = 20;                       // space between levels, pt
  const S_MAX = 9;                      // never draw bigger than 9 pt per foot (1/8 inch = 1 ft)

  // Text width for layout: measured in the design's own font once it has loaded (with 4% to spare), otherwise a
  // conservative estimate (10/27/2026: the estimate kept "Pantry" out of a room it fits by 2 pt). The print check
  // measures the real text afterwards either way.
  const charW = { '600':0.585, '400':0.54 };
  let ctx = null;
  const est = (s, wt) => {
    const t = String(s||''), guess = t.length * LABEL * (charW[wt]||0.58);
    try {
      const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim(), font = `${wt} ${LABEL}pt ${fam}`;
      if(!fam || !document.fonts || !document.fonts.check(font)) return guess;
      ctx = ctx || document.createElement('canvas').getContext('2d'); ctx.font = font;
      return Math.min(guess, ctx.measureText(t).width * 0.75 * 1.04);   // canvas px -> pt
    } catch(e){ return guess; }
  };

  const dimsOf = r => r.dims || `${Math.round(r.w)} x ${Math.round(r.d)}`;
  const isIndoor = r => r.kind !== 'outdoor';

  // zone tints: living areas take the brand accent, bedrooms a warm sand, baths a soft slate
  const ZONES = {
    living: {label:'Living areas', fill:'var(--accent)', op:.13},
    sleep:  {label:'Bedrooms',     fill:'#c4a46a',        op:.24},
    bath:   {label:'Baths',        fill:'#6f8ea6',        op:.32},   // a little darker so baths stand out (owner 10/28)
  };
  function zoneOf(r){
    if(r.zone) return r.zone;
    if(r.kind==='outdoor' || r.kind==='garage' || r.kind==='open') return r.kind;
    if(r.kind==='wet') return 'bath';
    if(r.kind==='closet') return 'service';
    const n = String(r.name||'').toLowerCase();
    if(/bed|primary|suite|guest|nursery/.test(n)) return 'sleep';
    if(/bath|powder/.test(n)) return 'bath';
    if(/closet|pantry|laundry|utility|storage|mech|linen/.test(n)) return 'service';
    if(/hall|entry|foyer|landing|gallery|stair/.test(n)) return 'open';
    return 'living';
  }

  // effective extent of a room after an outdoor crop
  function drawn(r){
    const c = r.crop; if(!c) return {x:r.x, y:r.y, w:r.w, d:r.d};
    const o = {x:r.x, y:r.y, w:r.w, d:r.d};
    if(c.side==='right') o.w = Math.min(r.w, c.to);
    if(c.side==='left'){ o.x = r.x + r.w - Math.min(r.w, c.to); o.w = Math.min(r.w, c.to); }
    if(c.side==='bottom') o.d = Math.min(r.d, c.to);
    if(c.side==='top'){ o.y = r.y + r.d - Math.min(r.d, c.to); o.d = Math.min(r.d, c.to); }
    return o;
  }

  function rotateLevel(L){
    // quarter turn clockwise: the street side (bottom) ends up on the left
    const bb = bbox(L), H = bb.y + bb.d;
    const rot = r => r && Object.assign({}, r, {x: H - (r.y + r.d), y: r.x, w: r.d, d: r.w,
      crop: r.crop ? {side:{right:'bottom', left:'top', top:'right', bottom:'left'}[r.crop.side], to:r.crop.to} : undefined});
    const rotO = o => (o.dir==='up' || o.dir==='down')
      ? Object.assign({}, o, {x: H - o.y, y: o.x, dir: o.dir==='up' ? 'right' : 'left'})
      : Object.assign({}, o, {x: H - o.y - o.w, y: o.x, dir: o.dir==='left' ? 'up' : 'down'});
    return Object.assign({}, L, {rooms: L.rooms.map(rot), stairs: rot(L.stairs), rotated: true,
      doors: L.doors && L.doors.map(rotO), windows: L.windows && L.windows.map(rotO)});
  }

  function bbox(L){
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    L.rooms.forEach(r=>{ const e=drawn(r); x0=Math.min(x0,e.x); y0=Math.min(y0,e.y); x1=Math.max(x1,e.x+e.w); y1=Math.max(y1,e.y+e.d); });
    if(L.stairs){ const s=L.stairs; x0=Math.min(x0,s.x); y0=Math.min(y0,s.y); x1=Math.max(x1,s.x+s.w); y1=Math.max(y1,s.y+s.d); }
    return {x:x0, y:y0, w:x1-x0, d:y1-y0};
  }

  const stairC = L => L.stairs ? {x:L.stairs.x+L.stairs.w/2, y:L.stairs.y+L.stairs.d/2} : null;

  // Arrange main levels (feet): each gets an offset inside its cell so stairs line up.
  function arrange(levels){
    const n = levels.length, bbs = levels.map(bbox);
    const allStairs = levels.every(L=>L.stairs);
    const grid = n===4;
    const pos = levels.map(()=>({ox:0, oy:0}));
    const rows = grid ? [[0,1],[2,3]] : [levels.map((_,i)=>i)];
    const cols = grid ? [[0,2],[1,3]] : levels.map((_,i)=>[i]);
    // y alignment within each row
    rows.forEach(row=>{
      if(allStairs){ const cy = row.map(i=>stairC(levels[i]).y - bbs[i].y); const m=Math.max(...cy); row.forEach((i,k)=>pos[i].oy = m-cy[k]); }
    });
    if(grid) cols.forEach(col=>{
      if(allStairs){ const cx = col.map(i=>stairC(levels[i]).x - bbs[i].x); const m=Math.max(...cx); col.forEach((i,k)=>pos[i].ox = m-cx[k]); }
    });
    const colW = cols.map(col=>Math.max(...col.map(i=>pos[i].ox + bbs[i].w)));
    const rowH = rows.map(row=>Math.max(...row.map(i=>pos[i].oy + bbs[i].d)));
    return {grid, rows, cols, colW, rowH, pos, bbs};
  }

  function scaleFor(A, w, h){
    const nc = A.colW.length, nr = A.rowH.length;
    const sw = (w - GAP*(nc-1)) / A.colW.reduce((a,b)=>a+b,0);
    const sh = (h - LEVEL_LABEL_H*nr - GAP*(nr-1)*0.6) / A.rowH.reduce((a,b)=>a+b,0);
    return Math.min(sw, sh, S_MAX);
  }

  // Choose the label lines for a room at scale s; null = unlabeled, false = won't fit.
  function labelFor(r, s){
    if(r.label===false || r.kind==='open') return null;
    const e = drawn(r), rw = e.w*s - 5, rh = e.d*s - 4;
    // dims:false = a plan scaled from the square feet: no size was printed, so none is shown (an estimate never prints)
    const dims = r.dims === false ? null : r.crop ? `${dimsOf(r)}` : dimsOf(r);
    const tries = (dims ? [[r.name, dims], [r.short, dims]] : []).concat([[r.name], [r.short]]).filter(t=>t[0]);
    for(const t of tries){
      const h = t.length*LINE + 1;
      if(h <= rh && est(t[0],'600') <= rw && (t.length<2 || est(t[1],'400') <= rw)) return t;
    }
    if(r.minor || r.kind==='closet' || r.kind==='wet') return null;
    return false;
  }

  function fits(levels, s){
    const bad = [];
    levels.forEach(L=>L.rooms.forEach(r=>{ if(labelFor(r, s)===false) bad.push({level:L.name, room:r.name}); }));
    return bad;
  }

  /* Lay out and draw. box: {x, y, w, h} in pt (panel coordinates).
     Returns {html, issues, scale, usedW, usedH, rotated, insetNote} */
  function draw(plan, box, opt){
    opt = opt || {};
    let main = plan.levels.filter(L=>!L.inset);
    let insets = plan.levels.filter(L=>L.inset).concat(plan.insets||[]);
    const issues = [];

    const attempt = (mainLv, insetLv) => {
      const insW = insetLv.length ? Math.min(150, box.w*0.26) : 0;
      const w = box.w - (insW ? insW + GAP : 0);
      let best = null;
      [false, true].forEach(rot=>{
        if(rot && !opt.allowRotate) return;
        if(opt.rotate !== undefined && rot !== opt.rotate) return;   // redraw in an orientation already chosen
        const lv = rot ? mainLv.map(rotateLevel) : mainLv;
        const A = arrange(lv); const s = scaleFor(A, w, box.h);
        const bad = fits(lv, s);
        const score = s * (bad.length ? 0.5 : 1);
        if(!best || score > best.score*1.18) best = {lv, A, s, bad, rot, score, insW, w};
      });
      return best;
    };

    let R = attempt(main, insets);
    // raised coastal: living level gets the larger spot; non-living levels become insets drawn smaller
    if(R.bad.length && main.some(L=>L.living===false) && main.some(L=>L.living!==false)){
      const moved = main.filter(L=>L.living===false).map(L=>Object.assign({}, L, {inset:true, smaller:true}));
      const R2 = attempt(main.filter(L=>L.living!==false), moved.concat(insets));
      if(R2.bad.length <= R.bad.length){ R = R2; insets = moved.concat(insets); main = main.filter(L=>L.living!==false); }
    }
    R.bad.forEach(b=>issues.push({slot:`plan.${b.level}.${b.room}`, kind:'plan-label-wont-fit-at-8pt', detail:'flag for review; the plan is never shrunk'}));

    const {lv, A, s} = R;
    const nc = A.colW.length, nr = A.rowH.length;
    const gridW = A.colW.reduce((a,b)=>a+b,0)*s + GAP*(nc-1);
    const gridH = A.rowH.reduce((a,b)=>a+b,0)*s + LEVEL_LABEL_H*nr + GAP*(nr-1)*0.6;
    // center the drawing in its share of the box
    const x0 = box.x + (R.w - gridW)/2;
    const y0 = box.y + Math.max(0, (box.h - gridH)/2);
    let svg = '', labels = '';
    const colX = []; let cx = x0; A.colW.forEach((cw,i)=>{ colX[i]=cx; cx += cw*s + GAP; });
    const rowY = []; let cy = y0; A.rowH.forEach((rh,i)=>{ rowY[i]=cy; cy += rh*s + LEVEL_LABEL_H + GAP*0.6; });

    lv.forEach((L, i)=>{
      const ci = A.cols.findIndex(c=>c.includes(i)), ri = A.rows.findIndex(r=>r.includes(i));
      const bb = A.bbs[i], p = A.pos[i];
      const ox = colX[ci] + (p.ox - bb.x)*s, oy = rowY[ri] + (p.oy - bb.y)*s;
      const g = levelSVG(L, s, ox, oy, i);
      svg += g.svg; labels += g.labels;
      // level name centered under this level's drawing, at the bottom of its row
      const lx = ox + bb.x*s, lw = bb.w*s, ly = rowY[ri] + A.rowH[ri]*s + 4;
      labels += `<div class="abs plan-level" style="left:${lx-30}pt;top:${ly}pt;width:${lw+60}pt" data-slot="plan.level${i}" data-lines="1">${Ivory.esc(L.name)}</div>`;
    });

    // insets: stacked in the right-hand strip, each at the largest scale that fits, labeled "drawn smaller"
    if(insets.length){
      const ix = box.x + R.w + GAP, iw = R.insW;
      let iy = box.y + 6;
      const per = (box.h - 6) / insets.length;
      insets.forEach((L, k)=>{
        const bb = bbox(L);
        const si = Math.min(s, (iw-4)/bb.w, (per - LEVEL_LABEL_H*2 - 8)/bb.d);
        const ox = ix + (iw - bb.w*si)/2 - bb.x*si, oy = iy - bb.y*si;
        const g = levelSVG(Object.assign({}, L, {rooms:L.rooms.map(r=>Object.assign({}, r, {label: (labelFor(r, si) ? r.label : false)}))}), si, ox, oy, 'i'+k);
        svg += g.svg; labels += g.labels;
        const note = si < s*0.98 ? 'drawn smaller' : '';
        labels += `<div class="abs plan-level" style="left:${ix-8}pt;top:${iy + bb.d*si + 4}pt;width:${iw+16}pt" data-slot="plan.inset${k}" data-lines="1">${Ivory.esc(L.name)}</div>`;
        if(note) labels += `<div class="abs plan-note" style="left:${ix-8}pt;top:${iy + bb.d*si + 16}pt;width:${iw+16}pt" data-slot="plan.inset${k}.note" data-lines="1" data-fine="1">${note}</div>`;
        iy += per;
      });
    }

    const html = `<svg class="plan-svg" style="left:${box.x}pt;top:${box.y}pt;width:${box.w}pt;height:${box.h}pt" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="var(--paper)"/><line x1="0" y1="0" x2="0" y2="4" stroke="var(--accent)" stroke-opacity=".28" stroke-width=".7"/></pattern></defs>
      ${svg}</svg>${labels}`;
    return {html, issues, scale:s, usedW: gridW + (insets.length ? R.insW + GAP : 0), usedH: gridH, rotated: R.rot,
            insets: insets.length, levels: lv.length};
  }

  /* Doors and windows for a level, in feet. Uses the level's own doors/windows when the plan gives them;
     otherwise places them where they normally go. */
  function openingsFor(L, R){
    if(L.doors || L.windows) return {doors:L.doors||[], windows:L.windows||[]};
    const E = 0.35, rooms = R.map(({r,e})=>({r, e, z:zoneOf(r)}));
    const indoor = rooms.filter(o=>o.r.kind!=='outdoor');
    // shared wall between a and b: {h, at, from, to, side} where side is a's wall facing b
    const shared = (a, b) => {
      const A = a.e, B = b.e;
      const ox0 = Math.max(A.x, B.x), ox1 = Math.min(A.x+A.w, B.x+B.w), oy0 = Math.max(A.y, B.y), oy1 = Math.min(A.y+A.d, B.y+B.d);
      if(Math.abs(A.y+A.d - B.y) < E && ox1-ox0 > 0) return {h:true, at:A.y+A.d, from:ox0, to:ox1, side:'down'};
      if(Math.abs(B.y+B.d - A.y) < E && ox1-ox0 > 0) return {h:true, at:A.y, from:ox0, to:ox1, side:'up'};
      if(Math.abs(A.x+A.w - B.x) < E && oy1-oy0 > 0) return {h:false, at:A.x+A.w, from:oy0, to:oy1, side:'right'};
      if(Math.abs(B.x+B.w - A.x) < E && oy1-oy0 > 0) return {h:false, at:A.x, from:oy0, to:oy1, side:'left'};
      return null;
    };
    const opposite = {up:'down', down:'up', left:'right', right:'left'};
    const doors = [], windows = [];
    const rank = (room, n) => {
      const order = room.z==='service' ? ['sleep','open','living','bath'] : room.z==='bath' ? ['open','sleep','living'] : ['open','living'];
      const i = order.indexOf(n.z); return i < 0 ? 99 : i;
    };
    const wantsDoor = o => ['sleep','bath','service'].includes(o.z) && o.r.kind!=='outdoor' && o.r.door!==false;
    indoor.filter(wantsDoor).forEach(o=>{
      let best = null;
      indoor.forEach(n=>{ if(n===o || n.r.kind==='garage') return;
        const w = shared(o, n); if(!w) return;
        const len = w.to - w.from, need = o.z==='service' ? 2.2 : 2.6; if(len < need + 0.4) return;
        const sc = rank(o, n) * 100 - len; if(!best || sc < best.sc) best = {sc, w, n};
      });
      if(!best || rank(o, best.n) === 99) return;
      const w = best.w, dw = Math.min(o.z==='sleep' ? 3 : 2.5, w.to - w.from - 0.6);
      // swing into the room (doors open into bedrooms, baths and closets); hinge near the start of the shared run
      const swing = opposite[w.side];   // swings into this room, away from the wall it shares
      const start = w.from + 0.4;
      doors.push(w.h ? {x:start, y:w.at, w:dw, dir:swing} : {x:w.at, y:start, w:dw, dir:swing});
    });
    // front door: onto the front porch when the plan shows one; else entry/foyer, else the widest living area,
    // on its street-side wall (bottom; left once turned on its side)
    const porch = rooms.filter(o=>o.r.kind==='outdoor' && /porch|stoop|front/i.test(o.r.name));
    let fd = null;
    porch.forEach(pc=>indoor.filter(o=>o.z==='living' || o.z==='open' || /entry|foyer/i.test(o.r.name)).forEach(o=>{
      const w = shared(o, pc); if(!w || w.to - w.from < 3.4 || fd) return;
      const dw = Math.min(3, w.to - w.from - 0.4), a = (w.from + w.to)/2 - dw/2;
      fd = w.h ? {x:a, y:w.at, w:dw, dir:opposite[w.side], front:true} : {x:w.at, y:a, w:dw, dir:opposite[w.side], front:true};
    }));
    if(fd) doors.push(fd);
    else if(L.rotated){
      const left = Math.min(...indoor.map(o=>o.e.x));
      const entry = indoor.find(o=>/entry|foyer/i.test(o.r.name) && o.e.x < left + 6)
                 || indoor.filter(o=>o.z==='living' && o.e.x < left + 3).sort((a,b)=>b.e.d-a.e.d)[0];
      if(entry && entry.e.d >= 3.6){ const dw = Math.min(3, entry.e.d - 1); doors.push({x:entry.e.x, y:entry.e.y + (entry.e.d - dw)/2, w:dw, dir:'right', front:true}); }
    } else {
      const bottom = Math.max(...indoor.map(o=>o.e.y+o.e.d));
      const entry = indoor.find(o=>/entry|foyer/i.test(o.r.name) && o.e.y+o.e.d > bottom - 6)
                 || indoor.filter(o=>o.z==='living' && o.e.y+o.e.d > bottom - 3).sort((a,b)=>b.e.w-a.e.w)[0];
      if(entry && entry.e.w >= 3.6){ const dw = Math.min(3, entry.e.w - 1); doors.push({x:entry.e.x + (entry.e.w - dw)/2, y:entry.e.y+entry.e.d, w:dw, dir:'up', front:true}); }
    }
    // windows: one per outside wall of living areas and bedrooms, on a clear run of 5 ft or more
    indoor.filter(o=>o.z==='living' || o.z==='sleep').forEach(o=>{
      const e = o.e;
      [['up', true, e.y, e.x, e.x+e.w], ['down', true, e.y+e.d, e.x, e.x+e.w], ['left', false, e.x, e.y, e.y+e.d], ['right', false, e.x+e.w, e.y, e.y+e.d]].forEach(([side, h, at, a0, a1])=>{
        let runs = [[a0, a1]];
        rooms.forEach(n=>{ if(n===o) return; const w = shared(o, n); if(!w || w.side!==side) return;
          runs = runs.flatMap(([p,q])=> w.to<=p || w.from>=q ? [[p,q]] : [[p, Math.max(p, w.from)], [Math.min(q, w.to), q]].filter(([u,v])=>v-u>0.1)); });
        const run = runs.sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]))[0];
        if(!run || run[1]-run[0] < 5) return;
        const ww = Math.min(5, (run[1]-run[0])*0.45), c = (run[0]+run[1])/2 - ww/2;
        if(doors.some(d=>d.front && (h ? (d.dir==='up'||d.dir==='down') && Math.abs(d.y-at)<E && d.x < c+ww+1 && d.x+d.w > c-1 : (d.dir==='left'||d.dir==='right') && Math.abs(d.x-at)<E && d.y < c+ww+1 && d.y+d.w > c-1))) return;
        windows.push(h ? {x:c, y:at, w:ww, dir:side} : {x:at, y:c, w:ww, dir:side});
      });
    });
    return {doors, windows};
  }

  function levelSVG(L, s, ox, oy, key){
    const R = L.rooms.map(r=>({r, e:drawn(r)}));
    const X = v => (ox + v*s).toFixed(2), Y = v => (oy + v*s).toFixed(2), S = v => (v*s).toFixed(2);
    let walls = '', fills = '', lines = '', extra = '', labels = '';
    R.forEach(({r,e})=>{
      if(isIndoor(r)) walls += `<rect x="${X(e.x)}" y="${Y(e.y)}" width="${S(e.w)}" height="${S(e.d)}" fill="none" stroke="var(--ink)" stroke-width="3"/>`;
    });
    R.forEach(({r,e})=>{
      const fill = r.kind==='outdoor' ? 'url(#hatch)' : r.kind==='garage' ? 'rgba(0,0,0,.055)' : 'var(--paper)';
      fills += `<rect x="${X(e.x)}" y="${Y(e.y)}" width="${S(e.w)}" height="${S(e.d)}" fill="${fill}"/>`;
      const z = ZONES[zoneOf(r)];
      if(z) fills += `<rect x="${X(e.x)}" y="${Y(e.y)}" width="${S(e.w)}" height="${S(e.d)}" fill="${z.fill}" fill-opacity="${z.op}"/>`;
      const dash = r.kind==='outdoor' ? ' stroke-dasharray="2 1.6"' : '';
      lines += `<rect x="${X(e.x)}" y="${Y(e.y)}" width="${S(e.w)}" height="${S(e.d)}" fill="none" stroke="var(--ink)" stroke-opacity="${r.kind==='outdoor'?.55:1}" stroke-width=".75"${dash}/>`;
      if(r.crop){ // clean break: a paper gap with a zigzag on the cut edge
        const c = r.crop.side, z = [];
        const zig = (ax, ay, bx, by, n) => { const pts=[]; for(let k=0;k<=n;k++){ const t=k/n; const off=(k%2? 2.4:-2.4); pts.push((ax+(bx-ax)*t + (ay===by?0:off)).toFixed(2)+','+(ay+(by-ay)*t + (ay===by?off:0)).toFixed(2)); } return pts.join(' '); };
        let ax, ay, bx, by;
        if(c==='right'){ ax=+X(e.x+e.w); ay=+Y(e.y); bx=ax; by=+Y(e.y+e.d); }
        if(c==='left'){ ax=+X(e.x); ay=+Y(e.y); bx=ax; by=+Y(e.y+e.d); }
        if(c==='bottom'){ ax=+X(e.x); ay=+Y(e.y+e.d); bx=+X(e.x+e.w); by=ay; }
        if(c==='top'){ ax=+X(e.x); ay=+Y(e.y); bx=+X(e.x+e.w); by=ay; }
        const n = Math.max(4, Math.round(Math.hypot(bx-ax, by-ay)/5));
        extra += `<polyline points="${zig(ax,ay,bx,by,n)}" fill="none" stroke="var(--paper)" stroke-width="5"/><polyline points="${zig(ax,ay,bx,by,n)}" fill="none" stroke="var(--ink)" stroke-opacity=".55" stroke-width=".75"/>`;
      }
    });
    // pieces of one open space (same name, the extra pieces unlabeled): no wall where they meet, the floor runs through
    R.forEach(({r:a,e:A}, i)=>R.forEach(({r:b,e:B}, j)=>{
      if(j <= i || a.name !== b.name || (a.label !== false && b.label !== false) || !isIndoor(a)) return;
      const z = ZONES[zoneOf(a)], paint = (x, y, w, h) => {
        extra += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="var(--paper)"/>`;
        if(z) extra += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${z.fill}" fill-opacity="${z.op}"/>`;
      };
      const T = 2.2, eps = 0.2;   // half the wall's width (pt) to cover; the ends stay clear of the walls that cross
      for(const [P, Q] of [[A, B], [B, A]]){
        if(Math.abs(P.x + P.w - Q.x) < eps){ const y0 = Math.max(P.y, Q.y), y1 = Math.min(P.y + P.d, Q.y + Q.d);
          if(y1 - y0 > 0.5) paint(+X(Q.x) - T, +Y(y0) + T, 2*T, (y1 - y0)*s - 2*T); }
        if(Math.abs(P.y + P.d - Q.y) < eps){ const x0 = Math.max(P.x, Q.x), x1 = Math.min(P.x + P.w, Q.x + Q.w);
          if(x1 - x0 > 0.5) paint(+X(x0) + T, +Y(Q.y) - T, (x1 - x0)*s - 2*T, 2*T); }
      }
    }));
    if(L.stairs){ // treads across the run (the run is the longer side)
      const st = L.stairs, along = st.d >= st.w;
      extra += `<rect x="${X(st.x)}" y="${Y(st.y)}" width="${S(st.w)}" height="${S(st.d)}" fill="var(--paper)" stroke="var(--ink)" stroke-width=".75"/>`;
      const len = along ? st.d : st.w, n = Math.max(4, Math.round(len/0.9));
      for(let k=1;k<n;k++){
        const t = k*len/n;
        extra += along ? `<line x1="${X(st.x)}" y1="${Y(st.y+t)}" x2="${X(st.x+st.w)}" y2="${Y(st.y+t)}" stroke="var(--ink)" stroke-opacity=".6" stroke-width=".45"/>`
                       : `<line x1="${X(st.x+t)}" y1="${Y(st.y)}" x2="${X(st.x+t)}" y2="${Y(st.y+st.d)}" stroke="var(--ink)" stroke-opacity=".6" stroke-width=".45"/>`;
      }
    }
    // windows on outside walls, then doors (each cuts its wall with a paper gap)
    const openings = openingsFor(L, R);
    openings.windows.forEach(o=>{
      const h = o.dir==='up' || o.dir==='down';
      const x1 = +X(o.x), y1 = +Y(o.y), x2 = +X(h ? o.x+o.w : o.x), y2 = +Y(h ? o.y : o.y+o.w);
      const nx = h ? 0 : 1.1, ny = h ? 1.1 : 0;
      extra += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--paper)" stroke-width="3.2"/>`
             + `<line x1="${(x1-nx).toFixed(2)}" y1="${(y1-ny).toFixed(2)}" x2="${(x2-nx).toFixed(2)}" y2="${(y2-ny).toFixed(2)}" stroke="var(--ink)" stroke-width=".5"/>`
             + `<line x1="${(x1+nx).toFixed(2)}" y1="${(y1+ny).toFixed(2)}" x2="${(x2+nx).toFixed(2)}" y2="${(y2+ny).toFixed(2)}" stroke="var(--ink)" stroke-width=".5"/>`;
    });
    openings.doors.forEach(o=>{
      const h = o.dir==='up' || o.dir==='down', sg = (o.dir==='down' || o.dir==='right') ? 1 : -1;
      const hx = +X(o.x), hy = +Y(o.y), L2 = o.w*s;
      const ex = h ? hx + L2 : hx, ey = h ? hy : hy + L2;            // far end of the opening
      const lx = h ? hx : hx + sg*L2, ly = h ? hy + sg*L2 : hy;      // open leaf tip
      const sweep = h ? (sg>0 ? 0 : 1) : (sg>0 ? 1 : 0);
      // an opening in the wall, no door leaf or swing (10/21/2026: "just leave openings"); short jambs mark the ends
      const jx = h ? 0 : 1.9, jy = h ? 1.9 : 0;
      extra += `<line x1="${hx}" y1="${hy}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}" stroke="var(--paper)" stroke-width="3.6"/>`
             + `<line x1="${(hx-jx).toFixed(2)}" y1="${(hy-jy).toFixed(2)}" x2="${(hx+jx).toFixed(2)}" y2="${(hy+jy).toFixed(2)}" stroke="var(--ink)" stroke-width=".75"/>`
             + `<line x1="${(ex-jx).toFixed(2)}" y1="${(ey-jy).toFixed(2)}" x2="${(ex+jx).toFixed(2)}" y2="${(ey+jy).toFixed(2)}" stroke="var(--ink)" stroke-width=".75"/>`;
    });
    R.forEach(({r,e}, j)=>{
      const t = labelFor(r, s); if(!t) return;
      const cx = ox + (e.x + e.w/2)*s, cy = oy + (e.y + e.d/2)*s, h = t.length*LINE;
      const w = e.w*s;
      labels += `<div class="abs plan-room" style="left:${(cx - w/2).toFixed(2)}pt;top:${(cy - h/2).toFixed(2)}pt;width:${w.toFixed(2)}pt" data-room="${key}.${j}" data-box="${(ox+e.x*s).toFixed(2)},${(oy+e.y*s).toFixed(2)},${(e.w*s).toFixed(2)},${(e.d*s).toFixed(2)}">`
        + `<b>${Ivory.esc(t[0])}</b>${t[1] ? `<span>${Ivory.esc(t[1])}</span>` : ''}</div>`;
    });
    return {svg: `<g>${walls}${fills}${lines}${extra}</g>`, labels};
  }

  // Print check: every room label sits inside its room at 8 pt or more (a colored plan's: in its clear spot, 6 pt or more).
  function check(){
    const out = [];
    document.querySelectorAll('.plan-room').forEach(el=>{
      const [x,y,w,h] = el.dataset.box.split(',').map(Number);
      const p = el.closest('.panel').getBoundingClientRect();
      [...el.children].forEach(c=>{
        const r = c.getBoundingClientRect();
        const l = (r.left - p.left)*PT, t = (r.top - p.top)*PT, rr = l + r.width*PT, bb = t + r.height*PT;
        const size = parseFloat(getComputedStyle(c).fontSize)*PT;
        // a colored plan's label may drop to 6 pt (owner 10/27); its box is the clear spot it was set in, with no line under it
        if(size < (+el.dataset.min || 8) - 0.05) out.push({slot:'plan.room '+el.textContent, kind:'type-too-small', size:+size.toFixed(1)});
        if(l < x-0.5 || rr > x+w+0.5 || t < y-0.5 || bb > y+h+0.5) out.push({slot:'plan.room '+c.textContent, kind:el.dataset.min ? 'plan-label-on-line' : 'plan-label-outside-room'});
      });
    });
    return out;
  }

  /* The listing's own plan, colored (owner 10/27: dress up the listing's plan, don't redraw it).
     plan: {kind:'color', source, finished, levels:[{name, roof, front, w, h (px), pageScale (page px per px), feet:{w, d} | null,
     layers:{ink, living, sleep, bath} (PNG masks), fixtures:[{type, x, y, w, h (fractions), back, n, inches, ...}],
     labels:[{name, short, dims, dimsOptional, kind, minor, zone, x, y (the room's center), bx, by, w, h (room box),
     c:[{x, y, p:[[half height, half width]...]}] (clear spots, nearest the center first)}]} (fractions)], or a finished
     listing plan's levels {kind:'image', src, textDir, w, h, ...} placed as drawn}, made in the browser from the listing's
     image (preview-tools.js colorPlan).
     the owner's 10/28 rules: each plan turns whichever way prints it biggest (a finished drawing is never upside down) and is
     centered in its space; redrawn floors share one scale, a listing's own drawing fills its space floor by floor (its
     printed labels are small); floor names larger, none on a one-story plan. The design tints the masks (living areas,
     bedrooms, baths; the bath tint a little darker so baths stand out); our fixtures (counters, range, sinks, island,
     toilet, tub, shower, vanity, curved stairs) are drawn over them in the design's ink. Labels in the design's font:
     one per room, centered both ways, 8 pt down to 6 pt, two-word names stacked when that fits better, then a short form
     ("WIC", "STOR"); never on a line; a room is never left unlabeled (the last try sets 6 pt in the roomiest spot and is
     reported). Returns what draw returns. */
  const TINT = {
    living:  'color-mix(in srgb, var(--accent) 13%, var(--paper))',
    sleep:   'color-mix(in srgb, #c4a46a 24%, var(--paper))',
    bath:    'color-mix(in srgb, #6f8ea6 32%, var(--paper))',
    ink:     'var(--ink)',
    // a chase: hatched in the ink (owner 10/28)
    chase:   'repeating-linear-gradient(45deg, var(--ink) 0 0.45pt, transparent 0.45pt 2.6pt)',
  };
  const OPTIONAL = l => l.minor || l.kind==='wet' || l.kind==='closet' || l.kind==='open' || l.kind==='outdoor' || l.zone==='inherit' || l.zone==='bath' || l.zone==='void';
  // label sizes: as large as the room allows, up to 9 pt (owner 10/28; 9 keeps a plan's labels in one family)
  const SIZES = [9, 8.5, 8, 7.5, 7, 6.5, 6], LINE_K = 9.5/8, C_SMAX = 12;
  // a word a label may drop when the whole name won't fit ("His Wardrobe" -> "Wardrobe", "Cov'd Porch" -> "Porch"); never a
  // cut-off word or an abbreviation ("Cochere", "UTIL", "STOR", "PWD", the owner 10/28). WIC is the one short form (he asked).
  const MODIFIER = /^(his|hers?|cov'?d|covered|front|back|rear|side|owner'?s|upper|lower)$/i;   // (never "Primary": a primary bath is not just a bath)
  // the text to try: each a list of [text, bold] lines. The room's size goes under the name whenever the listing has one
  // (owner 10/28: room sizes never drop off; a small bath shows "Bath" alone, 10/27). A two-word name may stack.
  function colorTexts(l){
    if(l.zone === 'void' && /^open/i.test(l.name)) return [[['Open to below', 1]], [['Open to', 1], ['below', 1]]].map(t=>Object.assign(t, {ni:0}));
    const wic = /walk-?in closet|^w\.?i\.?c\.?$/i.test(l.name), words = String(l.name).split(/\s+/), d = l.dims && [l.dims, 0];
    // [name, rank]: 0 the full name; 1 without a first word like "His"; 2 a two-part name's first part ("Storage / Future
    // Lift" -> "Storage"), a whole word, only when nothing else fits
    const names = [[wic ? 'WIC' : l.name, 0]];
    if(!wic && words.length >= 2 && MODIFIER.test(words[0])) names.push([words.slice(1).join(' '), 1]);
    if(/\//.test(l.name) && !/^w\/d$/i.test(l.name)) names.push([l.name.split('/')[0].trim(), 2]);
    const T = [];
    names.forEach(([n, ni])=>{ const w = n.split(/\s+/), forms = [[[n, 1]]];
      if(w.length === 2 && w[1].length > 2) forms.push([[w[0], 1], [w[1], 1]]);   // never "Bath" over "2"
      if(w.length === 3) forms.push([[w.slice(0, 2).join(' '), 1], [w[2], 1]], [[w[0], 1], [w.slice(1).join(' '), 1]]);
      forms.forEach(f=>T.push(Object.assign(d ? f.concat([d]) : f, {ni})));
      // one line, name then size, where two lines won't fit (a narrow kitchen between its islands, Marshall)
      if(d) T.push(Object.assign([[n + '\u2002' + l.dims, 2]], {ni, one: true})); });
    return T;
  }
  // a label fits a clear box with room to spare: no more than 90% of its width, a little air above and below
  // (a word of three letters or less, "W/D", "WIC", may use the whole clear width: it reads in a tight closet)
  const fitsClear = (hh, hw, tw, th, short)=>tw <= (short ? 1 : 0.9)*2*hw && hh >= th/2 + 0.3;
  const measure = (t, z)=>({tw: Math.max(...t.map(([s, b])=>b === 2 ? est(s.split('\u2002')[0], '600') + est('\u2002' + s.split('\u2002')[1], '400') : est(s, b ? '600' : '400')))*z/LABEL, th: t.length*LINE_K*z});
  // where a label goes (owner 10/28: centered in its room and as large as the room allows, on open floor, never on a
  // fixture or a door swing): the largest size that fits at the room's center (within half a foot), nearest
  // the center among equals; when nothing fits there (an island, a fixture), the largest anywhere, nearest the center. Failing all, 6 pt in the clearest spot (reported). rc: the room's
  // center and short side as placed, pt. -> {t, z, tw, th, s, tight}
  function colorFit(l, spots, rc, clash){
    const texts = colorTexts(l), sh = t=>t.map(q=>q[0]).join('').length <= 3;
    clash = clash || (()=>false);
    const near = rc ? Math.max(2, 0.5 * rc.f) : Infinity, dist = s=>rc ? Math.hypot(s.x - rc.x, s.y - rc.y) : 0;
    const all = [];
    for(const t of texts) for(const z of SIZES) for(const s of spots){
      const {tw, th} = measure(t, z);
      // (never on another room's label)
      if(s.r.some(([hh, hw])=>fitsClear(hh, hw, tw, th, sh(t))) && !clash(s.x, s.y, tw, th)) all.push({t, z, tw, th, s, d: dist(s), lines: t.length});
    }
    // (the full name, unless dropping its first word ("Owner's", "His") sets it a full point larger)
    const pick = ni=>{
      // (name over size, the plan's look; one line only where that won't fit)
      let c = all.filter(q=>q.t.ni === ni && !q.t.one); if(!c.length) c = all.filter(q=>q.t.ni === ni); if(!c.length) return null;
      const top = q=>Math.max(...q.map(x=>x.z)), cent = c.filter(q=>q.d <= near), za = top(c), zc = cent.length ? top(cent) : 0;
      // centered wins: the largest size that fits at the center; a little off center (within a fifth of the room's short side, 1.4 ft at most)
      // only when that sets it a full point larger (a door swing beside the center); anywhere when nothing fits at the
      // center (an island)
      const off = rc ? c.filter(q=>q.d <= Math.max(near, Math.min(0.2 * rc.m, 1.4 * rc.f))) : c, zo = off.length ? top(off) : 0;
      const pool = cent.length && zc >= zo - 0.75 ? cent.filter(q=>q.z === zc) : off.length ? off.filter(q=>q.z === zo) : c.filter(q=>q.z === za);
      let best = pool.sort((p, q)=>p.d - q.d || p.lines - q.lines)[0];
      // a larger size for under half a foot more off center is the better label
      // (half a foot from where the centered pick sat, never step by step farther)
      const d0 = best.d, up = c.filter(q=>q.z >= best.z + 0.5 && q.d <= d0 + (rc ? 0.5 * rc.f : 0)).sort((p, q)=>q.z - p.z || p.d - q.d)[0]; if(up) best = up;
      return best;
    };
    const f0 = pick(0), f1 = pick(1), f2 = pick(2);
    if(f0 && (!f1 || f0.z >= f1.z - 0.5)) return f0;
    if(f1) return f1;
    if(f2) return f2;
    // a small room: the whole clear width, no air above and below, still on open floor (never on a line)
    for(const t of texts.slice().sort((a, b)=>measure(a, 6).tw - measure(b, 6).tw)) for(const z of [6.5, 6]){ const {tw, th} = measure(t, z);
      const ok = spots.filter(q=>q.r.some(([hh, hw])=>tw <= 2*hw && hh >= th/2) && !clash(q.x, q.y, tw, th)).sort((p, q)=>dist(p) - dist(q))[0];
      if(ok) return {t, z, tw, th, s: ok, snug: true}; }
    // nothing fits clear (a small bath full of fixtures at a small print size): the shortest form at 6 pt where it runs past
    // its clear box the least, so it nicks the fewest lines, on no other label (reported for review); none: off
    const t = texts.slice().sort((a, b)=>measure(a, 6).tw - measure(b, 6).tw)[0], m6 = measure(t, 6);
    const over = q=>Math.min(...q.r.map(([hh, hw])=>Math.max(0, m6.tw/2 - hw)*m6.th + Math.max(0, m6.th/2 - hh)*m6.tw));
    const s = spots.filter(q=>!clash(q.x, q.y, m6.tw, m6.th)).sort((a, b)=>over(a) - over(b) || dist(a) - dist(b))[0];
    if(!s) return null;
    return Object.assign({t, z:6, s, tight:true}, measure(t, 6));
  }
  // a floor turned clockwise by a (0, 90, 180, 270): the CSS for the upright floor (uw x uh) inside its placed box (w x h),
  // and where an upright point lands
  const turnCSS = (a, w, h)=>a===90 ? `;transform-origin:0 0;transform:translate(${w.toFixed(2)}pt,0) rotate(90deg)`
    : a===180 ? `;transform-origin:0 0;transform:translate(${w.toFixed(2)}pt,${h.toFixed(2)}pt) rotate(180deg)`
    : a===270 ? `;transform-origin:0 0;transform:translate(0,${h.toFixed(2)}pt) rotate(270deg)` : '';
  const turnPt = (a, x, y, uw, uh)=>a===90 ? [uh - y, x] : a===180 ? [uw - x, uh - y] : a===270 ? [y, uw - x] : [x, y];
  // the turn that leaves the front door at the bottom or the left, for a tie between two equally large turns
  const FRONT_OK = {bottom:[0, 90], left:[0, 270], top:[270], right:[90]};
  // our fixtures, in the floor's upright pt (u: pt per px of the floor's masks; f: pt per foot), drawn in the design's ink
  // on the paper: the standard symbols, never the builder's linework (owner 10/28)
  function fixturesSVG(L, uw, uh, f){
    const X = v=>v*uw, Y = v=>v*uh, sw = 0.6, ink = 'var(--ink)', paper = 'var(--paper)';
    let o = '';
    const rect = (x, y, w, h, extra)=>`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${paper}" stroke="${ink}" stroke-width="${sw}" ${extra||''}/>`;
    for(const q of L.fixtures || []){
      const x = X(q.x), y = Y(q.y), w = X(q.w), h = Y(q.h), cx = x + w/2, cy = y + h/2, m = Math.min(w, h);
      // the side the fixture backs onto (a toilet's tank, a range's controls): 'top' | 'bottom' | 'left' | 'right'
      const back = q.back || (w > h ? 'top' : 'left');
      if(q.type === 'counter' || q.type === 'island') o += rect(x, y, w, h, q.type === 'island' ? 'rx="0.6"' : '');
      else if(q.type === 'range'){
        o += rect(x, y, w, h);
        const six = (q.n || 0) >= 6 || (q.inches || 0) >= 42, cols = six ? 3 : 2, along = w >= h;
        const L1 = along ? w : h, L2 = along ? h : w, r = Math.min(L1 / cols, L2 / 2) * 0.3;
        for(let i = 0; i < cols; i++) for(let j = 0; j < 2; j++){
          const a = (i + 0.5) / cols * L1, b = (j + 0.5) / 2 * L2;
          o += `<circle cx="${(along ? x + a : x + b).toFixed(2)}" cy="${(along ? y + b : y + a).toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="${ink}" stroke-width="${sw*0.8}"/>`;
        }
      } else if(q.type === 'sink'){
        const n = q.n || 1, along = w >= h, pad = m * 0.14;
        for(let i = 0; i < n; i++){
          const bx = along ? x + pad + i * (w - pad) / n : x + pad, by = along ? y + pad : y + pad + i * (h - pad) / n;
          const bw = along ? (w - pad) / n - pad : w - 2 * pad, bh = along ? h - 2 * pad : (h - pad) / n - pad;
          o += `<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="${(Math.min(bw, bh) * 0.25).toFixed(2)}" fill="${paper}" stroke="${ink}" stroke-width="${sw*0.8}"/>`;
        }
      } else if(q.type === 'vanity'){
        o += rect(x, y, w, h);
        const n = q.n || 1, along = w >= h;
        for(let i = 0; i < n; i++){
          const ex = along ? x + (i + 0.5) / n * w : cx, ey = along ? cy : y + (i + 0.5) / n * h;
          const rx = (along ? Math.min(w / n, f * 1.6) : h * 0.32) * 0.32, ry = (along ? h : Math.min(h / n, f * 1.6)) * 0.3;
          o += `<ellipse cx="${ex.toFixed(2)}" cy="${ey.toFixed(2)}" rx="${(along ? rx : ry * 1.1).toFixed(2)}" ry="${(along ? ry : rx).toFixed(2)}" fill="${paper}" stroke="${ink}" stroke-width="${sw*0.8}"/>`;
        }
      } else if(q.type === 'toilet'){
        // tank against the wall, bowl out from it; sized from the box
        const vert = back === 'top' || back === 'bottom', depth = vert ? h : w, span = vert ? w : h, tk = depth * 0.3;
        const tx = back === 'left' ? x : back === 'right' ? x + w - tk : x + span * 0.05, ty = back === 'top' ? y : back === 'bottom' ? y + h - tk : y + span * 0.05;
        o += vert ? rect(x + span * 0.05, ty, span * 0.9, tk, 'rx="0.4"') : rect(tx, y + span * 0.05, tk, span * 0.9, 'rx="0.4"');
        const bl = depth - tk, bx = vert ? cx : (back === 'left' ? x + tk + bl / 2 : x + bl / 2), by = vert ? (back === 'top' ? y + tk + bl / 2 : y + bl / 2) : cy;
        o += `<ellipse cx="${bx.toFixed(2)}" cy="${by.toFixed(2)}" rx="${((vert ? span * 0.36 : bl * 0.5)).toFixed(2)}" ry="${((vert ? bl * 0.5 : span * 0.36)).toFixed(2)}" fill="${paper}" stroke="${ink}" stroke-width="${sw}"/>`;
      } else if(q.type === 'tub'){
        o += rect(x, y, w, h);
        const p = m * 0.12;
        o += `<rect x="${(x + p).toFixed(2)}" y="${(y + p).toFixed(2)}" width="${(w - 2 * p).toFixed(2)}" height="${(h - 2 * p).toFixed(2)}" rx="${(m * 0.3).toFixed(2)}" fill="none" stroke="${ink}" stroke-width="${sw*0.8}"/>`;
      } else if(q.type === 'shower'){
        // a shower keeps the bath's color (owner 10/27): its outline and the drain's X only
        o += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="none" stroke="${ink}" stroke-width="${sw}"/>` + `<path d="M${x.toFixed(2)} ${y.toFixed(2)}L${(x + w).toFixed(2)} ${(y + h).toFixed(2)}M${(x + w).toFixed(2)} ${y.toFixed(2)}L${x.toFixed(2)} ${(y + h).toFixed(2)}" stroke="${ink}" stroke-width="${sw*0.6}"/>`;
      } else if(q.type === 'door'){
        // a clean swing (owner 10/28): the leaf square to the opening from the hinge, a quarter arc to the other jamb
        const hx = X(q.hx), hy = Y(q.hy), lx = X(q.lx), ly = Y(q.ly), r = Math.hypot(lx - hx, ly - hy), ex = hx + q.px * r, ey = hy + q.py * r;
        const sweep = (ex - hx) * (ly - hy) - (ey - hy) * (lx - hx) > 0 ? 1 : 0;
        o += `<path d="M${hx.toFixed(2)} ${hy.toFixed(2)}L${ex.toFixed(2)} ${ey.toFixed(2)}" stroke="${ink}" stroke-width="${sw*1.1}" stroke-linecap="round"/>`
          + `<path d="M${ex.toFixed(2)} ${ey.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${lx.toFixed(2)} ${ly.toFixed(2)}" fill="none" stroke="${ink}" stroke-width="${sw*0.6}"/>`;
      } else if(q.type === 'stairs-curved'){
        // a curved stair: treads on even angles between two arcs (center, radii as fractions of the floor's width)
        const ccx = X(q.cx), ccy = Y(q.cy), r0 = q.r0 * uw, r1 = q.r1 * uw, a0 = q.a0 * Math.PI / 180, a1 = q.a1 * Math.PI / 180, n = q.treads || 14;
        const pt = (r, a)=>[ccx + r * Math.cos(a), ccy + r * Math.sin(a)], arc = r=>{ const [p, q2] = [pt(r, a0), pt(r, a1)], large = Math.abs(a1 - a0) > Math.PI ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
          return `M${p[0].toFixed(2)} ${p[1].toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} ${sweep} ${q2[0].toFixed(2)} ${q2[1].toFixed(2)}`; };
        let d = arc(r0) + arc(r1);
        for(let i = 0; i <= n; i++){ const a = a0 + (a1 - a0) * i / n, [p, q2] = [pt(r0, a), pt(r1, a)]; d += `M${p[0].toFixed(2)} ${p[1].toFixed(2)}L${q2[0].toFixed(2)} ${q2[1].toFixed(2)}`; }
        o += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${sw*0.8}"/>`;
      }
    }
    // (sized to the floor's own box: its units are the floor's pt, never CSS px)
    return o ? `<svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible" viewBox="0 0 ${uw.toFixed(2)} ${uh.toFixed(2)}" preserveAspectRatio="none">${o}</svg>` : '';
  }
  // the drawing inside a floor's box, upright (uw x uh pt): the listing's own image, or our tinted layers and fixtures
  const innerOf = (L, uw, uh, s)=>L.kind === 'image' ? `<img src="${L.src}" alt="" style="position:absolute;inset:0;width:100%;height:100%">`
    : ['chase', 'bath', 'sleep', 'living', 'ink'].map(k=>L.layers && L.layers[k] ? `<div style="position:absolute;inset:0;background:${TINT[k]};-webkit-mask:url('${L.layers[k]}') 0 0/100% 100% no-repeat;mask:url('${L.layers[k]}') 0 0/100% 100% no-repeat"></div>` : '').join('') + fixturesSVG(L, uw, uh, s);
  // words to lines no wider than w pt at the label size
  const wrap = (t, w)=>{ const out = []; let line = ''; for(const wd of t.split(' ')){ const tr = line ? line + ' ' + wd : wd; if(!line || est(tr, '400') <= w) line = tr; else { out.push(line); line = wd; } } if(line) out.push(line); return out; };
  function drawColor(plan, box0, opt){
    opt = opt || {};
    // a garage drawn apart from the house (owner 10/28, concept B): a framed box in a strip beside the house, headed
    // "Detached garage", the garage at its own (smaller) scale, and a site key: the house and garage as two little boxes
    // where the listing places them
    const det = (plan.detached||[]).find(L=>L.w > 0 && L.h > 0), STRIP = det ? Math.round(Math.min(170, Math.max(112, box0.w*0.22))) : 0, SG = det ? 24 : 0;
    const box = det ? Object.assign({}, box0, {w: box0.w - STRIP - SG}) : box0;
    const lv = plan.levels.filter(L=>L.w > 0 && L.h > 0), issues = [], img = lv.some(L=>L.kind === 'image');
    // room between floors: 10/27's for a redrawn plan; more for a listing's own drawing (owner 10/28, Sampson)
    const C_GAP = img ? 36 : 20;
    // each floor's size in feet; a floor without one takes the others' feet per pixel (or all fit alike)
    const fpp = lv.filter(L=>L.feet).map(L=>L.feet.w / L.w).sort((a,b)=>a-b), mid = fpp.length ? fpp[Math.floor(fpp.length/2)] : 0;
    // none at all (no printed sizes, no square feet): the pages' own pixels, since one PDF draws every floor at one scale
    const big = Math.max(...lv.map(L=>Math.max(L.w, L.h)*(L.pageScale||1)));
    const sz0 = lv.map(L=>L.feet ? {w:L.feet.w, d:L.feet.d} : mid ? {w:L.w*mid, d:L.h*mid} : {w:60*L.w*(L.pageScale||1)/big, d:60*L.h*(L.pageScale||1)/big});
    const one = lv.length === 1, LH = one ? 0 : LEVEL_LABEL_H + 4;   // no floor name on a one-story plan
    // layouts: one row, or 2 x 2 for four floors, upright or a quarter turn either way; each floor's scale: one for all
    // redrawn floors; a listing's own drawing fills its space floor by floor (equal printed heights in the row)
    const layout = (ang, cols) => {
      const side = ang===90 || ang===270, sz = sz0.map(z=>side ? {w:z.d, d:z.w} : z), rows = Math.ceil(lv.length / cols);
      const grid = [...Array(rows)].map((_, r)=>lv.map((L, i)=>i).filter(i=>Math.floor(i/cols)===r));
      const availH = box.h - LH*rows - C_GAP*0.6*(rows-1);
      // one scale for every floor (owner 10/28), unless that leaves a floor too small to read or leaves blank space: then
      // that floor grows to fill its space. In a row, a floor under 85% of the row's height grows toward it, the floors
      // that need it sharing the row's spare width (1030 Chamboard's second floor beside its tall first floor).
      const colW0 = [...Array(cols)].map((_, c)=>Math.max(...grid.map(g=>g[c]!==undefined ? sz[g[c]].w : 0)));
      const rowD0 = grid.map(g=>Math.max(...g.map(i=>sz[i].d)));
      const s0 = Math.min(C_SMAX, (box.w - C_GAP*(cols-1))/colW0.reduce((a,b)=>a+b, 0), availH/rowD0.reduce((a,b)=>a+b, 0));
      const sc = sz.map(()=>s0), cap = C_SMAX * 1.5;
      if(rows === 1) for(let it = 0; it < 4; it++){
        const spare = box.w - C_GAP*(cols-1) - sz.reduce((a, z, i)=>a + z.w*sc[i], 0);
        const grow = sz.map((z, i)=>i).filter(i=>sz[i].d*sc[i] < 0.85*availH && sc[i] < cap);
        if(!grow.length || spare < 1) break;
        const want = grow.map(i=>Math.min(availH/sz[i].d, cap) - sc[i]), need = grow.reduce((a, i, k)=>a + want[k]*sz[i].w, 0);
        const f = Math.min(1, spare/need); grow.forEach((i, k)=>{ sc[i] += want[k]*f; });
      }
      const pw = sz.map((z, i)=>z.w*sc[i]), ph = sz.map((z, i)=>z.d*sc[i]);
      const colW = [...Array(cols)].map((_, c)=>Math.max(...grid.map(g=>g[c]!==undefined ? pw[g[c]] : 0)));
      const rowD = grid.map(g=>Math.max(...g.map(i=>ph[i])));
      const gridW = colW.reduce((a,b)=>a+b, 0) + C_GAP*(cols-1), gridH = rowD.reduce((a,b)=>a+b, 0) + LH*rows + C_GAP*0.6*(rows-1);
      return {ang, cols, rows, sz, sc, pw, ph, grid, colW, rowD, gridW, gridH, area: pw.reduce((a, w, i)=>a + w*ph[i], 0)};
    };
    // biggest wins (owner 10/28); a finished drawing never upside down. A near tie keeps the front door at the bottom or left.
    const front = (lv[0] && FRONT_OK[lv[0].front]) ? lv[0].front : 'bottom';
    const angs = opt.allowRotate === false ? [0] : [0, 90, 270];
    let A = null;
    for(const ang of angs) for(const cols of lv.length === 4 ? [4, 2] : [lv.length]){
      if(opt.angle !== undefined && ang !== opt.angle) continue;   // redraw in an orientation already chosen
      // a near tie: a listing's own drawing takes the turn that keeps its text readable (labels mostly up the page: a
      // quarter turn clockwise lays them flat; mostly across: counterclockwise, so its side labels read upward); a redrawn
      // plan keeps the front door at the bottom or left
      const tv = lv.filter(L=>L.textDir === 'v').length > lv.length / 2;
      // a listing's own drawing keeps the listing's direction so its text reads (owner 10/28: turn 1030 Chamboard back);
      // text printed up the page takes the quarter turn that lays it flat
      // ...unless a quarter turn prints it much larger (a third or more; the owner 10/28: Aston Pine, Beulah, Stanford came out
      // small upright): then it turns so its text reads up the page. Floors printed in both directions (Beulah: the first
      // floor across, the second up the page) turn clockwise instead, which leaves no label upside down.
      const mixed = lv.some(L=>L.textDir === 'v') && lv.some(L=>L.textDir !== 'v');
      if(img && ang !== (tv ? 90 : 0) && ang !== (tv ? 0 : mixed ? 90 : 270)) continue;
      const ok = img ? (a=>a === (tv ? 90 : 0)) : (a=>FRONT_OK[front].includes(a)), t = layout(ang, cols), pref = ok(ang);
      const better = !A ? true : img && pref !== ok(A.ang) ? (pref ? !(A.area > t.area * 1.3) : t.area > A.area * 1.3)
        : t.area > A.area * 1.03 || (t.area > A.area * 0.97 && pref && !ok(A.ang));
      if(better) A = t;
    }
    if(!A) A = layout(opt.angle !== undefined ? opt.angle : 0, lv.length);
    const {ang, grid, colW, rowD, sc, pw, ph, gridW, gridH} = A;
    // the detached garage's box: its size first, so the house and the box center together
    let G = null;
    if(det){
      const side = ang===90 || ang===270, s0 = Math.min(...sc), P = 8, IW = STRIP - 2*P, HEAD = 12, KW = 40, KH = 34;
      // its feet: from the read, else the house's feet per page pixel
      const fpp = lv[0] ? sz0[0].w / (lv[0].w*(lv[0].pageScale||1)) : 0.02;
      const gz = det.feet ? {w:det.feet.w, d:det.feet.d} : {w:det.w*(det.pageScale||1)*fpp, d:det.h*(det.pageScale||1)*fpp}, g = side ? {w:gz.d, d:gz.w} : gz;
      const cap = det.site ? wrap('Site key: the garage stands apart from the house, where the listing places it.', IW - KW - 8) : [];
      const keyH = det.site ? Math.max(KH, cap.length*LINE) : 0;
      const si = Math.min(s0, IW/g.w, Math.max(20, box.h - 2*P - HEAD - 6 - (keyH ? keyH + 10 : 0))/g.d);
      G = {side, P, IW, HEAD, KW, KH, cap, keyH, si, gw:g.w*si, gh:g.d*si, smaller: si < s0*0.98};
      G.h = 2*P + HEAD + 6 + G.gh + (keyH ? keyH + 10 : 0);
    }
    const allW = gridW + (G ? SG + STRIP : 0), allH = Math.max(gridH, G ? G.h : 0);
    const top = box.y + Math.max(0, (box.h - allH)/2);
    const x0 = box0.x + (box0.w - allW)/2, y0 = top + (allH - gridH)/2;
    let html = '';
    if(G){
      const {side, P, IW, HEAD, KW, KH, cap, keyH, si, gw, gh} = G, fx = x0 + gridW + SG, fy = top + (allH - G.h)/2;
      const uw = side ? gh : gw, uh = side ? gw : gh, ix = fx + P + (IW - gw)/2, iy = fy + P + HEAD + 6;
      const ppi = det.w / (uw / 72);
      if(ppi < 300) issues.push({slot:'plan.detached', kind:'plan-under-300ppi', ppi:Math.round(ppi)});
      html += `<div class="abs plan-detached" style="left:${fx.toFixed(2)}pt;top:${fy.toFixed(2)}pt;width:${STRIP}pt;height:${G.h.toFixed(2)}pt;box-sizing:border-box;border:.6pt solid color-mix(in srgb, var(--ink) 30%, transparent)"></div>`
            + `<div class="abs plan-level" style="left:${(fx + P).toFixed(2)}pt;top:${(fy + P).toFixed(2)}pt;width:${IW}pt;font-size:8pt;line-height:${HEAD}pt;letter-spacing:1.2pt;text-align:left" data-slot="plan.detached" data-lines="1">Detached garage</div>`
            + `<div class="abs plan-color" data-level="detached" style="left:${ix.toFixed(2)}pt;top:${iy.toFixed(2)}pt;width:${gw.toFixed(2)}pt;height:${gh.toFixed(2)}pt">`
            + `<div style="position:absolute;left:0;top:0;width:${uw.toFixed(2)}pt;height:${uh.toFixed(2)}pt${turnCSS(ang, gw, gh)}">` + innerOf(det, uw, uh, si) + `</div></div>`;
      if(keyH){
        // the key turns with the plan, so it matches the house as printed
        const S = det.site, ux = Math.min(S.house[0], S.garage[0]), uy = Math.min(S.house[1], S.garage[1]);
        const UW = Math.max(S.house[0] + S.house[2], S.garage[0] + S.garage[2]) - ux, UH = Math.max(S.house[1] + S.house[3], S.garage[1] + S.garage[3]) - uy;
        const TW = side ? UH : UW, TH = side ? UW : UH, k = Math.min(KW/TW, KH/TH);
        const R = ([x, y, w, h], fill)=>{ const a = turnPt(ang, x - ux, y - uy, UW, UH), b = turnPt(ang, x - ux + w, y - uy + h, UW, UH);
          return `<rect x="${(Math.min(a[0], b[0])*k + 0.4).toFixed(2)}" y="${(Math.min(a[1], b[1])*k + 0.4).toFixed(2)}" width="${(Math.abs(a[0] - b[0])*k - 0.8).toFixed(2)}" height="${(Math.abs(a[1] - b[1])*k - 0.8).toFixed(2)}" fill="${fill}" stroke="var(--ink)" stroke-width=".8"/>`; };
        const ky = iy + gh + 10, kw = TW*k, kh = TH*k;
        html += `<svg class="abs" style="left:${(fx + P + (KW - kw)/2).toFixed(2)}pt;top:${(ky + (keyH - kh)/2).toFixed(2)}pt;width:${kw.toFixed(2)}pt;height:${kh.toFixed(2)}pt;overflow:visible" viewBox="0 0 ${kw.toFixed(2)} ${kh.toFixed(2)}" aria-hidden="true">`
              + R(S.house, TINT.living) + R(S.garage, 'var(--paper)') + `</svg>`
              + `<div class="abs" style="left:${(fx + P + KW + 8).toFixed(2)}pt;top:${(ky + (keyH - cap.length*LINE)/2).toFixed(2)}pt;width:${IW - KW - 8}pt;height:${(cap.length*LINE).toFixed(2)}pt;font:400 8pt/${LINE}pt var(--font-body);color:var(--ink);white-space:normal" data-slot="plan.detached.key" data-lines="${cap.length}">${cap.map(Ivory.esc).join(' ')}</div>`;
      }
    }
    const placed = [];   // labels set so far (page pt): none may overlap another
    grid.forEach((g, r)=>g.forEach((i, c)=>{
      const L = lv[i], w = pw[i], h = ph[i], s = sc[i];
      const side = ang===90 || ang===270, uw = side ? h : w, uh = side ? w : h;   // the floor upright
      const ppi = L.w / (uw / 72);
      if(ppi < 300) issues.push({slot:`plan.${i}`, kind:'plan-under-300ppi', ppi:Math.round(ppi)});
      const cx = x0 + colW.slice(0, c).reduce((a,b)=>a+b, 0) + C_GAP*c + (colW[c] - w)/2;
      const cy = y0 + rowD.slice(0, r).reduce((a,b)=>a+b, 0) + (LH + C_GAP*0.6)*r + (rowD[r] - h)/2;
      const inner = innerOf(L, uw, uh, s);
      html += `<div class="abs plan-color" data-level="${i}" style="left:${cx.toFixed(2)}pt;top:${cy.toFixed(2)}pt;width:${w.toFixed(2)}pt;height:${h.toFixed(2)}pt">`
            + `<div style="position:absolute;left:0;top:0;width:${uw.toFixed(2)}pt;height:${uh.toFixed(2)}pt${turnCSS(ang, w, h)}">` + inner + `</div></div>`;
      (L.labels||[]).forEach((l, j)=>{
        // the room's clear spots as placed, in pt from the floor's corner (labels stay upright)
        const asPlaced = c=>(c||[]).map(q=>{ const [px, py] = turnPt(ang, q.x*uw, q.y*uh, uw, uh);
          return {x:px, y:py, r:q.p.map(([hh, hw])=>side ? [hw*uw, hh*uh] : [hh*uh, hw*uw])}; });
        const spots = asPlaced(l.c), rc = (()=>{ const [qx, qy] = turnPt(ang, l.x*uw, l.y*uh, uw, uh); return {x:qx, y:qy, f:s, m:Math.min(l.w*uw, l.h*uh)}; })();
        // (with room for the patch a tight label sits on and for the width estimate's slack)
        const clash = (x, y, tw, th)=>placed.some(q=>Math.abs(cx + x - q.x) < (tw + q.w)/2 + 3 && Math.abs(cy + y - q.y) < (th + q.h)/2 + 1.5);
        let f = colorFit(l, spots, rc, clash);
        // nothing clear off the door swings: inside a swing's open quarter (never on its lines)
        if((!f || f.tight) && (l.c2||[]).length){ const f2 = colorFit(l, asPlaced(l.c2), rc, clash); if(f2 && !f2.tight) f = f2; }
        if(!f){ issues.push({slot:`plan.${i}.${l.name}`, kind:'plan-label-no-spot', detail:'no clear spot at all; flag for review'}); return; }
        // a room with no clear spot for a 6 pt label off its fixtures and door swings is left unlabeled (owner 10/28: rule 4
        // wins over never leaving a room unlabeled); a hidden marker lets the before-and-after check tell this from a loss
        if(f.tight){ issues.push({slot:`plan.${i}.${l.name}`, kind:'plan-label-left-off', detail:'no clear spot for a 6 pt label'});
          html += `<div class="plan-room-off" style="display:none" data-room="${i}.${j}" data-name="${Ivory.esc(l.name)}"></div>`; return; }
        const lx = cx + f.s.x, ly = cy + f.s.y, z = f.z, lh = z*LINE_K;
        placed.push({x: lx, y: ly, w: f.tw, h: f.th});
        // the clear box the label sits in (the print check holds it there: no line under the text)
        const cr = f.tight ? [f.th/2, f.tw/2] : f.snug ? f.s.r.filter(([hh, hw])=>f.tw <= 2*hw && hh >= f.th/2).sort((p, q)=>p[0]*p[1] - q[0]*q[1])[0] : f.s.r.filter(([hh, hw])=>fitsClear(hh, hw, f.tw, f.th, f.t.map(q=>q[0]).join('').length <= 3)).sort((p, q)=>p[0]*p[1] - q[0]*q[1])[0];
        // over a ceiling grid line: a patch of the room's own color under the text, so no line runs through it
        // over a ceiling grid line, or set tight in a small room on a large plan: a patch of the room's own color under the
        // text, so no line runs through it (a tight label is reported)
        const knock = (l.knock || f.tight) ? `;background:${TINT[l.tint] || TINT[l.zone] || 'var(--paper)'};padding:0 1pt;margin-left:-1pt` : '';
        const st = `font-size:${z}pt;line-height:${lh.toFixed(2)}pt`;
        html += `<div class="abs plan-room" style="left:${(lx - f.tw/2 - 0.5).toFixed(2)}pt;top:${(ly - f.th/2).toFixed(2)}pt;width:${(f.tw + 1).toFixed(2)}pt;${st}${knock}" data-room="${i}.${j}" data-min="6" data-name="${Ivory.esc(l.name)}"${l.swing ? ' data-swing="1"' : ''} data-c="${(()=>{ const [qx, qy] = turnPt(ang, l.x*uw, l.y*uh, uw, uh); return (cx + qx).toFixed(2) + "," + (cy + qy).toFixed(2); })()}"`
              + ` data-box="${(lx - cr[1]).toFixed(2)},${(ly - cr[0]).toFixed(2)},${(2*cr[1]).toFixed(2)},${(2*cr[0]).toFixed(2)}">`
              + f.t.map(([t, b])=>b === 2 ? `<span style="${st};display:block"><b style="${st};display:inline">${Ivory.esc(t.split('\u2002')[0])}</b>\u2002<span style="${st};display:inline">${Ivory.esc(t.split('\u2002')[1])}</span></span>`
                : b ? `<b style="${st}">${Ivory.esc(t)}</b>` : `<span style="${st}">${Ivory.esc(t)}</span>`).join('') + `</div>`;
      });
      if(!one) html += `<div class="abs plan-level" style="left:${(cx-30).toFixed(2)}pt;top:${(cy + h + 5).toFixed(2)}pt;width:${(w+60).toFixed(2)}pt" data-slot="plan.level${i}" data-lines="1">${Ivory.esc(L.name)}</div>`;
    }));
    const frontNow = {0:front, 90:{bottom:'left', right:'bottom'}[front], 180:{top:'bottom', right:'left'}[front], 270:{left:'bottom', top:'left'}[front]}[ang];
    // (floors at different scales, a floor grown to fill its space: said under the plan so no one reads sizes across floors)
    return {html, issues, scale:Math.min(...sc), mixedScale: Math.max(...sc) > 1.1 * Math.min(...sc), usedW:allW, usedH:allH, rotated:ang!==0, angle:ang, front:frontNow || '', insets:0, levels:lv.length,
            detached: G ? 1 : 0, detachedSmaller: !!(G && G.smaller)};
  }
  const drawAny = (plan, box, opt) => plan && plan.kind === 'color' ? drawColor(plan, box, opt) : draw(plan, box, opt);
  const zonesOf = plan => plan && plan.kind === 'color' ? [...new Set(plan.levels.flatMap(L=>Object.keys(L.layers||{}).filter(k=>k in ZONES)))]
    : [...new Set(plan.levels.flatMap(l=>l.rooms.map(zoneOf)))];

  window.IvoryPlan = {draw: drawAny, check, bbox, ZONES, zoneOf, zonesOf};
})();
