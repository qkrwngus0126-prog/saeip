/* 하늘: 시간대, 계절, 날씨에 따라 들판의 빛과 화면 위에 떠다니는 것들을 바꿉니다.
   - 시간대: 새벽 5–7시 · 낮 7–17시 · 해 질 녘 17–19시 · 밤 19–5시 (방문자 컴퓨터의 시계 기준)
   - 계절: 봄 3–5월 · 여름 6–8월 · 가을 9–11월 · 겨울 12–2월 (남반구에서는 반대로)
   - 날씨: Open-Meteo(무료, 키 없음)에서 지금 날씨를 가져와요. 위치는 묻지 않고, 방문자 컴퓨터의 시간대 도시
     (예: Asia/Seoul → 서울, America/New_York → 뉴욕)로 정해요. 도움말 창에서 켜면 실제 위치를 써요.
   도움말 창에서 셋 다 직접 고를 수도 있어요.

   Sky.set(kind, value)   kind: 'time' | 'season' | 'weather' | 'geo'
   Sky.choice(kind)       Sky.state()    Sky.onChange(fn)    Sky.mount(canvas) */
(function () {
  const root = document.documentElement;
  const KEYS = { time: 'happy:time', season: 'happy:season', weather: 'happy:weather', geo: 'happy:geo' };
  const THEME = { dawn: '#1a1820', day: '#eef0e4', dusk: '#21170f', night: '#0b1017' };
  const SEOUL = { lat: 37.57, lon: 126.98, name: 'Seoul' };
  let here = SEOUL; // the place whose weather and seasons the meadow shows
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const listeners = [];
  let state = null, liveWeather = 'clear';

  const read = k => { try { return localStorage.getItem(KEYS[k]) || 'auto'; } catch (_) { return 'auto'; } };
  const write = (k, v) => { try { if (v === 'auto') localStorage.removeItem(KEYS[k]); else localStorage.setItem(KEYS[k], v); } catch (_) { /* 이번 방문에만 */ } };

  function byClock(d = new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 17) return 'day';
    if (h >= 17 && h < 19) return 'dusk';
    return 'night';
  }
  function byMonth(d = new Date()) {
    let m = d.getMonth() + 1;
    if (here.lat < 0) m = (m + 5) % 12 + 1; // south of the equator, spring comes in September
    return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  }

  function apply() {
    const t = read('time'), se = read('season'), w = read('weather');
    const next = {
      phase: t === 'auto' ? byClock() : t,
      season: se === 'auto' ? byMonth() : se,
      weather: w === 'auto' ? liveWeather : w,
    };
    if (state && next.phase === state.phase && next.season === state.season && next.weather === state.weather) return;
    state = next;
    root.dataset.time = state.phase;
    root.dataset.season = state.season;
    root.dataset.weather = state.weather;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME[state.phase];
    air.set(state);
    for (const fn of listeners) fn(state);
  }

  /* ---------- weather: the WMO code from Open-Meteo, kept for 20 minutes ---------- */
  function kindOf(code) {
    if (code >= 71 && code <= 77 || code === 85 || code === 86) return 'snow';
    if (code >= 51 && code <= 67 || code >= 80 && code <= 82 || code >= 95) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code === 2 || code === 3) return 'cloud';
    return 'clear';
  }
  // without asking anyone: the city of the computer's time zone, looked up once with Open-Meteo's place search and kept
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } })();
  async function zoneCity() {
    if (!TZ || TZ === 'Asia/Seoul' || !TZ.includes('/')) return SEOUL;
    const key = 'happy:zone:' + TZ + ':' + ((window.I18N && window.I18N.lang) || 'en');
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) return c; } catch (_) { /* 다시 찾아요 */ }
    const name = TZ.split('/').pop().replace(/_/g, ' ');
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=${(window.I18N && window.I18N.lang) || 'en'}&format=json`);
      const j = r.ok ? await r.json() : null;
      const g = j && j.results && j.results[0];
      if (!g) return SEOUL;
      const c = { lat: Math.round(g.latitude * 10) / 10, lon: Math.round(g.longitude * 10) / 10, name: g.name };
      try { localStorage.setItem(key, JSON.stringify(c)); } catch (_) { /* 괜찮아요 */ }
      return c;
    } catch (_) { return SEOUL; }
  }
  async function where() {
    if (read('geo') !== 'on' || !navigator.geolocation) return zoneCity();
    return new Promise(res => navigator.geolocation.getCurrentPosition(
      p => res({ lat: Math.round(p.coords.latitude * 10) / 10, lon: Math.round(p.coords.longitude * 10) / 10, name: '' }), // 약 10km 단위로 흐리게
      () => res(zoneCity()), { maximumAge: 3600000, timeout: 8000 }));
  }
  async function fetchWeather(force) {
    const cacheKey = 'happy:weather-cache';
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (!force && c && Date.now() - c.at < 20 * 60 * 1000 && c.geo === read('geo') && c.tz === TZ) { liveWeather = c.kind; if (c.here) here = c.here; state = null; apply(); return; }
    } catch (_) { /* 저장소를 못 쓰면 매번 물어봐요 */ }
    try {
      here = await where();
      const { lat, lon } = here;
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code&timezone=auto`);
      if (!r.ok) return;
      const j = await r.json();
      liveWeather = kindOf(j.current && j.current.weather_code);
      try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), kind: liveWeather, geo: read('geo'), tz: TZ, here })); } catch (_) { /* 괜찮아요 */ }
      state = null; apply(); // the season may change too, if the place is south of the equator
    } catch (_) { /* 날씨를 못 가져오면 맑음으로 둬요 */ }
  }

  /* ---------- the air above the field: fireflies, rain, snow, petals, falling leaves, dew sparkles ---------- */
  const air = (() => {
    let canvas = null, ctx = null, W = 0, H = 0, raf = 0, last = 0, mix = {}, list = [];
    const ADD = {
      fly: () => ({ k: 'fly', x: Math.random() * W, y: Math.random() * H, a: Math.random() * 6.3, sp: 0.15 + Math.random() * 0.35, ph: Math.random() * 6.3, rate: 0.6 + Math.random() * 0.9, r: 1.4 + Math.random() * 1.4 }),
      rain: () => ({ k: 'rain', x: Math.random() * (W + 200) - 100, y: Math.random() * H, sp: 13 + Math.random() * 7, len: 10 + Math.random() * 12 }),
      snow: () => ({ k: 'snow', x: Math.random() * W, y: Math.random() * H, sp: 0.5 + Math.random() * 0.9, r: 1 + Math.random() * 2.2, ph: Math.random() * 6.3 }),
      petal: () => ({ k: 'petal', x: Math.random() * W, y: Math.random() * H, sp: 0.5 + Math.random() * 0.6, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 0.06, ph: Math.random() * 6.3,
        col: ['#f6cfdc', '#f2bccd', '#fae0e8'][(Math.random() * 3) | 0] }),
      leaf: () => ({ k: 'leaf', x: Math.random() * W, y: Math.random() * H, sp: 0.6 + Math.random() * 0.7, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 0.05, ph: Math.random() * 6.3,
        col: ['#d9822b', '#b8432f', '#e0b23a', '#a8642a'][(Math.random() * 4) | 0] }),
      dew: () => ({ k: 'dew', x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6.3, rate: 0.5 + Math.random() * 1.2 }),
    };
    function counts(s) {
      const area = W * H / 1e6; // about 1 for a laptop screen
      const wet = s.weather === 'rain' || s.weather === 'snow';
      return {
        fly: wet ? 0 : Math.round(Math.min(40, area * 28) * (s.phase === 'night' ? 1 : s.phase === 'dusk' ? 0.35 : 0)),
        rain: s.weather === 'rain' ? Math.round(area * 140) : 0,
        snow: s.weather === 'snow' ? Math.round(area * 90) : 0,
        petal: s.season === 'spring' && !wet ? Math.round(area * 14) : 0,
        leaf: s.season === 'autumn' && !wet ? Math.round(area * 9) : 0,
        dew: s.phase === 'dawn' && !wet ? Math.round(area * 22) : 0,
      };
    }
    function fill() {
      if (!state) return;
      const want = counts(state);
      list = list.filter(p => { if (want[p.k] > 0) { want[p.k]--; return true; } return false; });
      for (const k in want) for (let i = 0; i < want[k]; i++) list.push(ADD[k]());
    }
    function size() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W); canvas.height = Math.round(H);
      list = []; fill();
    }
    function draw(now, dt, moving) {
      ctx.clearRect(0, 0, W, H);
      const t = now / 1000;
      for (const p of list) {
        if (p.k === 'fly') {
          if (moving) { p.a += (Math.random() - 0.5) * 0.18 * dt; p.x += Math.cos(p.a) * p.sp * dt; p.y += Math.sin(p.a) * p.sp * dt; wrap(p, 10); }
          const g = moving ? Math.max(0, Math.sin(t * p.rate + p.ph)) : 0.6;
          if (g < 0.04) continue;
          glow(p.x, p.y, p.r * 5, `rgba(236,255,170,${0.9 * g})`, `rgba(200,240,120,${0.45 * g})`);
        } else if (p.k === 'rain') {
          if (moving) { p.y += p.sp * dt; p.x += p.sp * 0.18 * dt; if (p.y > H + 20) { p.y = -20; p.x = Math.random() * (W + 200) - 100; } }
          ctx.strokeStyle = 'rgba(200,220,240,0.35)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * 0.18, p.y - p.len); ctx.stroke();
        } else if (p.k === 'snow') {
          if (moving) { p.y += p.sp * dt; p.x += Math.sin(t + p.ph) * 0.4 * dt; wrap(p, 6); }
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
        } else if (p.k === 'petal' || p.k === 'leaf') {
          if (moving) { p.y += p.sp * dt; p.x += (Math.sin(t * 0.8 + p.ph) * 0.8 + 0.3) * dt; p.rot += p.spin * dt; wrap(p, 14); }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
          ctx.globalAlpha = 0.85;
          if (p.k === 'petal') { ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-4.5, 0.8, -3.2, -4, 0, -2.2); ctx.bezierCurveTo(3.2, -4, 4.5, 0.8, 0, 4); ctx.fill(); }
          else { ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = 'rgba(60,30,10,0.4)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke(); }
          ctx.restore();
        } else if (p.k === 'dew') {
          const g = moving ? Math.pow(Math.max(0, Math.sin(t * p.rate + p.ph)), 6) : 0.4;
          if (g < 0.05) continue;
          ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = g; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke();
          glow(0, 0, 3, 'rgba(255,255,255,0.9)', 'rgba(220,240,255,0.3)');
          ctx.restore();
        }
      }
    }
    function wrap(p, m) {
      if (p.x < -m) p.x = W + m; else if (p.x > W + m) p.x = -m;
      if (p.y < -m) p.y = H + m; else if (p.y > H + m) p.y = -m;
    }
    function glow(x, y, R, a, b) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, a); g.addColorStop(0.25, b); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.3); ctx.fill();
    }
    function frame(now) {
      raf = 0;
      if (!list.length || document.hidden) return;
      // 30 frames a second is plenty for things drifting this slowly
      if (now - last < 32) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(3, (now - last) / 16.67) : 1;
      last = now;
      draw(now, dt, true);
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (!canvas) return;
      size();
      if (!list.length) { ctx.clearRect(0, 0, W, H); return; }
      if (reduce) { draw(performance.now(), 0, false); return; } // with reduced motion: a still picture
      last = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', start);
    return {
      mount(el) { canvas = el; ctx = canvas.getContext('2d'); new ResizeObserver(start).observe(canvas); start(); },
      set() { if (canvas) start(); },
    };
  })();

  window.Sky = {
    set(kind, v) {
      write(kind, v);
      if (kind === 'geo' || kind === 'weather' && v === 'auto') fetchWeather(kind === 'geo');
      apply();
    },
    choice: read,
    // the city whose weather the meadow shows, for the help sheet
    placeName: () => {
      const l = (window.I18N && window.I18N.lang) || 'en';
      if (here === SEOUL) return { ko: '서울', ja: 'ソウル', en: 'Seoul' }[l];
      return here.name || { ko: '내 위치', ja: '現在地', en: 'your location' }[l];
    },
    state: () => state,
    mount(el) { air.mount(el); },
    // call fn now and whenever the light changes
    onChange(fn) { listeners.push(fn); if (state) fn(state); },
  };
  apply();
  fetchWeather(false);
  // check the clock once a minute and the weather every 20 minutes, so the field changes while the page stays open
  setInterval(apply, 60 * 1000);
  setInterval(() => fetchWeather(false), 20 * 60 * 1000);
})();
