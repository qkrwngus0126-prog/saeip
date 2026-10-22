/* 10초 세잎클로버 찾기 챌린지 (challenge.html, 인스타 릴스 녹화용).
   saeip 들판(js/field.js)의 잎 그림, 흙, 시간대 빛을 그대로 옮겨 와서 9:16 화면 한 장에 멈춘 들판을 그립니다.
   네잎클로버 사이에 세잎클로버가 딱 하나 있어요. 같은 시드와 레벨이면 언제나 똑같은 들판이 나와요.
   주소에 ?seed=123456&level=2 를 붙이면 그 배치를 바로 불러옵니다.

   흐름: 시작 → 1초 뒤 10초 카운트다운 → "찾았으면 댓글에 위치 남겨줘" → 엔딩 → 처음 화면으로
   레벨: 1 많이 확대 · 2 중간 · 3 사이트 들판 크기 그대로 (휴대폰 한 화면에 보이는 만큼)
   영상 만들기: 같은 장면을 1080x1920 캔버스에 그리며 녹화해서 MP4(안 되는 브라우저는 WebM) 파일로 저장해요. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the flow, in milliseconds ---------- */
  const T = { delay: 1000, count: 10000, zero: 500, ask: 3200, end: 3800, back: 900 };
  // how many meadow pixels fit across the screen; 390 is what a phone shows of the site, so level 3 looks the same
  const LEVELS = { 1: 210, 2: 290, 3: 390 };
  // where the three-leaf clover may hide, as a share of the screen: below the title, clear of the edges
  // and of the parts Instagram covers (its buttons on the right, the caption at the bottom)
  const SAFE = { x0: 0.12, x1: 0.80, y0: 0.38, y1: 0.74 };
  const DW = 1080, DH = 1920;

  /* ---------- the same leaves as js/field.js, drawn from a seed ---------- */
  const GREENS = ['#4f7f45', '#5c8a48', '#44713f'];
  const TIERS = [0.66, 0.86, 1.0];
  const TIER_RES = [0.68, 0.64, 0.72];
  const ROTS = 6;
  const SPRITE = 96;
  const THREE_RES = 0.72;
  const HOURS = {
    dawn: [['multiply', 'rgb(214,208,238)'], ['screen', 'rgba(255,214,206,0.07)']],
    day: [['screen', 'rgba(255,250,222,0.17)']],
    dusk: [['multiply', 'rgb(250,200,172)'], ['screen', 'rgba(255,160,100,0.05)']],
    night: [['multiply', 'rgb(116,136,186)']],
  };

  // a small seeded random (mulberry32), so a seed number always brings back the same meadow
  function seeded(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rnd = Math.random;
  let px = 1; // device pixels per meadow pixel

  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shade(col, k) {
    const [r, g, b] = Array.isArray(col) ? col : rgb(col);
    const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function jitterColor(hex) {
    const [r, g, b] = rgb(hex), j = () => (rnd() - 0.5) * 14;
    return [r + j(), g + j(), b + j() * 0.6];
  }
  function sheet(res) {
    const s = document.createElement('canvas');
    s.width = s.height = Math.round(SPRITE * res * px);
    const c = s.getContext('2d');
    c.scale(res * px, res * px); c.translate(SPRITE / 2, SPRITE / 2);
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
    c.strokeStyle = `rgba(224,238,206,${0.12 + rnd() * 0.12})`; c.lineWidth = L * (0.07 + rnd() * 0.05); c.lineCap = 'round';
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
    const S = src.width, c = src.getContext('2d');
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
    const o = out.getContext('2d');
    o.shadowColor = 'rgba(0,0,0,0.6)'; o.shadowBlur = 6 * px * res; o.shadowOffsetX = 2 * px * res; o.shadowOffsetY = 4 * px * res;
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
      c.rotate((Math.PI * 2 / n) * i + (rnd() - 0.5) * 0.28);
      const fore = 0.74 + rnd() * 0.26; // a leaflet tilted away looks shorter
      c.scale(0.96 + rnd() * 0.08, fore);
      leaflet(c, L, 0.9 + rnd() * 0.15, jitterColor(base));
      c.restore();
    }
    c.fillStyle = shade(col, 0.42);
    c.beginPath(); c.arc(0, 0, 1.6, 0, Math.PI * 2); c.fill();
    return finish(s, tier, res);
  }

  function makeTuft(tier) {
    const [s, c] = sheet(0.8);
    const blades = 3 + (rnd() * 3 | 0);
    for (let i = 0; i < blades; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.3;
      const len = SPRITE * (0.28 + rnd() * 0.16);
      const bx = (rnd() - 0.5) * 8, by = SPRITE * 0.14;
      const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
      const bend = (rnd() - 0.5) * 18;
      const col = jitterColor(GREENS[(rnd() * GREENS.length) | 0]);
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

  function buildSprites(seed) {
    rnd = seeded(seed);
    const r = k => (Math.PI * 2 / ROTS) * k;
    return {
      clover: TIERS.map((t, ti) => GREENS.flatMap(g => Array.from({ length: ROTS }, (_, k) => makeClover(4, g, r(k), t, TIER_RES[ti])))),
      grass: TIERS.map(t => Array.from({ length: 3 }, () => makeTuft(t))),
    };
  }

  // the leaves, laid out as js/field.js does, over just the patch of meadow on screen (W x H meadow pixels)
  function leafAt(x, y, z, tier, grass, s) {
    return { x, y, z, tier, grass, s, v: grass ? (rnd() * 3) | 0 : (rnd() * GREENS.length * ROTS) | 0 };
  }
  function buildLayout(seed, level) {
    rnd = seeded(seed * 31 + level * 7919);
    const W = LEVELS[level], H = W * DH / DW;
    const items = [];
    const step = 18.3;
    for (let y = -step; y < H + step; y += step * 0.86) {
      for (let x = -step; x < W + step; x += step) {
        const z = rnd();
        const tier = z < 0.33 ? 0 : z < 0.66 ? 1 : 2;
        const grass = rnd() < 0.16;
        const s = (grass ? 0.5 : 0.44) + z * 0.2 + rnd() * 0.06 + (tier === 0 && !grass ? 0.1 : 0);
        items.push(leafAt(x + (rnd() - 0.5) * step * 0.95, y + (rnd() - 0.5) * step * 0.95, z, tier, grass, s));
      }
    }
    // the one three-leaf clover sits among the upper leaves, as big and as bright as its neighbours
    const three = {
      x: W * (SAFE.x0 + rnd() * (SAFE.x1 - SAFE.x0)),
      y: H * (SAFE.y0 + rnd() * (SAFE.y1 - SAFE.y0)),
      z: 0.86 + rnd() * 0.04, s: 0.62 + rnd() * 0.06,
      rk: (rnd() * ROTS) | 0, gk: (rnd() * GREENS.length) | 0,
    };
    // keep it findable: nothing sits right on its middle, and no nearer leaf covers most of it
    const kept = items.filter(l => {
      const d = Math.hypot(l.x - three.x, l.y - three.y);
      return d > 9 && !(l.z > three.z && d < 17);
    });
    kept.sort((a, b) => a.z - b.z);
    return { W, H, items: kept, three, seed, level };
  }
  function makeThree(seed, level, t) {
    rnd = seeded(seed * 131 + level);
    return makeClover(3, GREENS[t.gk], (Math.PI * 2 / ROTS) * t.rk, TIERS[2], THREE_RES);
  }

  function paintSoil(c, W, H) {
    c.fillStyle = '#0e1410'; c.fillRect(0, 0, W, H);
    const dots = Math.round(W * H / 60);
    for (let i = 0; i < dots; i++) {
      const a = rnd() * 0.12 + 0.03;
      c.fillStyle = rnd() < 0.65 ? `rgba(110,86,60,${a})` : `rgba(60,90,55,${a})`;
      const r = rnd() * 1.6 + 0.4, x = rnd() * W, y = rnd() * H;
      c.fillRect(x, y, r, r);
    }
    // leaf litter and runners between the leaves
    const litter = Math.round(W * H / 700);
    for (let i = 0; i < litter; i++) {
      const x = rnd() * W, y = rnd() * H, rot = rnd() * Math.PI * 2;
      const leaf = rnd() < 0.55;
      const l = leaf ? 3 + rnd() * 5 : 10 + rnd() * 18, bend = (rnd() - 0.5) * 8, w = 0.8 + rnd() * 0.8;
      const col = leaf
        ? `rgba(${70 + rnd() * 40},${60 + rnd() * 30},${35 + rnd() * 15},${0.35 + rnd() * 0.3})`
        : `rgba(${45 + rnd() * 25},${70 + rnd() * 30},${40 + rnd() * 15},0.5)`;
      c.save(); c.translate(x, y); c.rotate(rot);
      if (leaf) { c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, l, l * 0.55, 0, 0, Math.PI * 2); c.fill(); }
      else { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(-l / 2, 0); c.quadraticCurveTo(0, bend, l / 2, 0); c.stroke(); }
      c.restore();
    }
  }

  /* ---------- the still meadow, with the sky's light and the dark fade behind the title baked in ---------- */
  // the patch of light the site lays over the field at each hour (style.css .sky .light), as ellipses of the screen
  const SKY = {
    dawn: { rx: 0.8, ry: 0.7, x: 0.08, y: -0.12, rgb: '255,200,186', a: 0.2 },
    day: { rx: 0.7, ry: 0.6, x: 0.88, y: -0.18, rgb: '255,246,205', a: 0.32 },
    dusk: { rx: 0.85, ry: 0.75, x: 1.02, y: 1.08, rgb: '255,150,80', a: 0.26 },
    night: { rx: 0.55, ry: 0.5, x: 0.88, y: -0.1, rgb: '200,214,255', a: 0.12 },
  };
  function paintMeadow(out) {
    const c = out.getContext('2d');
    const { W, H, items } = layout;
    c.setTransform(px, 0, 0, px, 0, 0);
    rnd = seeded(seed * 17 + level);
    paintSoil(c, W, H);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingQuality = 'high';
    const put = (img, x, y, size) => c.drawImage(img, x * px - size / 2, y * px - size / 2, size, size);
    const leaf = l => put(l.grass ? sprites.grass[l.tier][l.v] : sprites.clover[l.tier][l.v], l.x, l.y, SPRITE * l.s * px);
    const t = layout.three;
    let i = 0;
    for (; i < items.length && items[i].z < t.z; i++) leaf(items[i]);
    put(three, t.x, t.y, SPRITE * t.s * px);
    for (; i < items.length; i++) leaf(items[i]);
    // the light of the hour, as the site paints it into the field
    for (const [op, color] of HOURS[lightPhase]) { c.globalCompositeOperation = op; c.fillStyle = color; c.fillRect(0, 0, out.width, out.height); }
    c.globalCompositeOperation = 'source-over';

    const k = out.width / DW;
    c.setTransform(k, 0, 0, k, 0, 0);
    const sky = SKY[lightPhase];
    c.save();
    c.translate(sky.x * DW, sky.y * DH); c.scale(sky.rx * DW, sky.ry * DH);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(${sky.rgb},${sky.a})`); g.addColorStop(0.7, `rgba(${sky.rgb},0)`);
    c.fillStyle = g; c.fillRect(-3, -3, 6, 6);
    c.restore();
    const f = c.createLinearGradient(0, 0, 0, 760);
    f.addColorStop(0, 'rgba(10,15,12,0.86)'); f.addColorStop(0.48, 'rgba(10,15,12,0.72)');
    f.addColorStop(0.78, 'rgba(10,15,12,0.3)'); f.addColorStop(1, 'rgba(10,15,12,0)');
    c.fillStyle = f; c.fillRect(0, 0, DW, 760);
  }

  /* ---------- one moment of the challenge, drawn on any canvas of 9:16 ----------
     t is the time since start was pressed; 0 (or anything past the end) is the first screen */
  const P = T.delay, C = P + T.count, Z = C + T.zero, A = Z + T.ask, E = A + T.end, B = E + T.back;
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 4);
  function moment(t) {
    const m = { bar: 1, num: 10, pop: 1, hot: t >= C - 3000 && t < E, hud: 1, hudY: 0, cover: 0, ask: [0, 40], end: [0, 40] };
    if (t >= P && t < C) { m.bar = (C - t) / T.count; m.num = Math.ceil((C - t) / 1000); }
    else if (t >= C && t < E) { m.bar = 0; m.num = 0; }
    else if (t >= E && t < B) m.bar = ease((t - E) / T.back);
    // the number pops each time it changes
    if (!reduce && t >= P + 1000 && t < C + 520) m.pop = 1 + 0.22 * (1 - ease(((t - P) % 1000) / 520));
    if (t >= Z && t < E) { m.hud = 1 - ease((t - Z) / 600); m.cover = ease((t - Z) / 700); }
    else if (t >= E) { m.hud = ease((t - E) / 600); m.cover = 1 - ease((t - E) / 700); }
    m.hudY = -24 * (1 - m.hud);
    // a card comes in rising, and leaves a little quicker than the next one arrives
    const card = (t1, t2) => t < t1 ? [0, 40] : t < t2 ? [ease((t - t1) / 700), 40 * (1 - ease((t - t1) / 900))] : [1 - ease((t - t2) / 450), 40 * ease((t - t2) / 450)];
    m.ask = card(Z, A); m.end = card(A, E);
    return m;
  }

  const SANS = '"Noto Sans KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const SERIF = '"Noto Serif KR", "AppleMyungjo", "Batang", serif';
  const INK = '#e6ebe3', MUTED = '#9ba79d', ACCENT = '#7fcf95', GOLD = '#e0b84a';
  const MARK = new Path2D('M36.1 21.2A17 17 0 1 1 57.8 46.1L58.2 46.9A17 17 0 1 1 55.1 75.0M45.4 70.2A17 17 0 0 1 14.6 70.2M50 80Q51 89 57 95');
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function text(c, s, x, y, font, color, spacing, shadow) {
    c.font = font; c.fillStyle = color;
    if ('letterSpacing' in c) c.letterSpacing = (spacing || 0) + 'px';
    if (shadow) { c.shadowColor = shadow[0]; c.shadowBlur = shadow[1]; c.shadowOffsetY = 2; }
    c.fillText(s, x, y);
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }
  const SHADE = ['rgba(0,0,0,0.55)', 18];

  function drawHud(c, m) {
    c.save();
    c.globalAlpha = m.hud; c.translate(0, m.hudY);
    let y = 210;
    if (showChip) {
      const label = 'LEVEL ' + level;
      c.font = `500 30px ${SANS}`;
      if ('letterSpacing' in c) c.letterSpacing = '4px';
      const w = c.measureText(label).width + 52;
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      rr(c, DW / 2 - w / 2, y, w, 62, 31);
      c.fillStyle = 'rgba(14,20,16,0.5)'; c.fill();
      c.lineWidth = 2; c.strokeStyle = 'rgba(127,207,149,0.55)'; c.stroke();
      text(c, label, DW / 2 + 2, y + 32, `500 30px ${SANS}`, ACCENT, 4);
      y += 92;
    }
    ['네잎클로버 속 세잎클로버,', '10초 안에 찾아보세요'].forEach((s, i) => text(c, s, DW / 2, y + 95 * (i + 0.5), `500 72px ${SANS}`, INK, -2, SHADE));
    const cy = y + 190 + 46 + 50;
    c.save();
    c.translate(154, cy + 4); c.scale(m.pop, m.pop);
    text(c, String(m.num), 0, 0, `700 100px ${SANS}`, m.hot ? GOLD : INK, -4, SHADE);
    c.restore();
    const bx = 248, bw = DW - 90 - bx, bh = 22;
    rr(c, bx, cy - bh / 2, bw, bh, bh / 2);
    c.fillStyle = 'rgba(230,235,227,0.16)'; c.fill();
    if (m.bar > 0.001) {
      const g = c.createLinearGradient(bx, 0, bx + bw * m.bar, 0);
      g.addColorStop(0, m.hot ? '#c99a2e' : '#5fb87a'); g.addColorStop(1, m.hot ? GOLD : ACCENT);
      rr(c, bx, cy - bh / 2, bw * m.bar, bh, bh / 2);
      c.fillStyle = g; c.fill();
    }
    c.restore();
  }
  function drawCard(c, [o, dy], blocks) {
    if (o <= 0.001) return;
    const total = blocks.reduce((n, b) => n + b.h + (b.gap || 0), 0);
    let y = DH / 2 - total / 2 + dy;
    c.save(); c.globalAlpha = o;
    for (const b of blocks) {
      y += b.gap || 0;
      b.draw(y);
      y += b.h;
    }
    c.restore();
  }
  const CARD_SHADE = ['rgba(0,0,0,0.5)', 24];
  function drawScene(c, t, ring) {
    const k = c.canvas.width / DW, m = moment(t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.imageSmoothingQuality = 'high';
    c.drawImage(base, 0, 0, c.canvas.width, c.canvas.height);
    c.setTransform(k, 0, 0, k, 0, 0);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (ring) drawRing(c);
    if (m.hud > 0.001) drawHud(c, m);
    if (m.cover > 0.001) { c.fillStyle = `rgba(8,13,10,${0.74 * m.cover})`; c.fillRect(0, 0, DW, DH); }
    drawCard(c, m.ask, [
      { h: 64, draw: y => text(c, '시간 끝!', DW / 2, y + 32, `500 44px ${SANS}`, GOLD, 2) },
      { h: 240, gap: 30, draw: y => ['찾았으면', '댓글에 위치 남겨줘'].forEach((s, i) => text(c, s, DW / 2, y + 120 * i + 60, `500 92px ${SANS}`, INK, -3, CARD_SHADE)) },
      { h: 64, gap: 40, draw: y => text(c, '예) 왼쪽 위, 가운데 아래', DW / 2, y + 32, `300 44px ${SANS}`, MUTED) },
    ]);
    drawCard(c, m.end, [
      { h: 120, draw: y => {
        const s = 120 / 92;
        c.save();
        c.translate(DW / 2 - 88 * s / 2 - 8 * s, y - 6 * s); c.scale(s, s);
        c.strokeStyle = c.fillStyle = ACCENT; c.lineWidth = 7; c.lineCap = c.lineJoin = 'round';
        c.stroke(MARK);
        c.beginPath(); c.arc(23.5, 61, 4.3, 0, Math.PI * 2); c.arc(36.5, 61, 4.3, 0, Math.PI * 2); c.fill();
        c.restore();
      } },
      { h: 278, gap: 44, draw: y => ['네잎은 행운,', '세잎은 행복'].forEach((s, i) => text(c, s, DW / 2, y + 139 * i + 70, `500 104px ${SERIF}`, INK, -3, CARD_SHADE)) },
      { h: 72, gap: 54, draw: y => text(c, '당신의 세잎클로버를 남겨주세요', DW / 2, y + 36, `300 50px ${SANS}`, INK) },
    ]);
  }
  // the answer: a gold ring around the three-leaf clover (only for you, never in the video)
  function drawRing(c) {
    const t = layout.three, k = DW / layout.W;
    const x = t.x * k, y = t.y * k, r = SPRITE * t.s * 0.29 * k * 1.55;
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.shadowColor = 'rgba(224,184,74,0.7)'; c.shadowBlur = 40;
    c.lineWidth = 16; c.strokeStyle = 'rgba(0,0,0,0.45)'; c.stroke();
    c.shadowBlur = 0;
    c.lineWidth = 8; c.strokeStyle = GOLD; c.stroke();
    c.restore();
  }

  /* ---------- the page ---------- */
  const $ = id => document.getElementById(id);
  const stage = $('stage'), canvas = $('meadow'), ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');

  const q = new URLSearchParams(location.search);
  const newSeed = () => 100000 + Math.floor(Math.random() * 900000);
  const cleanSeed = v => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return n > 0 && n < 1e9 ? n : 0; };
  let seed = cleanSeed(q.get('seed')) || newSeed();
  let level = LEVELS[q.get('level')] ? +q.get('level') : 1;
  let lightPhase = HOURS[q.get('light')] ? q.get('light') : 'day';
  let showChip = true, answerOn = false;
  let layout = null, sprites = null, spriteKey = '', three = null, threeKey = '', baseKey = '';

  function fit() {
    const s = Math.min(innerWidth / DW, innerHeight / DH);
    stage.style.setProperty('--s', s);
    return s;
  }

  // the meadow is painted once, at least as sharp as the video; nothing on it moves, so each frame only copies it
  function render() {
    const s = fit();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const pw = Math.max(360, Math.min(1440, Math.round(DW * s * dpr)));
    const bw = Math.max(DW, pw);
    if (!layout || layout.seed !== seed || layout.level !== level) layout = buildLayout(seed, level);
    px = bw / layout.W;
    const sk = seed + ':' + px.toFixed(3);
    if (sk !== spriteKey) { sprites = buildSprites(seed); spriteKey = sk; threeKey = ''; }
    const tk = sk + ':' + level;
    if (tk !== threeKey) { three = makeThree(seed, level, layout.three); threeKey = tk; }
    const bk = [tk, bw, lightPhase].join();
    if (bk !== baseKey) {
      base.width = bw; base.height = Math.round(bw * DH / DW);
      paintMeadow(base);
      baseKey = bk;
    }
    if (canvas.width !== pw) { canvas.width = pw; canvas.height = Math.round(pw * DH / DW); }
    show();
  }

  /* ---------- playing it on screen ---------- */
  let t0 = 0, raf = 0, running = false, busy = false;
  const show = () => { if (!running) drawScene(ctx, 0, answerOn); };
  function frame(now) {
    const t = now - t0;
    if (t >= B) { running = false; raf = 0; show(); return; }
    drawScene(ctx, t, answerOn);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || busy) return;
    running = true; t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function reset() {
    cancelAnimationFrame(raf); raf = 0; running = false;
    show();
  }

  /* ---------- saving it as a video file ----------
     the same frames are drawn on a 1080x1920 canvas and recorded as they play, so it takes as long as the video itself */
  // Instagram wants H.264 in MP4. A plain 'video/mp4' is only trusted where MP4 can't hold VP9 (Safari, which records H.264);
  // elsewhere it may quietly be VP9, so WebM is the honest fallback
  const H264 = ['video/mp4;codecs=avc1.64002A', 'video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4D0028', 'video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4;codecs=avc3'];
  const WEBM = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  function pickType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return null;
    const ok = t => MediaRecorder.isTypeSupported(t);
    return H264.find(ok) || (ok('video/mp4') && !ok('video/mp4;codecs=vp9') ? 'video/mp4' : null) || WEBM.find(ok) || null;
  }
  const fontsReady = () => Promise.all([
    document.fonts.load(`500 72px ${SANS}`, '네잎클로버 속 세잎클로버, 10초 안에 찾아보세요 LEVEL 123'),
    document.fonts.load(`700 100px ${SANS}`, '0123456789'),
    document.fonts.load(`300 44px ${SANS}`, '예) 왼쪽 위, 가운데 아래 당신의 세잎클로버를 남겨주세요'),
    document.fonts.load(`500 92px ${SANS}`, '시간 끝! 찾았으면 댓글에 위치 남겨줘'),
    document.fonts.load(`500 104px ${SERIF}`, '네잎은 행운, 세잎은 행복'),
  ]).catch(() => null);
  let lastVideo = null;

  async function makeVideo() {
    if (busy) return;
    const type = pickType(), out = document.createElement('canvas');
    if (!type || !out.captureStream) { status('이 브라우저는 영상 저장을 지원하지 않아요. 최신 크롬이나 사파리에서 열어 주세요.'); return; }
    busy = true; reset(); lock(true);
    lastVideo = null; $('video-out').hidden = true;
    status('글꼴을 불러오는 중…');
    await fontsReady();
    out.width = DW; out.height = DH;
    const oc = out.getContext('2d');
    drawScene(oc, 0, false);
    // with a frame rate of 0, a frame is recorded each time we ask for one: one per screen refresh, from the very first
    const stream = out.captureStream(0), track = stream.getVideoTracks()[0];
    const manual = typeof track.requestFrame === 'function';
    const rec = new MediaRecorder(manual ? stream : out.captureStream(60), { mimeType: type, videoBitsPerSecond: 14e6 });
    const parts = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.start(1000);
    const begin = performance.now(), endAt = B + 120;
    await new Promise(done => {
      const step = now => {
        const t = now - begin;
        drawScene(oc, Math.min(t, B), false);
        if (manual) track.requestFrame();
        drawScene(ctx, Math.min(t, B), false);
        status(`녹화 중… ${Math.min(t, endAt) / 1000 | 0} / ${Math.ceil(endAt / 1000)}초 · 이 탭을 그대로 두세요`);
        if (t < endAt) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    rec.stop();
    await stopped;
    stream.getTracks().forEach(tr => tr.stop());
    const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm';
    const blob = new Blob(parts, { type: type.split(';')[0] });
    lastVideo = new File([blob], `saeip-challenge-L${level}-${seed}.${ext}`, { type: blob.type });
    busy = false; lock(false); show();
    $('video-out').hidden = false;
    $('share-btn').hidden = !(navigator.canShare && navigator.canShare({ files: [lastVideo] }));
    status(`완성! ${(blob.size / 1048576).toFixed(1)}MB · ${ext.toUpperCase()}` +
      (ext === 'webm' ? ' · 이 브라우저는 MP4로 저장하지 못해요. 인스타에 올리려면 MP4로 바꾸거나 최신 크롬에서 다시 만들어 주세요.' : ''));
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  // the answer as a picture, for a pinned comment or the next video
  async function answerImage() {
    await fontsReady();
    const out = document.createElement('canvas');
    out.width = DW; out.height = DH;
    drawScene(out.getContext('2d'), 0, true);
    out.toBlob(b => download(b, `saeip-answer-L${level}-${seed}.png`), 'image/png');
  }
  function status(s) { $('video-status').textContent = s; }
  function lock(on) {
    document.querySelectorAll('.panel button, .panel input, .panel select').forEach(el => {
      if (el.id !== 'hide-btn') el.disabled = on;
    });
  }

  /* ---------- controls ---------- */
  const unhide = $('unhide');
  function sync() {
    $('seed-now').textContent = seed;
    document.querySelectorAll('#levels button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.level === level)));
    $('light-sel').value = lightPhase;
    const u = new URL(location.href);
    u.searchParams.set('seed', seed); u.searchParams.set('level', level);
    if (lightPhase === 'day') u.searchParams.delete('light'); else u.searchParams.set('light', lightPhase);
    history.replaceState(null, '', u);
  }
  function rebuild() { reset(); render(); sync(); }
  function setLevel(n) { if (!busy && LEVELS[n] && n !== level) { level = n; rebuild(); } }
  function shuffle() { if (!busy) { seed = newSeed(); rebuild(); } }
  function toggleAnswer(on = !answerOn) {
    answerOn = on;
    $('answer-btn').setAttribute('aria-pressed', String(on));
    $('answer-btn').textContent = on ? '정답 숨기기' : '정답 보기';
    show();
  }
  function setClean(on) {
    document.body.classList.toggle('clean', on);
    unhide.hidden = !on;
    if (on && document.activeElement) document.activeElement.blur();
  }

  $('start-btn').addEventListener('click', start);
  $('reset-btn').addEventListener('click', reset);
  $('shuffle-btn').addEventListener('click', shuffle);
  $('answer-btn').addEventListener('click', () => toggleAnswer());
  $('answer-png').addEventListener('click', answerImage);
  $('video-btn').addEventListener('click', makeVideo);
  $('save-btn').addEventListener('click', () => { if (lastVideo) download(lastVideo, lastVideo.name); });
  $('share-btn').addEventListener('click', () => {
    if (lastVideo) navigator.share({ files: [lastVideo], title: '10초 세잎클로버 찾기' }).catch(() => null);
  });
  $('hide-btn').addEventListener('click', () => setClean(true));
  unhide.addEventListener('click', () => setClean(false));
  document.querySelectorAll('#levels button').forEach(b => b.addEventListener('click', () => setLevel(+b.dataset.level)));
  $('light-sel').addEventListener('change', e => { lightPhase = e.target.value; render(); sync(); });
  $('chip-chk').addEventListener('change', e => { showChip = e.target.checked; show(); });
  $('seed-form').addEventListener('submit', e => {
    e.preventDefault();
    const n = cleanSeed($('seed-in').value);
    if (!n || busy) { $('seed-in').focus(); return; }
    $('seed-in').value = '';
    seed = n; rebuild();
  });
  $('copy-btn').addEventListener('click', () => {
    const b = $('copy-btn');
    const done = () => { b.textContent = '복사됨'; setTimeout(() => { b.textContent = '링크 복사'; }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, () => prompt('이 링크를 복사하세요', location.href));
    else prompt('이 링크를 복사하세요', location.href);
  });
  // with the controls hidden, a tap anywhere on the screen starts the challenge
  stage.addEventListener('click', () => { if (document.body.classList.contains('clean')) start(); });

  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'enter') { if (e.target.tagName === 'BUTTON' && k === 'enter') return; e.preventDefault(); start(); }
    else if (k === 'escape') { if (!busy) reset(); }
    else if (k === 'h') setClean(!document.body.classList.contains('clean'));
    else if (k === 'a') toggleAnswer();
    else if (k === 'n') shuffle();
    else if (LEVELS[k]) setLevel(+k);
  });

  let resizeTimer = 0;
  addEventListener('resize', () => {
    fit();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 160);
  });

  if (!pickType()) status('이 브라우저는 영상 저장을 지원하지 않아요. 화면 녹화로 찍어 주세요.');
  render(); sync();
  // the words are drawn on the canvas, so draw again once the fonts have arrived
  fontsReady().then(show);
})();
