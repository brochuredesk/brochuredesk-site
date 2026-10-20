/* Floor plan drawing for Ivory (template readiness standard, sections 1 and 8).

   Input: data.plan, measured in feet, origin at the top-left of each level, the street at the bottom.
     { source: 'Redrawn from the listing floor plan',
       levels: [ { name:'First floor', living:true, inset:false,
                   rooms:[ {name:'Living', short:'Living', x:0, y:0, w:18, d:16, dims:'18 x 16',
                            kind:'room'|'wet'|'closet'|'outdoor'|'garage'|'open', minor:false,
                            crop:{side:'right', to:30}} ],
                   stairs:{x, y, w, d} } ],
       insets: [ { name:'Garage apartment', rooms:[...] } ] }

   Rules it enforces:
   - every full level drawn at the same scale, labeled by floor; 1-3 levels side by side, 4 levels in a 2 x 2 grid,
     ground floor first; interior stairs aligned (no interior stairs: footprints aligned at the top)
   - room labels 8 pt; a label that won't fit at 8 pt is reported, never shrunk
     (closets, baths and utility rooms marked minor may go unlabeled, the way printed plans do)
   - oversized outdoor areas are cut with a clean break and keep their real dimensions
   - when labels won't fit, levels marked living:false become small insets "drawn smaller" so the living level
     gets the larger spot (raised coastal homes); garage apartments are always insets
   - plans turn on their side when that draws them noticeably larger (tall, narrow townhomes in a 2 x 2 grid)
*/
(function(){
  const PT = 72/96;
  const LABEL = 8, LINE = 9.5;          // room label size and line step, pt
  const LEVEL_LABEL_H = 15;             // level name under each drawing
  const GAP = 20;                       // space between levels, pt
  const S_MAX = 9;                      // never draw bigger than 9 pt per foot (1/8 inch = 1 ft)

  // Text width estimate for layout (conservative). The print check measures the real text afterwards.
  const charW = { '600':0.585, '400':0.54 };
  const est = (s, wt) => String(s||'').length * LABEL * (charW[wt]||0.58);

  const dimsOf = r => r.dims || `${Math.round(r.w)} x ${Math.round(r.d)}`;
  const isIndoor = r => r.kind !== 'outdoor';

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
    return Object.assign({}, L, {rooms: L.rooms.map(rot), stairs: rot(L.stairs)});
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
    const dims = r.crop ? `${dimsOf(r)}` : dimsOf(r);
    const tries = [[r.name, dims], [r.short, dims], [r.name], [r.short]].filter(t=>t[0]);
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
    R.forEach(({r,e}, j)=>{
      const t = labelFor(r, s); if(!t) return;
      const cx = ox + (e.x + e.w/2)*s, cy = oy + (e.y + e.d/2)*s, h = t.length*LINE;
      const w = e.w*s;
      labels += `<div class="abs plan-room" style="left:${(cx - w/2).toFixed(2)}pt;top:${(cy - h/2).toFixed(2)}pt;width:${w.toFixed(2)}pt" data-room="${key}.${j}" data-box="${(ox+e.x*s).toFixed(2)},${(oy+e.y*s).toFixed(2)},${(e.w*s).toFixed(2)},${(e.d*s).toFixed(2)}">`
        + `<b>${Ivory.esc(t[0])}</b>${t[1] ? `<span>${Ivory.esc(t[1])}</span>` : ''}</div>`;
    });
    return {svg: `<g>${walls}${fills}${lines}${extra}</g>`, labels};
  }

  // Print check: every room label sits inside its room at 8 pt or more.
  function check(){
    const out = [];
    document.querySelectorAll('.plan-room').forEach(el=>{
      const [x,y,w,h] = el.dataset.box.split(',').map(Number);
      const p = el.closest('.panel').getBoundingClientRect();
      [...el.children].forEach(c=>{
        const r = c.getBoundingClientRect();
        const l = (r.left - p.left)*PT, t = (r.top - p.top)*PT, rr = l + r.width*PT, bb = t + r.height*PT;
        const size = parseFloat(getComputedStyle(c).fontSize)*PT;
        if(size < 8) out.push({slot:'plan.room '+el.textContent, kind:'type-too-small', size:+size.toFixed(1)});
        if(l < x-0.5 || rr > x+w+0.5 || t < y-0.5 || bb > y+h+0.5) out.push({slot:'plan.room '+c.textContent, kind:'plan-label-outside-room'});
      });
    });
    return out;
  }

  window.IvoryPlan = {draw, check, bbox};
})();
