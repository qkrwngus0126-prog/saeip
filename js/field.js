/* 네잎클로버 들판.
   clover-portfolio의 들판을 옮겨 와서, 화면보다 몇 배 넓은 들판을 둘러볼 수 있게 키웠습니다.
   화면에는 들판의 한 부분만 보이고, 끌거나 스크롤해서(휴대폰은 두 손가락으로) 다른 곳으로 옮겨 다닙니다.

   const field = CloverField(document.getElementById('field'), {
     width, height     // 들판 전체 크기 (px)
     onPick(clover)    // 찾은 세잎을 눌렀을 때
     onShow(clover)    // 지금 이름표가 떠 있는 세잎이 바뀔 때 (없으면 null)
     onFound(n, all)   // 세잎을 하나 찾을 때마다
   });
   field.set([{ key, kind: 'happy' | 'empty', fx, fy, mine, text }])   // fx, fy는 들판 전체 안의 0~1 좌표
   field.update(key, patch) / field.remove(key) / field.reveal(key, done) / field.hint() */
(function () {
  window.CloverField = function (field, opts) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = field.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    // white clover greens: front, slightly yellow, and a cooler one
    const GREENS = ['#4f7f45', '#5c8a48', '#44713f'];
    // a found clover lights up: a written one sunlit, an empty one pale, like a page not yet written on
    const LIT = { happy: ['#6a9a54', '#74a35a', '#6c9a58'], empty: ['#a3bf8e', '#acc697', '#9fbb8c'] };
    const TIERS = [0.66, 0.86, 1.0];      // back, middle, front layer brightness
    const ROTS = 6;                       // rotations baked into each sprite so light and shadow stay put
    const SPRITE = 96;
    const HIDDEN_Z = 0.3;
    const TIER_RES = [0.68, 0.64, 0.72];  // sprites are rendered at the largest size each layer is drawn
    const S_STEP = 0.05;                  // leaf sizes come in steps of this, each with a ready-made picture

    // the whole meadow, in CSS pixels; the canvas is a window onto part of it
    let WW = opts.width || 3600, WH = opts.height || 2400; // the meadow can grow later (setWorld)
    const CELL = 96;                      // spatial grid, so only leaves near the hand or the view are touched
    const TILE = 512;                     // the soil repeats in tiles this size
    let VW = 0, VH = 0, dpr = 1, items = [], hidden = [], grid = [], gcols = 0, grows = 0, soilTile = null;
    let cloverSprites = [], grassSprites = [], threeSprites = [], litSprites = { happy: [], empty: [] };
    let raf = 0, shownNow = null;
    const cam = { x: 0, y: 0 };
    let camAnim = null;
    // the hand (x, y) glides after where the finger or cursor really is (tx, ty), so digging feels smooth even when input events are uneven
    const pointer = { x: -999, y: -999, tx: -999, ty: -999, sx: -999, sy: -999, active: false, vx: 0, vy: 0 };
    const moving = new Set();             // leaves still swinging; everything else is at rest and costs nothing

    // one label for the whole field: the lit clover nearest the hand
    const tag = document.createElement('span');
    tag.className = 'find-tag is-hidden';
    tag.setAttribute('aria-hidden', 'true');
    field.appendChild(tag);

    // a small map of the whole meadow: where you are, and the clovers you have found
    const mini = document.createElement('canvas');
    mini.className = 'minimap';
    mini.setAttribute('aria-hidden', 'true'); // a pointer shortcut; the arrow keys and the hint button do the same
    field.appendChild(mini);
    const mctx = mini.getContext('2d');

    function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    function shade(col, k) {
      const [r, g, b] = Array.isArray(col) ? col : rgb(col);
      const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
      return `rgb(${f(r)},${f(g)},${f(b)})`;
    }
    function jitterColor(hex) {
      const [r, g, b] = rgb(hex), j = () => (Math.random() - 0.5) * 14;
      return [r + j(), g + j(), b + j() * 0.6];
    }
    function sheet(res) {
      const s = document.createElement('canvas');
      s.width = s.height = Math.round(SPRITE * res * dpr);
      const c = ctx2d(s);
      c.scale(res * dpr, res * dpr); c.translate(SPRITE / 2, SPRITE / 2);
      return [s, c];
    }

    // one obovate leaflet with a shallow notch at the tip, base at the origin, pointing up
    function leaflet(c, L, w, col) {
      const p = new Path2D();
      p.moveTo(0, 0);
      p.bezierCurveTo(-0.2 * L * w, -0.1 * L, -0.58 * L * w, -0.4 * L, -0.5 * L * w, -0.73 * L);
      p.bezierCurveTo(-0.44 * L * w, -0.99 * L, -0.13 * L * w, -1.04 * L, 0, -0.88 * L);
      p.bezierCurveTo(0.13 * L * w, -1.04 * L, 0.44 * L * w, -0.99 * L, 0.5 * L * w, -0.73 * L);
      p.bezierCurveTo(0.58 * L * w, -0.4 * L, 0.2 * L * w, -0.1 * L, 0, 0);
      const g = c.createLinearGradient(0, 0, 0, -L);
      g.addColorStop(0, shade(col, 0.5));
      g.addColorStop(0.4, shade(col, 0.92));
      g.addColorStop(1, shade(col, 1.12));
      c.fillStyle = g; c.fill(p);
      c.save(); c.clip(p);
      // the pale crescent white clover carries on every leaflet
      c.strokeStyle = `rgba(224,238,206,${0.12 + Math.random() * 0.12})`; c.lineWidth = L * (0.07 + Math.random() * 0.05); c.lineCap = 'round';
      c.beginPath(); c.moveTo(-0.44 * L * w, -0.64 * L); c.quadraticCurveTo(0, -0.28 * L, 0.44 * L * w, -0.64 * L); c.stroke();
      // side veins
      c.strokeStyle = 'rgba(12,30,10,0.2)'; c.lineWidth = 0.55;
      for (let i = 1; i <= 5; i++) {
        const y = -L * (0.12 + i * 0.13);
        c.beginPath();
        c.moveTo(0, y); c.quadraticCurveTo(-0.22 * L * w, y - 0.04 * L, -0.56 * L * w, y - 0.14 * L);
        c.moveTo(0, y); c.quadraticCurveTo(0.22 * L * w, y - 0.04 * L, 0.56 * L * w, y - 0.14 * L);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = 'rgba(14,34,12,0.4)'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(0, -0.04 * L); c.lineTo(0, -0.86 * L); c.stroke();
      c.strokeStyle = 'rgba(236,246,222,0.12)'; c.lineWidth = 0.7; c.stroke(p);
    }

    // light from the top left, shadow cast down and to the right, the same for every sprite
    function finish(src, tier, res) {
      const S = src.width, c = ctx2d(src);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      const g = c.createLinearGradient(S * 0.15, S * 0.15, S * 0.85, S * 0.85);
      g.addColorStop(0, 'rgba(255,250,215,0.16)');
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.3)');
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      if (tier < 1) { c.fillStyle = `rgba(8,16,10,${1 - tier})`; c.fillRect(0, 0, S, S); }
      c.globalCompositeOperation = 'source-over';
      const out = document.createElement('canvas');
      out.width = out.height = S;
      const o = ctx2d(out);
      o.shadowColor = 'rgba(0,0,0,0.6)'; o.shadowBlur = 6 * dpr * res; o.shadowOffsetX = 2 * dpr * res; o.shadowOffsetY = 4 * dpr * res;
      o.drawImage(src, 0, 0);
      return out;
    }

    function makeClover(n, base, rot, tier, res) {
      const [s, c] = sheet(res);
      const L = SPRITE * 0.29;
      const col = jitterColor(base);
      c.strokeStyle = shade(col, 0.72); c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.3, L * 0.6, L * 0.12, L * 1.25); c.stroke();
      c.rotate(rot);
      for (let i = 0; i < n; i++) {
        c.save();
        c.rotate((Math.PI * 2 / n) * i + (Math.random() - 0.5) * 0.28);
        const fore = 0.74 + Math.random() * 0.26; // a leaflet tilted away looks shorter
        c.scale(0.96 + Math.random() * 0.08, fore);
        leaflet(c, L, 0.9 + Math.random() * 0.15, jitterColor(base));
        c.restore();
      }
      c.fillStyle = shade(col, 0.42);
      c.beginPath(); c.arc(0, 0, 1.6, 0, Math.PI * 2); c.fill();
      return finish(s, tier, res);
    }

    function makeTuft(tier) {
      const [s, c] = sheet(0.8);
      const blades = 3 + (Math.random() * 3 | 0);
      for (let i = 0; i < blades; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
        const len = SPRITE * (0.28 + Math.random() * 0.16);
        const bx = (Math.random() - 0.5) * 8, by = SPRITE * 0.14;
        const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
        const bend = (Math.random() - 0.5) * 18;
        const col = jitterColor(GREENS[(Math.random() * GREENS.length) | 0]);
        const g = c.createLinearGradient(bx, by, tx, ty);
        g.addColorStop(0, shade(col, 0.45)); g.addColorStop(1, shade(col, 1.15));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(bx - 1.6, by);
        c.quadraticCurveTo((bx + tx) / 2 + bend - 1, (by + ty) / 2, tx, ty);
        c.quadraticCurveTo((bx + tx) / 2 + bend + 1, (by + ty) / 2, bx + 1.6, by);
        c.fill();
      }
      return finish(s, tier, 0.8);
    }

    function buildSprites() {
      const r = k => (Math.PI * 2 / ROTS) * k;
      cloverSprites = TIERS.map((t, ti) => GREENS.flatMap(g => Array.from({ length: ROTS }, (_, k) => makeClover(4, g, r(k), t, TIER_RES[ti]))));
      grassSprites = TIERS.map(t => Array.from({ length: 3 }, () => makeTuft(t)));
      // the hidden three-leaf clovers share one sprite per rotation, plain and lit, however many there are
      threeSprites = Array.from({ length: ROTS }, (_, k) => makeClover(3, GREENS[k % GREENS.length], r(k), 0.86, 0.64));
      litSprites = {
        happy: Array.from({ length: ROTS }, (_, k) => makeClover(3, LIT.happy[k % 3], r(k), 1.0, 0.64)),
        empty: Array.from({ length: ROTS }, (_, k) => makeClover(3, LIT.empty[k % 3], r(k), 1.0, 0.64)),
      };
    }

    // one soil tile, repeated across the meadow; anything near an edge is drawn on the far side too, so tiles meet without a seam
    function buildSoil() {
      soilTile = document.createElement('canvas');
      soilTile.width = soilTile.height = Math.round(TILE * dpr);
      const c = ctx2d(soilTile);
      c.fillStyle = '#0e1410'; c.fillRect(0, 0, soilTile.width, soilTile.height);
      c.scale(dpr, dpr);
      const around = fn => { for (const dx of [-TILE, 0, TILE]) for (const dy of [-TILE, 0, TILE]) fn(dx, dy); };
      const dots = Math.round(TILE * TILE / 60);
      for (let i = 0; i < dots; i++) {
        const a = Math.random() * 0.12 + 0.03;
        c.fillStyle = Math.random() < 0.65 ? `rgba(110,86,60,${a})` : `rgba(60,90,55,${a})`;
        const r = Math.random() * 1.6 + 0.4, x = Math.random() * TILE, y = Math.random() * TILE;
        c.fillRect(x, y, r, r);
      }
      // leaf litter and runners: what you see when you dig down to the ground
      const litter = Math.round(TILE * TILE / 700);
      for (let i = 0; i < litter; i++) {
        const x = Math.random() * TILE, y = Math.random() * TILE, rot = Math.random() * Math.PI * 2;
        const leaf = Math.random() < 0.55;
        const l = leaf ? 3 + Math.random() * 5 : 10 + Math.random() * 18, bend = (Math.random() - 0.5) * 8, w = 0.8 + Math.random() * 0.8;
        const col = leaf
          ? `rgba(${70 + Math.random() * 40},${60 + Math.random() * 30},${35 + Math.random() * 15},${0.35 + Math.random() * 0.3})`
          : `rgba(${45 + Math.random() * 25},${70 + Math.random() * 30},${40 + Math.random() * 15},0.5)`;
        around((dx, dy) => {
          c.save(); c.translate(x + dx, y + dy); c.rotate(rot);
          if (leaf) { c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, l, l * 0.55, 0, 0, Math.PI * 2); c.fill(); }
          else { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(-l / 2, 0); c.quadraticCurveTo(0, bend, l / 2, 0); c.stroke(); }
          c.restore();
        });
      }
    }

    function leafAt(x, y, z, tier, grass, s) {
      s = Math.round(s / S_STEP) * S_STEP; // a handful of sizes, so each has a ready-made picture (see sized)
      return { hx: x, hy: y, rx: 0, ry: 0, ox: 0, oy: 0, vx: 0, vy: 0, rot: 0, z, tier, grass, s, order: 0,
        v: grass ? (Math.random() * 3) | 0 : (Math.random() * GREENS.length * ROTS) | 0,
        // a few leaves carry something of the season: a fallen leaf, a petal, snow or a drop of dew
        deco: Math.random(), dv: (Math.random() * 4) | 0, da: Math.random() * Math.PI * 2, dd: 0.25 + Math.random() * 0.45 };
    }
    function buildItems() {
      items = [];
      moving.clear();
      const step = 18.3; // about 20% more leaves than a 20px grid
      for (let y = -step; y < WH + step; y += step * 0.86) {
        for (let x = -step; x < WW + step; x += step) {
          const z = Math.random();
          const tier = z < 0.33 ? 0 : z < 0.66 ? 1 : 2;
          const grass = Math.random() < 0.16;
          // the bottom layer is drawn larger so no bare soil shows until you dig
          const s = (grass ? 0.5 : 0.44) + z * 0.2 + Math.random() * 0.06 + (tier === 0 && !grass ? 0.1 : 0);
          items.push(leafAt(x + (Math.random() - 0.5) * step * 0.95, y + (Math.random() - 0.5) * step * 0.95, z, tier, grass, s));
        }
      }
    }
    // make sure every hidden clover starts properly buried under a few nearer leaves
    function bury(list) {
      for (const h of list) {
        for (let k = 0; k < 4; k++) {
          const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 8;
          items.push(leafAt(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 0.7 + Math.random() * 0.3, 2, false, 0.6 + Math.random() * 0.08));
        }
      }
    }
    // back to front, so nearer leaves overlap farther ones; then file every leaf in the grid cell of its home
    function index() {
      items.sort((a, b) => a.z - b.z);
      gcols = Math.ceil(WW / CELL) + 3; grows = Math.ceil(WH / CELL) + 3;
      grid = Array.from({ length: gcols * grows }, () => []);
      items.forEach((c, i) => { c.order = i; grid[cellY(c.hy) * gcols + cellX(c.hx)].push(c); });
    }
    const cellX = x => Math.max(0, Math.min(gcols - 1, Math.floor(x / CELL) + 1));
    const cellY = y => Math.max(0, Math.min(grows - 1, Math.floor(y / CELL) + 1));
    function near(x0, y0, x1, y1) {
      const out = [];
      for (let gy = cellY(y0), gy1 = cellY(y1); gy <= gy1; gy++)
        for (let gx = cellX(x0), gx1 = cellX(x1); gx <= gx1; gx++)
          for (const c of grid[gy * gcols + gx]) out.push(c);
      return out;
    }

    function makeHidden(c) {
      return {
        key: c.key, kind: c.kind, mine: !!c.mine, text: c.text || '', photo: c.photo || null, fx: c.fx, fy: c.fy, x: c.fx * WW, y: c.fy * WH,
        rk: (Math.random() * ROTS) | 0, s: 0.6, found: false, t: 0, seen: 0, lit: false,
      };
    }

    /* ---------- the camera: which part of the meadow is on screen ---------- */
    let camMoved = false;
    function clampCam() {
      cam.x = VW >= WW ? (WW - VW) / 2 : Math.max(0, Math.min(WW - VW, cam.x));
      cam.y = VH >= WH ? (WH - VH) / 2 : Math.max(0, Math.min(WH - VH, cam.y));
      // whole device pixels, so the picture tiles and fresh paint line up exactly
      cam.x = Math.round(cam.x * dpr) / dpr; cam.y = Math.round(cam.y * dpr) / dpr;
    }
    function moveCam(x, y) {
      const ox = cam.x, oy = cam.y;
      cam.x = x; cam.y = y; clampCam();
      if (cam.x === ox && cam.y === oy) return;
      if (!sweeping) { pointer.x = pointer.tx = pointer.sx + cam.x; pointer.y = pointer.ty = pointer.sy + cam.y; }
      full = true; camMoved = true;
      if (shownNow) placeTag(shownNow);
      wake();
    }
    // glide so that a point of the meadow ends up in the middle of the screen
    function flyTo(x, y, done) {
      const tx = x - VW / 2, ty = y - VH / 2;
      const fx = cam.x, fy = cam.y;
      cam.x = tx; cam.y = ty; clampCam();
      const ex = cam.x, ey = cam.y;
      cam.x = fx; cam.y = fy;
      const far = Math.hypot(ex - fx, ey - fy);
      if (reduce || far < 2) { moveCam(ex, ey); if (done) done(); return; }
      camAnim = { fx, fy, ex, ey, t0: performance.now(), dur: Math.min(1100, 380 + far * 0.35), done };
      wake();
    }
    const inView = (x, y, m) => x > cam.x + m && x < cam.x + VW - m && y > cam.y + m && y < cam.y + VH - m;

    function resize() {
      const r = field.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.width === VW && r.height === VH) return;
      const first = !VW;
      const midX = cam.x + VW / 2, midY = cam.y + VH / 2; // keep the same spot in the middle
      VW = r.width; VH = r.height;
      // 1.5x is sharp enough for leaves and paints far fewer pixels each frame than 2x or 3x
      const nd = Math.min(window.devicePixelRatio || 1, 1.5);
      const rebuild = !cloverSprites.length || nd !== dpr;
      dpr = nd;
      canvas.width = Math.round(VW * dpr); canvas.height = Math.round(VH * dpr);
      if (rebuild) { buildSprites(); buildSoil(); chunks.clear(); blossoms = {}; sizedCache = new Map(); if (airKey) { const [p, se, w] = airKey.split(','); airKey = ''; api.setAtmosphere({ phase: p, season: se, weather: w }); } }
      chunkMax = Math.max(24, Math.ceil(VW / CHUNK + 2) * Math.ceil(VH / CHUNK + 2) * 2);
      if (!items.length) { buildItems(); bury(hidden); index(); }
      if (first) { cam.x = (WW - VW) / 2; cam.y = (WH - VH) / 2; }
      else { cam.x = midX - VW / 2; cam.y = midY - VH / 2; }
      clampCam();
      sizeMini();
      full = true; draw();
      if (shownNow) placeTag(shownNow);
      return first;
    }

    const R = 84; // how far a fingertip parts the leaves

    // is the hidden clover in the open? test its centre and its three leaflets against nearer leaves only
    function exposed(h) {
      const L = SPRITE * h.s * 0.29;
      const pts = [[h.x, h.y]];
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 / ROTS) * h.rk + (Math.PI * 2 / 3) * i - Math.PI / 2;
        pts.push([h.x + Math.cos(a) * L * 0.55, h.y + Math.sin(a) * L * 0.55]);
      }
      const list = near(h.x - R - 60, h.y - R - 60, h.x + R + 60, h.y + R + 60);
      let open = 0;
      for (const [x, y] of pts) {
        let covered = false;
        for (const c of list) {
          if (c.z < HIDDEN_Z) continue;
          const r = SPRITE * c.s * 0.25, dx = c.hx + c.ox - x, dy = c.hy + c.oy - y;
          if (dx * dx + dy * dy < r * r) { covered = true; break; }
        }
        if (!covered) open++;
      }
      return open >= 3;
    }

    let last = 0;
    function step(now) {
      // physics runs on real time, so slow devices close the field just as quickly
      const k = Math.min(3, last ? (now - last) / 16.67 : 1);
      last = now;
      let energy = 0;
      const p = pointer;
      if (p.active && !sweeping) {
        const f = 1 - Math.pow(0.45, k), nx = p.x + (p.tx - p.x) * f, ny = p.y + (p.ty - p.y) * f;
        p.vx = (nx - p.x) * 0.9; p.vy = (ny - p.y) * 0.9;
        p.x = nx; p.y = ny;
        if (Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) > 0.3) energy += 1;
      }
      // only leaves under the hand join in; the rest of the meadow sleeps
      if (p.active) {
        for (const c of near(p.x - R - 90, p.y - R - 90, p.x + R + 90, p.y + R + 90)) {
          const dx = c.hx + c.rx - p.x, dy = c.hy + c.ry - p.y;
          if (dx * dx + dy * dy < R * R) moving.add(c);
        }
      }
      for (const c of moving) {
        let tx = c.rx, ty = c.ry;
        if (p.active) {
          const bx = c.hx + c.rx, by = c.hy + c.ry;
          const dx = bx - p.x, dy = by - p.y, d = Math.hypot(dx, dy) || 0.01;
          if (d < R) {
            const f = 1 - d / R;
            // upper leaves part fully, the lower ones only lean, so a dug hole still shows layers
            const push = R * f * (0.3 + c.z * 0.75);
            tx += dx / d * push + p.vx * f * 0.6;
            ty += dy / d * push + p.vy * f * 0.6;
            // leaves that were dug through lag a moment before they settle back
            c.rx += (tx - c.rx) * 0.03 * f * k;
            c.ry += (ty - c.ry) * 0.03 * f * k;
          }
        }
        c.vx += (tx - c.ox) * 0.075 * k; c.vy += (ty - c.oy) * 0.075 * k;
        const damp = Math.pow(0.78, k);
        c.vx *= damp; c.vy *= damp;
        mark(c.hx + c.ox, c.hy + c.oy, reach(c));
        c.ox += c.vx * k; c.oy += c.vy * k;
        mark(c.hx + c.ox, c.hy + c.oy, reach(c));
        const settle = Math.pow(0.965, k);
        c.rx *= settle; c.ry *= settle;
        c.rot = 0; // leaves slide aside without turning; turning made every frame much slower to paint
        const e = Math.abs(c.vx) + Math.abs(c.vy) + Math.abs(c.rx) * 0.05;
        if (e < 0.01 && Math.abs(c.ox) + Math.abs(c.oy) < 0.05 && Math.abs(c.rx) + Math.abs(c.ry) < 0.05) {
          c.ox = c.oy = c.vx = c.vy = c.rx = c.ry = c.rot = 0;
          moving.delete(c);
        } else energy += e;
      }
      for (const h of hidden) {
        const near_ = p.active && Math.abs(p.x - h.x) < R * 1.2 && Math.abs(p.y - h.y) < R * 1.2 && Math.hypot(p.x - h.x, p.y - h.y) < R * 1.2;
        // a found clover far from the hand only needs checking while it is still lit
        const open = near_ || (h.found && h.lit) ? exposed(h) : false;
        if (open) h.seen = Math.max(h.seen, now);
        if (!h.found && open && p.active) find(h);
        if (h.found) {
          if (h.t < 0.999) { h.t += (1 - h.t) * 0.09; energy += 1; mark(h.x, h.y, SPRITE * h.s * 0.7); }
          // a found clover is lit while it is in the open, with a short grace period
          const lit = now - h.seen < 260;
          if (lit !== h.lit) { h.lit = lit; mark(h.x, h.y, SPRITE * h.s * 0.7); }
          if (lit) energy += 1;
        }
      }
      // only one label at a time: the lit clover nearest the hand
      let best = null, bestD = Infinity;
      for (const h of hidden) {
        if (!h.lit) continue;
        const d = p.active ? Math.hypot(p.x - h.x, p.y - h.y) : now - h.seen;
        if (d < bestD) { bestD = d; best = h; }
      }
      if (best !== shownNow) show(best);
      p.vx *= 0.8; p.vy *= 0.8;
      return energy;
    }

    // a written clover shows its one line right away; an empty one invites writing
    function label(h) {
      const t = window.I18N ? window.I18N.t : k => k;
      if (h.kind === 'empty') return t('tagEmpty');
      if (h.text) return h.text;
      return h.mine ? t('tagMine') : t('tagOther');
    }
    function show(h) {
      shownNow = h;
      if (h) {
        const text = label(h), photo = h.kind === 'happy' && h.photo;
        if (photo) {
          // the photo sits small at the front of the label; an older photo without a small copy uses the big one
          const img = document.createElement('img');
          img.alt = ''; img.decoding = 'async';
          img.onerror = () => { if (img.src !== photo[1]) img.src = photo[1]; else img.remove(); };
          img.src = photo[0];
          const span = document.createElement('span');
          span.textContent = text;
          tag.replaceChildren(img, span);
        } else tag.textContent = text;
        tag.classList.toggle('has-photo', !!photo);
        tag.classList.toggle('is-empty', h.kind === 'empty');
        tag.classList.toggle('is-mine', h.kind === 'happy' && h.mine);
        placeTag(h);
      }
      tag.classList.toggle('is-hidden', !h);
      opts.onShow && opts.onShow(h ? public_(h) : null);
    }
    function placeTag(h) {
      // keep the whole label inside the field, whatever its length
      const half = (tag.offsetWidth || 160) / 2 + 8;
      const x = h.x - cam.x, y = h.y - cam.y;
      tag.style.left = Math.max(half, Math.min(VW - half, x)) + 'px';
      tag.style.top = y + 'px';
      tag.classList.toggle('is-off', y < 0 || y > VH || x < 0 || x > VW);
    }

    // only the part of the view that moved is painted again each frame
    let dirty = null, full = true;
    function mark(x, y, r) {
      if (!dirty) dirty = { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
      else { dirty.x0 = Math.min(dirty.x0, x - r); dirty.y0 = Math.min(dirty.y0, y - r); dirty.x1 = Math.max(dirty.x1, x + r); dirty.y1 = Math.max(dirty.y1, y + r); }
    }
    const reach = c => SPRITE * c.s * 0.5 + 6;

    // each leaf picture is kept ready at the exact size it is drawn, so painting a leaf is a plain copy:
    // no scaling and no turning, which is what keeps digging smooth on slower phones
    let sizedCache = new Map();
    // phones cap how much canvas memory a page may hold; when a new picture is refused,
    // drop the cached pictures (they are redrawn on demand) and try once more
    function ctx2d(cv) {
      let c = cv.getContext('2d');
      if (!c) { try { chunks.clear(); sizedCache = new Map(); } catch (_) { /* not set up yet */ } c = cv.getContext('2d'); }
      if (!c) throw new Error('canvas memory is full');
      return c;
    }
    function sized(l) {
      const key = (l.grass ? 'g' : 'c') + l.tier + ':' + l.v + ':' + l.s;
      let img = sizedCache.get(key);
      if (img) return img;
      const src = l.grass ? grassSprites[l.tier][l.v] : cloverSprites[l.tier][l.v];
      const n = Math.max(2, Math.round(SPRITE * l.s * dpr));
      img = document.createElement('canvas'); img.width = img.height = n;
      const c = ctx2d(img);
      c.imageSmoothingQuality = 'high';
      c.drawImage(src, 0, 0, n, n);
      sizedCache.set(key, img);
      return img;
    }

    function blit(c, img, x, y, rot, s, ox, oy) {
      const cs = Math.cos(rot) * s * dpr, sn = Math.sin(rot) * s * dpr;
      c.setTransform(cs, sn, -sn, cs, (x - ox) * dpr, (y - oy) * dpr);
      c.drawImage(img, -SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
    }

    // paint one rectangle of the meadow onto a canvas whose top-left pixel is world point (ox, oy).
    // "rest" paints every leaf where it sleeps; otherwise where it is right now
    function paint(c, ox, oy, x0, y0, x1, y1, rest) {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      const px = Math.floor((x0 - ox) * dpr), py = Math.floor((y0 - oy) * dpr);
      const pw = Math.ceil((x1 - x0) * dpr) + 1, ph = Math.ceil((y1 - y0) * dpr) + 1;
      c.beginPath(); c.rect(px, py, pw, ph); c.clip();
      c.fillStyle = '#0e1410'; c.fillRect(px, py, pw, ph);
      const T = Math.round(TILE * dpr);
      for (let ty = Math.floor(Math.max(0, y0) / TILE) * TILE; ty < Math.min(y1, WH); ty += TILE)
        for (let tx = Math.floor(Math.max(0, x0) / TILE) * TILE; tx < Math.min(x1, WW); tx += TILE)
          c.drawImage(soilTile, Math.round((tx - ox) * dpr), Math.round((ty - oy) * dpr), T, T);
      const m = rest ? 56 : 140;
      const list = near(x0 - m, y0 - m, x1 + m, y1 + m).sort((a, b) => a.order - b.order);
      const at = l => rest ? [l.hx, l.hy, 0] : [l.hx + l.ox, l.hy + l.oy, l.rot];
      const leaf = l => {
        const [x, y, rot] = at(l), r = reach(l);
        if (x + r < x0 || x - r > x1 || y + r < y0 || y - r > y1) return;
        const img = sized(l);
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(img, Math.round((x - ox) * dpr - img.width / 2), Math.round((y - oy) * dpr - img.height / 2));
        if (decor && l.tier === 2 && !l.grass && l.deco < decor.rate) {
          const img = decor.sprites[l.dv], d = SPRITE * l.s * l.dd * 0.5, k = img.width / dpr / 2;
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.drawImage(img, Math.round((x + Math.cos(l.da + rot) * d - k - ox) * dpr), Math.round((y + Math.sin(l.da + rot) * d - k - oy) * dpr));
        }
      };
      let i = 0;
      for (; i < list.length && list[i].z < HIDDEN_Z; i++) leaf(list[i]);
      for (const h of hidden) {
        const r = SPRITE * h.s * 0.7;
        if (h.x + r < x0 || h.x - r > x1 || h.y + r < y0 || h.y - r > y1) continue;
        const pop = !rest && h.found ? 1 + Math.sin(Math.min(h.t, 1) * Math.PI) * 0.18 : 1;
        blit(c, threeSprites[h.rk], h.x, h.y, 0, h.s * pop, ox, oy);
        if (!rest && h.found && h.lit) {
          c.globalAlpha = 0.85;
          blit(c, litSprites[h.kind][h.rk], h.x, h.y, 0, h.s * pop, ox, oy);
          c.globalAlpha = 1;
        }
      }
      for (; i < list.length; i++) leaf(list[i]);
      // the light of the hour, painted into the picture itself (no extra layers for the browser to blend every frame)
      if (light.length) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        for (const [op, color] of light) { c.globalCompositeOperation = op; c.fillStyle = color; c.fillRect(px, py, pw, ph); }
        c.globalCompositeOperation = 'source-over';
      }
      // a written clover carries a small white blossom above the leaves, so you can tell from afar that someone wrote there
      for (const h of hidden) {
        if (h.kind !== 'happy' || (!rest && h.found && h.lit)) continue;
        if (h.x + 28 < x0 || h.x - 28 > x1 || h.y + 28 < y0 || h.y - 28 > y1) continue;
        blossom(c, h, ox, oy);
      }
      c.restore();
    }

    // a white clover flower seen from above: a round head of small florets, a pale ring of petals around a creamy middle
    let blossoms = {};
    function makeBlossom(mine) {
      const K = 1.4; // drawn 1.4x the size it was first designed at
      const S = Math.ceil(36 * K), out = document.createElement('canvas');
      out.width = out.height = Math.round(S * dpr);
      const c = ctx2d(out);
      c.scale(dpr, dpr); c.translate(S / 2, S / 2 - 2 * K); c.scale(K, K);
      const glow = c.createRadialGradient(0, 0, 0, 0, 0, 16);
      glow.addColorStop(0, mine ? 'rgba(240,206,110,0.4)' : 'rgba(250,248,232,0.32)');
      glow.addColorStop(1, 'rgba(250,248,232,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill();
      // a short stalk leaning down and to the right, and the head's shadow on the leaves
      c.strokeStyle = '#4c7a3e'; c.lineWidth = 1.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(1, 4); c.quadraticCurveTo(4, 9, 3.5, 13); c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.32)'; c.beginPath(); c.ellipse(1.4, 2.2, 7, 6.4, 0, 0, Math.PI * 2); c.fill();
      // the head: rings of small florets, the older ones near the bottom blushed pink (gold on your own)
      const white = mine ? '#f7e2a0' : '#fdfbf2', blush = mine ? '#e6bd55' : '#efd9d2', mid = mine ? '#eccf7a' : '#f1ecdc';
      const rings = [[16, 5.2, 2.4], [11, 3.4, 2.1], [6, 1.6, 1.8]];
      for (const [n, rad, len] of rings) {
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 / n) * i + rad * 0.37;
          const low = Math.sin(a) > 0.35 && rad > 4;
          c.save(); c.rotate(a); c.translate(rad, 0);
          c.fillStyle = low ? blush : (i % 2 ? white : mid);
          c.beginPath(); c.ellipse(len / 2 - 0.4, 0, len / 2 + 0.5, 0.95, 0, 0, Math.PI * 2); c.fill();
          c.restore();
        }
      }
      c.fillStyle = mine ? '#d6aa3a' : '#e3dcc0';
      c.beginPath(); c.arc(0, 0, 1.2, 0, Math.PI * 2); c.fill();
      return out;
    }
    function blossom(c, h, ox, oy) {
      if (!blossoms.plain) blossoms = { plain: makeBlossom(false), mine: makeBlossom(true) };
      const img = h.mine ? blossoms.mine : blossoms.plain;
      c.setTransform(1, 0, 0, 1, 0, 0);
      const half = img.width / dpr / 2;
      c.drawImage(img, Math.round((h.x - ox - half) * dpr), Math.round((h.y - oy - half - 2) * dpr));
    }

    /* ---------- the hour, the season and the weather ---------- */
    let light = [], decor = null, airKey = '';
    const M = 'multiply', S = 'screen', O = 'source-over';
    const HOURS = {
      dawn: [[M, 'rgb(214,208,238)'], [S, 'rgba(255,214,206,0.07)']],
      day: [[S, 'rgba(255,250,222,0.17)']],
      dusk: [[M, 'rgb(250,200,172)'], [S, 'rgba(255,160,100,0.05)']],
      night: [[M, 'rgb(116,136,186)']],
    };
    const SEASONS = {
      spring: [[M, 'rgb(252,250,246)'], [S, 'rgba(255,236,242,0.04)']],
      summer: [[S, 'rgba(210,255,170,0.05)']],
      autumn: [[M, 'rgb(255,234,198)']],
      winter: [[M, 'rgb(228,236,246)'], [S, 'rgba(235,242,255,0.05)']],
    };
    const WEATHER = {
      clear: [],
      cloud: [[M, 'rgb(220,224,228)']],
      rain: [[M, 'rgb(192,204,218)']],
      snow: [[M, 'rgb(234,240,248)'], [S, 'rgba(255,255,255,0.07)']],
      fog: [[O, 'rgba(214,222,226,0.22)']],
    };
    // the things that rest on the leaves, drawn once as tiny pictures
    function makeDecor(season, phase, weather) {
      const tiny = (w, draw) => {
        const out = document.createElement('canvas'); out.width = out.height = Math.ceil(w * dpr);
        const c = ctx2d(out); c.scale(dpr, dpr); c.translate(w / 2, w / 2); draw(c); return out;
      };
      const wet = weather === 'rain' || phase === 'dawn';
      if (wet) return { rate: weather === 'rain' ? 0.32 : 0.2, sprites: [0, 1, 2, 3].map(i => tiny(8, c => {
        const r = 1.1 + i * 0.25;
        c.fillStyle = 'rgba(210,235,255,0.35)'; c.beginPath(); c.arc(0, 0, r + 0.8, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.5, 0, Math.PI * 2); c.fill();
      })) };
      if (season === 'autumn') return { rate: 0.12, sprites: ['#d9822b', '#b8432f', '#e0b23a', '#8a5a2b'].map((col, i) => tiny(14, c => {
        c.rotate(i * 1.3); c.fillStyle = col;
        c.beginPath(); c.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(60,30,10,0.45)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke();
      })) };
      if (season === 'winter' || weather === 'snow') return { rate: weather === 'snow' ? 0.4 : 0.18, sprites: [0, 1, 2, 3].map(i => tiny(14, c => {
        c.fillStyle = 'rgba(250,252,255,0.9)';
        for (let k = 0; k < 3 + i; k++) { c.beginPath(); c.arc(Math.cos(k * 2.1 + i) * 3, Math.sin(k * 2.1 + i) * 2.4, 1.2 + (k % 2) * 0.6, 0, Math.PI * 2); c.fill(); }
      })) };
      if (season === 'spring') return { rate: 0.06, sprites: ['#f6cfdc', '#f2bccd', '#fae0e8', '#efc2d2'].map((col, i) => tiny(10, c => {
        c.rotate(i * 1.6); c.fillStyle = col;
        c.beginPath(); c.moveTo(0, 3); c.bezierCurveTo(-3.4, 0.6, -2.4, -3, 0, -1.6); c.bezierCurveTo(2.4, -3, 3.4, 0.6, 0, 3); c.fill();
      })) };
      return null;
    }

    // the sleeping meadow is kept as picture tiles, so moving the view only copies pictures;
    // whatever is moving right now is painted fresh on top
    const CHUNK = 256;
    const chunks = new Map();
    let chunkMax = 40;
    function chunk(i, j) {
      const key = i + ',' + j;
      let img = chunks.get(key);
      if (img) { chunks.delete(key); chunks.set(key, img); return img; }
      img = document.createElement('canvas');
      img.width = img.height = Math.round(CHUNK * dpr);
      paint(ctx2d(img), i * CHUNK, j * CHUNK, i * CHUNK, j * CHUNK, (i + 1) * CHUNK, (j + 1) * CHUNK, true);
      chunks.set(key, img);
      if (chunks.size > chunkMax) chunks.delete(chunks.keys().next().value);
      return img;
    }
    function forget(x0, y0, x1, y1) {
      for (let j = Math.floor((y0 - 60) / CHUNK); j <= Math.floor((y1 + 60) / CHUNK); j++)
        for (let i = Math.floor((x0 - 60) / CHUNK); i <= Math.floor((x1 + 60) / CHUNK); i++) chunks.delete(i + ',' + j);
    }
    function liveBounds() {
      let b = null;
      const add = (x, y, r) => {
        if (!b) b = { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
        else { b.x0 = Math.min(b.x0, x - r); b.y0 = Math.min(b.y0, y - r); b.x1 = Math.max(b.x1, x + r); b.y1 = Math.max(b.y1, y + r); }
      };
      for (const c of moving) add(c.hx + c.ox, c.hy + c.oy, reach(c) + 2);
      for (const h of hidden) if (h.lit || (h.found && h.t < 0.999)) add(h.x, h.y, SPRITE * h.s * 0.75);
      return b;
    }

    function draw() {
      if (!VW || !soilTile) return;
      if (full) {
        full = false;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#0e1410'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let j = Math.max(0, Math.floor(cam.y / CHUNK)); j * CHUNK < Math.min(WH, cam.y + VH); j++)
          for (let i = Math.max(0, Math.floor(cam.x / CHUNK)); i * CHUNK < Math.min(WW, cam.x + VW); i++)
            ctx.drawImage(chunk(i, j), Math.round((i * CHUNK - cam.x) * dpr), Math.round((j * CHUNK - cam.y) * dpr));
        ctx.restore();
        dirty = liveBounds();
      }
      if (!dirty) return;
      const x0 = Math.max(cam.x, Math.floor(dirty.x0)), y0 = Math.max(cam.y, Math.floor(dirty.y0));
      const x1 = Math.min(cam.x + VW, Math.ceil(dirty.x1)), y1 = Math.min(cam.y + VH, Math.ceil(dirty.y1));
      dirty = null;
      if (x1 > x0 && y1 > y0) paint(ctx, cam.x, cam.y, x0, y0, x1, y1, false);
    }

    /* ---------- the map in the corner ---------- */
    function sizeMini() {
      const w = VW < 640 ? 92 : 148, hgt = Math.round(w * WH / WW);
      mini.style.width = w + 'px'; mini.style.height = hgt + 'px';
      mini.width = Math.round(w * dpr); mini.height = Math.round(hgt * dpr);
      drawMini();
    }
    function drawMini() {
      const w = mini.width, hgt = mini.height, k = w / WW;
      if (!w) return;
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.clearRect(0, 0, w, hgt);
      const css = getComputedStyle(mini);
      for (const h of hidden) {
        if (!h.found && h.kind !== 'happy') continue;
        mctx.fillStyle = h.kind === 'empty' ? css.getPropertyValue('--map-empty') : h.mine ? css.getPropertyValue('--gold') : css.getPropertyValue('--map-dot');
        mctx.beginPath(); mctx.arc(h.x * k, h.y * k, 1.8 * dpr, 0, Math.PI * 2); mctx.fill();
      }
      mctx.strokeStyle = css.color; mctx.lineWidth = 1.25 * dpr;
      const vx = Math.max(0, cam.x * k), vy = Math.max(0, cam.y * k);
      mctx.strokeRect(vx + 0.5, vy + 0.5, Math.min(w - 1, VW * k) - 1, Math.min(hgt - 1, VH * k) - 1);
    }
    mini.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const r = mini.getBoundingClientRect();
      flyTo((e.clientX - r.left) / r.width * WW, (e.clientY - r.top) / r.height * WH);
    });

    function tick(now) {
      if (camAnim) {
        const a = camAnim, t = Math.min(1, (now - a.t0) / a.dur), e = 1 - Math.pow(1 - t, 3);
        moveCam(a.fx + (a.ex - a.fx) * e, a.fy + (a.ey - a.fy) * e);
        if (t >= 1) { camAnim = null; if (a.done) a.done(); }
      }
      const e = step(now);
      draw();
      if (camMoved) { camMoved = false; drawMini(); }
      raf = (e > 0.4 || pointer.active || sweeping || camAnim || moving.size) ? requestAnimationFrame(tick) : (last = 0);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(tick); }

    const found = () => hidden.filter(x => x.found).length;
    function find(h) {
      h.found = true; h.t = 0;
      opts.onFound && opts.onFound(found(), hidden.length, public_(h));
      drawMini();
      wake();
    }
    const public_ = h => ({ key: h.key, kind: h.kind, mine: h.mine, fx: h.fx, fy: h.fy });

    /* ---------- hands: hover or one finger digs, a drag (or two fingers, or the wheel) moves around, a tap opens ---------- */
    const fingers = new Map();
    let gesture = null, releaseTimer = 0;
    function local(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function dig(q) {
      pointer.sx = q.x; pointer.sy = q.y; pointer.tx = q.x + cam.x; pointer.ty = q.y + cam.y;
      if (!pointer.active) { pointer.x = pointer.tx; pointer.y = pointer.ty; pointer.vx = pointer.vy = 0; }
      pointer.active = true;
      wake();
    }
    function release() { clearTimeout(releaseTimer); if (!sweeping) pointer.active = false; }
    const midpoint = () => { let x = 0, y = 0; for (const q of fingers.values()) { x += q.x; y += q.y; } return { x: x / fingers.size, y: y / fingers.size }; };

    canvas.addEventListener('pointerdown', e => {
      clearTimeout(releaseTimer);
      camAnim = null;
      const q = local(e);
      canvas.setPointerCapture?.(e.pointerId);
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        gesture = { kind: 'mouse', sx: q.x, sy: q.y, cx: cam.x, cy: cam.y, t: performance.now(), moved: 0, panning: false };
        dig(q);
        return;
      }
      fingers.set(e.pointerId, q);
      if (fingers.size === 1) {
        gesture = { kind: 'finger', sx: q.x, sy: q.y, t: performance.now(), moved: 0 };
        dig(q);
      } else {
        // a second finger: stop digging and move around instead
        gesture = { kind: 'pan', mid: midpoint(), cx: cam.x, cy: cam.y };
        pointer.active = false;
        canvas.classList.add('is-panning');
      }
    });
    canvas.addEventListener('pointermove', e => {
      const q = local(e);
      if (fingers.has(e.pointerId)) fingers.set(e.pointerId, q);
      const g = gesture;
      if (g && g.kind === 'pan') {
        if (fingers.size >= 2) { const m = midpoint(); moveCam(g.cx - (m.x - g.mid.x), g.cy - (m.y - g.mid.y)); }
        return;
      }
      if (g && g.kind === 'mouse' && (e.buttons & 1)) {
        g.moved = Math.max(g.moved, Math.hypot(q.x - g.sx, q.y - g.sy));
        if (g.panning || g.moved > 6) {
          if (!g.panning) { g.panning = true; pointer.active = false; canvas.classList.add('is-panning'); }
          moveCam(g.cx - (q.x - g.sx), g.cy - (q.y - g.sy));
          return;
        }
      }
      if (g && g.kind === 'finger') g.moved = Math.max(g.moved, Math.hypot(q.x - g.sx, q.y - g.sy));
      clearTimeout(releaseTimer);
      dig(q);
    });
    canvas.addEventListener('pointerup', e => {
      const q = local(e), g = gesture;
      fingers.delete(e.pointerId);
      if (g && g.kind === 'pan') {
        // lifting the fingers ends the move; the hand digs again only after a fresh touch
        if (!fingers.size) { gesture = null; canvas.classList.remove('is-panning'); }
        return;
      }
      if (g && !g.panning && g.moved < 12 && performance.now() - g.t < 700) tap(q);
      gesture = null;
      canvas.classList.remove('is-panning');
      if (e.pointerType === 'mouse') { dig(q); return; }
      // a lifted finger leaves the hole open long enough to tap the clover
      clearTimeout(releaseTimer); releaseTimer = setTimeout(release, 1500);
    });
    canvas.addEventListener('pointercancel', e => { fingers.delete(e.pointerId); gesture = null; canvas.classList.remove('is-panning'); release(); });
    canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !gesture) release(); });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? VH : 1;
      let dx = e.deltaX * unit, dy = e.deltaY * unit;
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      camAnim = null;
      // scrolling lifts the hand; it digs again as soon as the mouse moves
      if (!sweeping) pointer.active = false;
      moveCam(cam.x + dx, cam.y + dy);
    }, { passive: false });
    // the keyboard moves the view too, and Enter opens the clover whose label is showing
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', e => {
      const d = 180, moves = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
      if (moves[e.key]) { e.preventDefault(); flyTo(cam.x + VW / 2 + moves[e.key][0], cam.y + VH / 2 + moves[e.key][1]); }
      else if ((e.key === 'Enter' || e.key === ' ') && shownNow && opts.onPick) { e.preventDefault(); opts.onPick(public_(shownNow)); }
    });

    function tap(q) {
      let pick = null;
      if (shownNow && !tag.classList.contains('is-hidden')) {
        const r = tag.getBoundingClientRect(), f = canvas.getBoundingClientRect();
        const x = q.x + f.left, y = q.y + f.top;
        if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) pick = shownNow;
      }
      if (!pick) {
        const wx = q.x + cam.x, wy = q.y + cam.y;
        let bestD = 34;
        for (const h of hidden) {
          if (!h.found && h.kind !== 'happy') continue; // written ones can be opened straight from their blossom
          const d = Math.hypot(h.x - wx, h.y - wy);
          if (d < bestD) { bestD = d; pick = h; }
        }
      }
      if (pick && opts.onPick) opts.onPick(public_(pick));
    }

    /* the hint: the view glides over, a hand sweeps the leaves aside over one hidden clover, holds, then lets go */
    let sweeping = false;
    function sweep(h, done) {
      if (!h || sweeping || !VW) return;
      sweeping = true;
      const t0 = performance.now(), dur = reduce ? 1 : 900;
      const sx = h.x + (h.x - cam.x < VW / 2 ? 140 : -140), sy = h.y + 60;
      const put = (x, y) => {
        pointer.vx = x - pointer.x; pointer.vy = y - pointer.y;
        pointer.x = pointer.tx = x; pointer.y = pointer.ty = y; pointer.sx = x - cam.x; pointer.sy = y - cam.y; pointer.active = true;
      };
      const move = now => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        const wob = Math.sin(k * Math.PI * 4) * 18 * (1 - k);
        put(sx + (h.x - sx) * e + wob, sy + (h.y - sy) * e - wob * 0.5);
        wake();
        if (k < 1) requestAnimationFrame(move);
        else {
          if (done) done();
          // hold the leaves open while it is found, then let the field close again
          const hold = performance.now();
          const keep = t => {
            put(h.x + 6, h.y + 4); pointer.vx = 0; pointer.vy = 0;
            if (t - hold < 2200) requestAnimationFrame(keep);
            else { sweeping = false; pointer.active = false; }
          };
          requestAnimationFrame(keep);
        }
      };
      requestAnimationFrame(move);
    }
    function reveal(h, done) {
      if (!h) return;
      if (inView(h.x, h.y, 90)) sweep(h, done);
      else flyTo(h.x, h.y, () => sweep(h, done));
    }

    new ResizeObserver(() => { resize(); }).observe(field);
    const first = resize();

    // a small gust over the first view when the page opens, so the field reads as alive
    if (first && !reduce) {
      for (const c of near(cam.x, cam.y, cam.x + VW, cam.y + VH)) {
        c.vx = (Math.random() - 0.3) * 3; c.vy = (Math.random() - 0.5) * 2; moving.add(c);
      }
      wake();
    }

    const byKey = key => hidden.find(h => h.key === key);
    const api = {
      get world() { return { width: WW, height: WH }; },
      // make the meadow a new size; clovers keep their place as a share of the width and height
      setWorld(w, hgt) {
        w = Math.round(w); hgt = Math.round(hgt);
        if (w === WW && hgt === WH) return;
        const mx = (cam.x + VW / 2) / WW, my = (cam.y + VH / 2) / WH;
        WW = w; WH = hgt;
        hidden.forEach(h => { h.x = h.fx * WW; h.y = h.fy * WH; });
        cam.x = mx * WW - VW / 2; cam.y = my * WH - VH / 2; clampCam();
        items = []; chunks.clear(); sizeMini();
      },
      set(list) {
        hidden = list.map(makeHidden);
        buildItems(); bury(hidden); index(); chunks.clear();
        show(null);
        full = true; draw(); drawMini();
        opts.onFound && opts.onFound(0, hidden.length, null);
      },
      add(c) {
        const h = makeHidden(c);
        hidden.push(h);
        bury([h]); index(); forget(h.x - 80, h.y - 80, h.x + 80, h.y + 80);
        full = true; wake(); drawMini();
        opts.onFound && opts.onFound(found(), hidden.length, null);
        return h;
      },
      update(key, patch) {
        const h = byKey(key);
        if (!h) return;
        Object.assign(h, patch);
        forget(h.x - 80, h.y - 80, h.x + 80, h.y + 80); full = true;
        if (shownNow === h) show(h);
        mark(h.x, h.y, SPRITE); wake(); drawMini();
      },
      remove(key) {
        const gone = byKey(key);
        if (gone) forget(gone.x - 80, gone.y - 80, gone.x + 80, gone.y + 80);
        hidden = hidden.filter(h => h.key !== key);
        if (shownNow && shownNow.key === key) show(null);
        full = true; wake(); drawMini();
        opts.onFound && opts.onFound(found(), hidden.length, null);
      },
      // the time of day ('dawn' | 'day' | 'dusk' | 'night'), the season and the weather
      setAtmosphere({ phase, season, weather }) {
        const key = [phase, season, weather, dpr].join();
        if (key === airKey) return;
        airKey = key;
        light = [...(HOURS[phase] || []), ...(SEASONS[season] || []), ...(WEATHER[weather] || [])];
        decor = makeDecor(season, phase, weather);
        chunks.clear(); full = true; wake(); requestAnimationFrame(drawMini);
      },
      reveal(key, done) { reveal(byKey(key), done); },
      // show one nearby: the hidden clover closest to the middle of the screen
      hint(kind) {
        const mx = cam.x + VW / 2, my = cam.y + VH / 2;
        let pool = hidden.filter(x => !x.found && (!kind || x.kind === kind));
        if (!pool.length) pool = hidden.filter(x => !x.found);
        if (!pool.length) return false;
        pool.sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my));
        reveal(pool[0]);
        return true;
      },
      left: () => hidden.length - found(),
    };
    return api;
  };
})();
