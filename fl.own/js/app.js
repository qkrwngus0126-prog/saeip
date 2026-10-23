/* fl.own 화면: 꽃 고르기, 3D 무대, 저장과 공유 */
(function () {
  const { FLOWERS, WRAPS, RIBBONS, HEAD, buildBouquet, flowerHead } = window.FLOWN;
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
      { t: 'rose', c: '#f07a93' }, { t: 'rose', c: '#f07a93' }, { t: 'rose', c: '#f07a93' },
      { t: 'rose', c: '#f3ece2' }, { t: 'rose', c: '#f3ece2' }, { t: 'tulip', c: '#f5a3b6' },
      { t: 'tulip', c: '#f5a3b6' }, { t: 'hydrangea', c: '#b4a0df' }, { t: 'lavender', c: '#8668c6' },
      { t: 'lavender', c: '#8668c6' }, { t: 'gypsophila', c: '#fbfbf7' }, { t: 'gypsophila', c: '#fbfbf7' },
      { t: 'gypsophila', c: '#fbfbf7' }, { t: 'eucalyptus', c: '#7f998b' }, { t: 'eucalyptus', c: '#7f998b' },
      { t: 'eucalyptus', c: '#7f998b' },
    ],
    wrap: '#eec0c6', ribbon: '#f3ead9', seed: 7,
    to: '엄마에게', msg: '늘 고마워요.\n오늘은 꽃처럼 웃는 하루 보내요.', from: '막내가',
  };

  let state = store.get(DRAFT, null) || structuredClone(SAMPLE);
  let picked = -1, popIdx = -1, popAt = 0;
  // 꽃마다 지금 고른 색 (처음엔 다발에 이미 든 색, 없으면 첫 색)
  const sel = {};
  for (const [t, f] of Object.entries(FLOWERS)) sel[t] = (state.items.find((it) => it.t === t) || { c: f.colors[0][0] }).c;

  /* ---------- 3D 무대 ---------- */
  function makeRenderer(opts) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, ...opts });
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.NoToneMapping;
    return r;
  }
  function lights(scene, renderer) {
    // 사진 스튜디오처럼 부드러운 반사광 + 위쪽 주광 + 뒤쪽 테두리 빛
    scene.add(new THREE.HemisphereLight(0xfffaf5, 0xd9cfd2, 0.5));
    const key = new THREE.DirectionalLight(0xfff4ea, 1.05);
    key.position.set(2.5, 6, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf2f0ff, 0.25);
    rim.position.set(-3, 3, -5);
    scene.add(rim);
  }

  const stage = $('stage');
  const renderer = makeRenderer({ preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  lights(scene, renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 12;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.6;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.6;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  // 바닥에 비치는 옅은 그림자
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(40,20,25,0.35)');
    grad.addColorStop(1, 'rgba(40,20,25,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
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
    const dist = w / h < 0.8 ? 11 : 9; // 좁은 화면에서도 꽃다발 전체가 들어오게
    camera.position.copy(controls.target).add(new THREE.Vector3(0, 0.22, 1).normalize().multiplyScalar(dist));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  (function loop(now) {
    requestAnimationFrame(loop);
    if (bouquet && popIdx >= 0) {
      const k = Math.min(1, (now - popAt) / 500);
      const f = bouquet.children.find((c) => c.userData.idx === popIdx);
      const ease = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // 살짝 튀어나왔다 자리 잡기
      if (f) f.userData.head.scale.setScalar(FLOWERS[state.items[popIdx].t].size * HEAD * ease);
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

  const colorName = (t, c) => (FLOWERS[t].colors.find((x) => x[0] === c) || [, ''])[1];
  function highlight() {
    const box = $('picked');
    if (picked < 0 || !state.items[picked]) { box.hidden = true; picked = -1; return; }
    const it = state.items[picked], f = FLOWERS[it.t];
    $('pickedDot').style.background = it.c;
    $('pickedText').textContent = `${colorName(it.t, it.c)} ${f.name} · ${f.mean}`;
    box.hidden = false;
  }

  /* ---------- 꽃 썸네일: 같은 3D 꽃을 작은 화면에 한 번씩 찍어 둬요 ---------- */
  const thumbs = {};
  const shot = (() => {
    const size = 152;
    let r = null, sc = null, cam = null;
    return (t, c) => {
      const key = t + c;
      if (thumbs[key]) return thumbs[key];
      if (!r) {
        r = makeRenderer({ preserveDrawingBuffer: true });
        r.setSize(size, size, false);
        sc = new THREE.Scene();
        lights(sc, r);
        cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
      }
      const h = flowerHead(t, c);
      h.rotation.set(0.75, 0.4, 0);
      sc.add(h);
      const box = new THREE.Box3().setFromObject(h);
      const ctr = box.getCenter(new THREE.Vector3()), rad = box.getSize(new THREE.Vector3()).length() / 2;
      cam.position.copy(ctr).add(new THREE.Vector3(0, 0.15, 1).normalize().multiplyScalar(rad / Math.sin((15 * Math.PI) / 180) * 0.62));
      cam.lookAt(ctr);
      r.render(sc, cam);
      sc.remove(h);
      return (thumbs[key] = r.domElement.toDataURL('image/png'));
    };
  })();

  /* ---------- 주문서 ---------- */
  const tabs = ['flowers', 'wrap', 'card', 'saved'];
  for (const name of tabs) {
    $('tab-' + name).addEventListener('click', () => {
      for (const n of tabs) {
        $('tab-' + n).setAttribute('aria-selected', String(n === name));
        $('pane-' + n).hidden = n !== name;
      }
    });
  }

  function renderMenu() {
    const list = $('flowers');
    list.textContent = '';
    for (const [t, f] of Object.entries(FLOWERS)) {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="thumb"><img alt=""></div>
        <div class="info">
          <div class="name"><strong></strong><em></em></div>
          <div class="chips"></div>
        </div>
        <div class="stepper">
          <button type="button" class="sub">−</button>
          <output></output>
          <button type="button" class="add">+</button>
        </div>`;
      li.querySelector('img').src = shot(t, sel[t]);
      li.querySelector('strong').textContent = f.name;
      li.querySelector('em').textContent = f.mean;
      const chips = li.querySelector('.chips');
      for (const [hex, cname] of f.colors) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.style.background = hex;
        b.title = cname;
        b.setAttribute('aria-label', `${cname} ${f.name}`);
        b.setAttribute('aria-pressed', String(sel[t] === hex));
        b.addEventListener('click', () => { sel[t] = hex; renderMenu(); });
        chips.append(b);
      }
      const n = state.items.filter((it) => it.t === t).length;
      li.querySelector('output').textContent = n;
      const sub = li.querySelector('.sub'), add = li.querySelector('.add');
      sub.disabled = !n;
      add.disabled = state.items.length >= MAX;
      sub.setAttribute('aria-label', `${f.name} 한 송이 빼기`);
      add.setAttribute('aria-label', `${colorName(t, sel[t])} ${f.name} 한 송이 담기`);
      sub.addEventListener('click', () => removeOneOf(t));
      add.addEventListener('click', () => addFlower(t, sel[t]));
      list.append(li);
    }
  }

  function renderWrap() {
    const wraps = $('wraps');
    wraps.textContent = '';
    for (const [hex, name] of WRAPS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'paper';
      b.setAttribute('aria-pressed', String(state.wrap === hex));
      b.innerHTML = '<span class="sheet"></span>';
      b.querySelector('.sheet').style.background = hex;
      b.append(name);
      b.addEventListener('click', () => { state.wrap = hex; changed(); });
      wraps.append(b);
    }
    const ribbons = $('ribbons');
    ribbons.textContent = '';
    for (const [hex, name] of RIBBONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ribbon';
      b.setAttribute('aria-pressed', String(state.ribbon === hex));
      b.innerHTML = '<i></i>';
      b.querySelector('i').style.background = hex;
      b.append(name);
      b.addEventListener('click', () => { state.ribbon = hex; changed(); });
      ribbons.append(b);
    }
  }

  function renderTag() {
    $('tagTo').textContent = state.to ? `To. ${state.to}` : '';
    $('tagMsg').textContent = state.msg || '카드 탭에서 한마디를 적어 보세요';
    $('tagFrom').textContent = state.from ? `From. ${state.from}` : '';
    $('msgLen').textContent = `${(state.msg || '').length} / 200`;
  }

  function say(text) { $('status').textContent = text; }

  function changed(opts = {}) {
    store.set(DRAFT, state);
    $('total').textContent = state.items.length;
    renderMenu();
    renderWrap();
    renderTag();
    if (!opts.textOnly) rebuild();
  }

  function addFlower(t, c) {
    if (state.items.length >= MAX) { say(`한 다발엔 ${MAX}송이까지 담을 수 있어요.`); return; }
    state.items.push({ t, c });
    popIdx = state.items.length - 1;
    popAt = performance.now();
    picked = -1;
    say('');
    changed();
  }

  // 지금 고른 색이 있으면 그 색을, 없으면 가장 나중에 담은 같은 꽃을 빼요
  function removeOneOf(t) {
    let i = state.items.map((it) => it.t === t && it.c === sel[t]).lastIndexOf(true);
    if (i < 0) i = state.items.map((it) => it.t === t).lastIndexOf(true);
    if (i < 0) return;
    state.items.splice(i, 1);
    picked = -1;
    changed();
  }

  $('removeOne').addEventListener('click', () => {
    if (picked < 0) return;
    state.items.splice(picked, 1);
    picked = -1;
    changed();
  });
  $('shuffle').addEventListener('click', () => { state.seed = (Math.random() * 1e6) | 0; changed(); });
  $('clear').addEventListener('click', () => { state.items = []; picked = -1; say('꽃을 모두 뺐어요. + 를 눌러 다시 담아 보세요.'); changed(); });
  $('random').addEventListener('click', () => {
    const types = Object.keys(FLOWERS);
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const focal = types.filter((t) => FLOWERS[t].focal);
    const main = pick(focal), second = pick(focal.filter((t) => t !== main)), mainC = pick(FLOWERS[main].colors)[0];
    const items = [];
    for (let i = 0; i < 5; i++) items.push({ t: main, c: mainC });
    const secondC = pick(FLOWERS[second].colors)[0];
    for (let i = 0; i < 3; i++) items.push({ t: second, c: secondC });
    const filler = pick(['gypsophila', 'lavender', 'daisy']);
    for (let i = 0; i < 4; i++) items.push({ t: filler, c: FLOWERS[filler].colors[0][0] });
    for (let i = 0; i < 3; i++) items.push({ t: 'eucalyptus', c: FLOWERS.eucalyptus.colors[0][0] });
    Object.assign(state, { items, wrap: pick(WRAPS)[0], ribbon: pick(RIBBONS)[0], seed: (Math.random() * 1e6) | 0 });
    for (const it of items) sel[it.t] = it.c;
    picked = -1;
    say('');
    changed();
  });
  for (const id of ['to', 'msg', 'from']) {
    $(id).addEventListener('input', (e) => { state[id] = e.target.value; changed({ textOnly: true }); });
  }

  /* ---------- 저장 ---------- */
  function snapshot() {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 180; c.height = 240;
    const s = Math.min(src.width / 3, src.height / 4);
    c.getContext('2d').drawImage(src, (src.width - 3 * s) / 2, (src.height - 4 * s) / 2, 3 * s, 4 * s, 0, 0, 180, 240);
    return c.toDataURL('image/webp', 0.75);
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
    saved.unshift({ id, at: Date.now(), thumb: snapshot(), state: structuredClone(state) });
    const kept = store.set(SAVED, saved.slice(0, 12));
    btn.disabled = false;
    renderSaved();
    if (id) {
      $('shareUrl').value = shareLink(id);
      $('share').hidden = false;
      say('저장했어요. 이 링크를 보내면 받는 사람도 같은 꽃다발을 볼 수 있어요.');
    } else {
      $('share').hidden = true;
      say(kept ? '보관함에 저장했어요. (미리보기 모드라 이 브라우저에만 남아요)' : '이 브라우저는 저장을 막아 두었어요. 화면을 닫으면 사라져요.');
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
      p.textContent = '저장한 꽃다발이 여기에 모여요. 아래 버튼으로 첫 꽃다발을 저장해 보세요.';
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
  resize();
  changed({ textOnly: true });
  rebuild();
  renderSaved();
  openShared();
})();
