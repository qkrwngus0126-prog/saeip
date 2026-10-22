/* 10초 세잎클로버 찾기 챌린지 (challenge.html, 인스타 릴스 녹화용).
   saeip 들판(js/field.js)의 잎 그림, 흙, 시간대 빛을 그대로 옮겨 와서 9:16 화면 한 장에 멈춘 들판을 그립니다.
   네잎클로버 사이에 세잎클로버가 딱 하나 있어요. 같은 시드와 레벨이면 언제나 똑같은 들판이 나와요.
   주소에 ?seed=123456&level=2 를 붙이면 그 배치를 바로 불러옵니다.

   흐름: 시작 → 1초 뒤 10초 카운트다운 → "찾았으면 댓글에 위치 남겨줘" → 엔딩 → 처음 화면으로
   레벨: 1 많이 확대 · 2 중간 · 3 사이트 들판 크기 그대로 (휴대폰 한 화면에 보이는 만큼) */
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

  /* ---------- the page ---------- */
  const $ = id => document.getElementById(id);
  const stage = $('stage'), canvas = $('meadow'), ctx = canvas.getContext('2d');
  const numEl = $('num'), barEl = $('bar'), timerEl = $('timer'), answerEl = $('answer');

  const q = new URLSearchParams(location.search);
  const newSeed = () => 100000 + Math.floor(Math.random() * 900000);
  const cleanSeed = v => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return n > 0 && n < 1e9 ? n : 0; };
  let seed = cleanSeed(q.get('seed')) || newSeed();
  let level = LEVELS[q.get('level')] ? +q.get('level') : 1;
  let lightPhase = HOURS[q.get('light')] ? q.get('light') : 'day';
  let layout = null, sprites = null, spriteKey = '', three = null, threeKey = '';

  function fit() {
    const s = Math.min(innerWidth / DW, innerHeight / DH);
    stage.style.setProperty('--s', s);
    return s;
  }

  // paint the whole meadow once; nothing on it moves, so the countdown only ever animates the words above it
  function render() {
    const s = fit();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const pw = Math.max(360, Math.min(1440, Math.round(DW * s * dpr)));
    const ph = Math.round(pw * DH / DW);
    if (!layout || layout.seed !== seed || layout.level !== level) layout = buildLayout(seed, level);
    const { W, H, items } = layout;
    px = pw / W;
    const sk = seed + ':' + px.toFixed(3);
    if (sk !== spriteKey) { sprites = buildSprites(seed); spriteKey = sk; threeKey = ''; }
    const tk = sk + ':' + level;
    if (tk !== threeKey) { three = makeThree(seed, level, layout.three); threeKey = tk; }

    canvas.width = pw; canvas.height = ph;
    ctx.setTransform(px, 0, 0, px, 0, 0);
    rnd = seeded(seed * 17 + level);
    paintSoil(ctx, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    const put = (img, x, y, size) => ctx.drawImage(img, x * px - size / 2, y * px - size / 2, size, size);
    const t = layout.three;
    let i = 0;
    for (; i < items.length && items[i].z < t.z; i++) {
      const l = items[i];
      put(l.grass ? sprites.grass[l.tier][l.v] : sprites.clover[l.tier][l.v], l.x, l.y, SPRITE * l.s * px);
    }
    put(three, t.x, t.y, SPRITE * t.s * px);
    for (; i < items.length; i++) {
      const l = items[i];
      put(l.grass ? sprites.grass[l.tier][l.v] : sprites.clover[l.tier][l.v], l.x, l.y, SPRITE * l.s * px);
    }
    // the light of the hour, as the site paints it into the field
    for (const [op, color] of HOURS[lightPhase]) { ctx.globalCompositeOperation = op; ctx.fillStyle = color; ctx.fillRect(0, 0, pw, ph); }
    ctx.globalCompositeOperation = 'source-over';
    stage.dataset.light = lightPhase;

    // the answer ring, in stage pixels
    const k = DW / W, d = SPRITE * t.s * 0.29 * 2 * k * 1.55;
    answerEl.style.left = t.x * k + 'px';
    answerEl.style.top = t.y * k + 'px';
    answerEl.style.width = answerEl.style.height = d + 'px';
  }

  /* ---------- the countdown, driven by one animation frame loop ---------- */
  let phase = 'ready', t0 = 0, raf = 0, shown = -1;
  const setBar = f => { barEl.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`; };
  function setNum(n, pop) {
    if (n === shown) return;
    shown = n;
    numEl.textContent = n;
    timerEl.classList.toggle('hot', n <= 3 && phase === 'count');
    if (pop && !reduce) { numEl.classList.remove('tick'); void numEl.offsetWidth; numEl.classList.add('tick'); }
  }
  function enter(p, now) {
    phase = p; t0 = now;
    stage.dataset.phase = p === 'ask' || p === 'end' ? p : 'play';
  }
  function frame(now) {
    const el = now - t0;
    if (phase === 'pre' && el >= T.delay) enter('count', t0 + T.delay);
    if (phase === 'count') {
      const rem = Math.max(0, T.count - (now - t0));
      setBar(rem / T.count);
      setNum(Math.ceil(rem / 1000), true);
      if (rem <= 0) enter('zero', t0 + T.count);
    } else if (phase === 'zero' && el >= T.zero) enter('ask', now);
    else if (phase === 'ask' && el >= T.ask) enter('end', now);
    else if (phase === 'end' && el >= T.end) { enter('back', now); timerEl.classList.remove('hot'); }
    else if (phase === 'back') {
      // the bar fills again while the ending fades, so the last frame matches the first
      const f = Math.min(1, el / T.back), e = 1 - Math.pow(1 - f, 3);
      setBar(e);
      setNum(10, false);
      if (f >= 1) { phase = 'ready'; raf = 0; return; }
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (phase !== 'ready') return;
    enter('pre', performance.now());
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function reset() {
    cancelAnimationFrame(raf); raf = 0;
    phase = 'ready'; stage.dataset.phase = 'play';
    timerEl.classList.remove('hot');
    shown = -1; setNum(10, false); setBar(1);
  }

  /* ---------- controls ---------- */
  const panel = $('panel'), unhide = $('unhide');
  function sync() {
    $('seed-now').textContent = seed;
    $('level-chip').textContent = 'LEVEL ' + level;
    document.querySelectorAll('#levels button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.level === level)));
    $('light-sel').value = lightPhase;
    const u = new URL(location.href);
    u.searchParams.set('seed', seed); u.searchParams.set('level', level);
    if (lightPhase === 'day') u.searchParams.delete('light'); else u.searchParams.set('light', lightPhase);
    history.replaceState(null, '', u);
  }
  function rebuild() { reset(); render(); sync(); }
  function setLevel(n) { if (LEVELS[n] && n !== level) { level = n; rebuild(); } }
  function shuffle() { seed = newSeed(); rebuild(); }
  function toggleAnswer(on = answerEl.hidden) {
    answerEl.hidden = !on;
    $('answer-btn').setAttribute('aria-pressed', String(on));
    $('answer-btn').textContent = on ? '정답 숨기기' : '정답 보기';
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
  $('hide-btn').addEventListener('click', () => setClean(true));
  unhide.addEventListener('click', () => setClean(false));
  document.querySelectorAll('#levels button').forEach(b => b.addEventListener('click', () => setLevel(+b.dataset.level)));
  $('light-sel').addEventListener('change', e => { lightPhase = e.target.value; render(); sync(); });
  $('chip-chk').addEventListener('change', e => stage.classList.toggle('no-chip', !e.target.checked));
  $('seed-form').addEventListener('submit', e => {
    e.preventDefault();
    const n = cleanSeed($('seed-in').value);
    if (!n) { $('seed-in').focus(); return; }
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
    else if (k === 'escape') reset();
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

  setNum(10, false); setBar(1);
  render(); sync();
})();
