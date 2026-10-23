/* fl.own 화면: 꽃 고르기, 3D 작업대, 저장과 공유 */
(function () {
  const { FLOWERS, WRAPS, RIBBONS, HEAD, buildBouquet } = window.FLOWN;
  const $ = (id) => document.getElementById(id);
  const MAX = 30; // 한 다발에 담을 수 있는 송이 수 (supabase-setup.sql과 같아야 해요)
  const DRAFT = 'flown.draft', SAVED = 'flown.saved';

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };

  const cfg = window.FLOWN_CONFIG || {};
  const db = cfg.supabaseUrl && cfg.supabaseKey && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: false } })
    : null;

  // 처음 열면 보이는 예시 꽃다발
  const SAMPLE = {
    items: [
      { t: 'rose', c: '#f07a93' }, { t: 'rose', c: '#f07a93' }, { t: 'rose', c: '#f3ece2' },
      { t: 'rose', c: '#f3ece2' }, { t: 'tulip', c: '#f5a3b6' }, { t: 'hydrangea', c: '#b4a0df' },
      { t: 'lily', c: '#fbf8f0' }, { t: 'lavender', c: '#8668c6' }, { t: 'lavender', c: '#8668c6' },
      { t: 'gypsophila', c: '#fbfbf7' }, { t: 'gypsophila', c: '#fbfbf7' }, { t: 'gypsophila', c: '#fbfbf7' },
      { t: 'eucalyptus', c: '#7f998b' }, { t: 'eucalyptus', c: '#7f998b' }, { t: 'eucalyptus', c: '#7f998b' },
    ],
    wrap: '#c49a6c', ribbon: '#f3ead9', seed: 7,
    to: '엄마에게', msg: '늘 고마워요.\n오늘은 꽃처럼 웃는 하루 보내요.', from: '막내가',
  };

  let state = store.get(DRAFT, null) || structuredClone(SAMPLE);
  let picked = -1, popIdx = -1, popAt = 0;

  /* ---------- 3D 작업대 ---------- */
  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.9, 8.2);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 13;
  controls.maxPolarAngle = Math.PI * 0.62;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.7;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa394, 0.95));
  const sun = new THREE.DirectionalLight(0xfff4e6, 0.95);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
  fill.position.set(-4, 2, -3);
  scene.add(fill);

  // 바닥에 비치는 옅은 그림자
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.8;
  scene.add(ground);

  let bouquet = null;
  function rebuild() {
    if (bouquet) scene.remove(bouquet);
    bouquet = buildBouquet(state);
    scene.add(bouquet);
    highlight();
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 좁은 화면에서도 꽃다발 전체가 들어오게
    camera.position.copy(controls.target).add(new THREE.Vector3(0, 0.15, 1).normalize().multiplyScalar(w / h < 0.8 ? 12.5 : 9.6));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  (function loop(now) {
    requestAnimationFrame(loop);
    if (bouquet && popIdx >= 0) {
      const k = Math.min(1, (now - popAt) / 450);
      const f = bouquet.children.find((c) => c.userData.idx === popIdx);
      if (f) f.userData.head.scale.setScalar(FLOWERS[state.items[popIdx].t].size * HEAD * (1 - Math.pow(1 - k, 3)));
      if (k >= 1) popIdx = -1;
    }
    controls.update();
    renderer.render(scene, camera);
  })(performance.now());

  // 누른 자리의 꽃 고르기 (끌어서 돌린 건 무시)
  const ray = new THREE.Raycaster();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    const hit = ray.intersectObjects(bouquet.children, true)[0];
    let o = hit && hit.object;
    while (o && o.userData.idx === undefined) o = o.parent;
    picked = o ? o.userData.idx : -1;
    highlight();
  });

  function highlight() {
    const box = $('picked');
    if (picked < 0 || !state.items[picked]) { box.hidden = true; picked = -1; return; }
    const it = state.items[picked], f = FLOWERS[it.t];
    const cname = (f.colors.find((c) => c[0] === it.c) || [, ''])[1];
    $('pickedDot').style.background = it.c;
    $('pickedText').textContent = `${cname} ${f.name} · ${f.mean}`;
    box.hidden = false;
  }

  /* ---------- 선반 ---------- */
  function swatch(hex, label, pressed, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw';
    b.style.background = hex;
    b.title = label;
    b.setAttribute('aria-label', label);
    if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderShelf() {
    const list = $('flowers');
    list.textContent = '';
    for (const [t, f] of Object.entries(FLOWERS)) {
      const n = state.items.filter((it) => it.t === t).length;
      const card = document.createElement('div');
      card.className = 'flower';
      card.innerHTML = `<div class="name"><strong></strong><span class="n"></span></div><p class="mean"></p><div class="swatches"></div>`;
      card.querySelector('strong').textContent = f.name;
      card.querySelector('.n').textContent = n ? `${n}송이` : '';
      card.querySelector('.mean').textContent = f.mean;
      const sws = card.querySelector('.swatches');
      for (const [hex, cname] of f.colors) sws.append(swatch(hex, `${cname} ${f.name} 담기`, null, () => add(t, hex)));
      list.append(card);
    }
    $('total').textContent = `${state.items.length} / ${MAX}송이`;

    const wraps = $('wraps');
    wraps.textContent = '';
    for (const [hex, name] of WRAPS) wraps.append(swatch(hex, `${name} 포장지`, state.wrap === hex, () => { state.wrap = hex; changed(); }));
    const ribbons = $('ribbons');
    ribbons.textContent = '';
    for (const [hex, name] of RIBBONS) ribbons.append(swatch(hex, `${name} 리본`, state.ribbon === hex, () => { state.ribbon = hex; changed(); }));
  }

  function renderTag() {
    $('tagTo').textContent = state.to ? `To. ${state.to}` : '';
    $('tagMsg').textContent = state.msg || '카드에 남길 한마디를 적어 보세요';
    $('tagFrom').textContent = state.from ? `From. ${state.from}` : '';
  }

  function say(text) { $('status').textContent = text; }

  function changed(opts = {}) {
    store.set(DRAFT, state);
    renderShelf();
    renderTag();
    if (!opts.textOnly) rebuild();
  }

  function add(t, c) {
    if (state.items.length >= MAX) { say(`한 다발엔 ${MAX}송이까지 담을 수 있어요. 꽃을 눌러 몇 송이를 빼 주세요.`); return; }
    state.items.push({ t, c });
    popIdx = state.items.length - 1;
    popAt = performance.now();
    picked = -1;
    say(`${FLOWERS[t].name} 한 송이를 담았어요.`);
    changed();
  }

  $('removeOne').addEventListener('click', () => {
    if (picked < 0) return;
    const [it] = state.items.splice(picked, 1);
    picked = -1;
    say(`${FLOWERS[it.t].name} 한 송이를 뺐어요.`);
    changed();
  });
  $('shuffle').addEventListener('click', () => { state.seed = (Math.random() * 1e6) | 0; changed(); });
  $('clear').addEventListener('click', () => { state.items = []; picked = -1; say('꽃을 모두 뺐어요. 위에서 색을 눌러 다시 담아 보세요.'); changed(); });
  $('random').addEventListener('click', () => {
    const types = Object.keys(FLOWERS);
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const focal = types.filter((t) => FLOWERS[t].focal);
    const main = pick(focal), second = pick(focal), mainC = pick(FLOWERS[main].colors)[0];
    const items = [];
    for (let i = 0; i < 5; i++) items.push({ t: main, c: mainC });
    for (let i = 0; i < 3; i++) items.push({ t: second, c: pick(FLOWERS[second].colors)[0] });
    const filler = pick(['gypsophila', 'lavender', 'daisy']);
    for (let i = 0; i < 3; i++) items.push({ t: filler, c: FLOWERS[filler].colors[0][0] });
    for (let i = 0; i < 3; i++) items.push({ t: 'eucalyptus', c: FLOWERS.eucalyptus.colors[0][0] });
    Object.assign(state, { items, wrap: pick(WRAPS)[0], ribbon: pick(RIBBONS)[0], seed: (Math.random() * 1e6) | 0 });
    picked = -1;
    say('');
    changed();
  });
  for (const id of ['to', 'msg', 'from']) {
    $(id).addEventListener('input', (e) => { state[id] = e.target.value; changed({ textOnly: true }); });
  }

  /* ---------- 저장 ---------- */
  function thumb() {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 180; c.height = 240;
    const s = Math.min(src.width / 3, src.height / 4);
    c.getContext('2d').drawImage(src, (src.width - 3 * s) / 2, (src.height - 4 * s) / 2, 3 * s, 4 * s, 0, 0, 180, 240);
    return c.toDataURL('image/webp', 0.7);
  }

  const payload = () => ({
    items: state.items, wrap: state.wrap, ribbon: state.ribbon, seed: state.seed | 0,
    to_name: state.to || '', message: state.msg || '', from_name: state.from || '',
  });

  function shareLink(id) {
    const url = new URL(location.href);
    url.search = '?b=' + id;
    url.hash = '';
    return url.toString();
  }

  $('save').addEventListener('click', async () => {
    if (!state.items.length) { say('꽃을 한 송이 이상 담아야 저장할 수 있어요.'); return; }
    const btn = $('save');
    btn.disabled = true;
    let id = null;
    if (db) {
      say('저장하는 중이에요…');
      const { data, error } = await db.rpc('save_bouquet', { p: payload() });
      if (error) { say('저장하지 못했어요: ' + error.message); btn.disabled = false; return; }
      id = data;
    }
    const saved = store.get(SAVED, []);
    saved.unshift({ id, at: Date.now(), thumb: thumb(), state: structuredClone(state) });
    const kept = store.set(SAVED, saved.slice(0, 12));
    btn.disabled = false;
    renderSaved();
    if (id) {
      $('shareUrl').value = shareLink(id);
      $('share').hidden = false;
      say('저장했어요. 이 링크를 보내면 받는 사람도 같은 꽃다발을 볼 수 있어요.');
    } else {
      $('share').hidden = true;
      say(kept ? '이 브라우저에 저장했어요. (미리보기 모드라 공유 링크는 만들지 않아요)' : '이 브라우저는 저장을 막아 두었어요. 화면을 닫으면 사라져요.');
    }
  });

  $('copy').addEventListener('click', () => {
    const input = $('shareUrl');
    navigator.clipboard.writeText(input.value).then(() => say('링크를 복사했어요.'), () => { input.select(); say('링크를 선택해 두었어요. 직접 복사해 주세요.'); });
  });

  function renderSaved() {
    const box = $('saved');
    box.textContent = '';
    const saved = store.get(SAVED, []);
    if (!saved.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '저장한 꽃다발이 여기에 모여요.';
      box.append(p);
      box.style.display = 'block';
      return;
    }
    box.style.display = '';
    for (const s of saved) {
      const b = document.createElement('button');
      b.type = 'button';
      const when = new Date(s.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
      b.setAttribute('aria-label', `${when}에 저장한 꽃다발 열기`);
      const img = document.createElement('img');
      img.src = s.thumb;
      img.alt = '';
      b.append(img);
      b.addEventListener('click', () => {
        state = structuredClone(s.state);
        fillInputs();
        picked = -1;
        if (s.id) { $('shareUrl').value = shareLink(s.id); $('share').hidden = false; } else $('share').hidden = true;
        say(`${when}에 저장한 꽃다발을 열었어요.`);
        changed();
      });
      box.append(b);
    }
  }

  function fillInputs() {
    $('to').value = state.to || '';
    $('msg').value = state.msg || '';
    $('from').value = state.from || '';
  }

  // 공유 링크(?b=...)로 들어오면 그 꽃다발을 펼쳐 보여 줘요
  async function openShared() {
    const id = new URLSearchParams(location.search).get('b');
    if (!id || !db) return;
    say('꽃다발을 펼치는 중이에요…');
    const { data, error } = await db.rpc('get_bouquet', { bid: id });
    if (error || !data) { say('이 링크의 꽃다발을 찾지 못했어요.'); return; }
    state = { items: data.items, wrap: data.wrap, ribbon: data.ribbon, seed: data.seed, to: data.to_name || '', msg: data.message || '', from: data.from_name || '' };
    fillInputs();
    say('누군가 보낸 꽃다발이에요. 꽃을 더 담아 내 꽃다발로 만들 수도 있어요.');
    changed();
  }

  fillInputs();
  renderShelf();
  renderTag();
  renderSaved();
  resize();
  rebuild();
  openShared();
})();
