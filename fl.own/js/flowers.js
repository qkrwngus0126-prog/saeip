/* fl.own 3D 꽃
   모든 꽃은 코드로 빚어요(이미지·3D 모델 파일 없음). three.js r147의 전역 THREE를 씁니다.
   window.FLOWN.FLOWERS : 꽃 목록(이름, 꽃말, 고를 수 있는 색)
   window.FLOWN.buildBouquet(state) : 꽃다발 한 다발(THREE.Group)을 만들어 돌려줘요 */
(function () {
  const T = THREE;
  T.ColorManagement.legacyMode = false; // 색 코드(#rrggbb)를 화면에서 보는 색 그대로 쓰게
  const TAU = Math.PI * 2;
  const GOLD = 2.399963; // 황금각(라디안). 해바라기 씨처럼 고르게 흩어 놓을 때 써요

  // 같은 seed면 늘 같은 배치가 나오는 작은 난수
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }

  const col = (c) => new T.Color(c);
  // k < 0 이면 어둡게, k > 0 이면 밝게
  function shade(c, k) {
    const out = new T.Color(c);
    return k < 0 ? out.lerp(new T.Color(0x000000), -k) : out.lerp(new T.Color(0xffffff), k);
  }
  const mix = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k);

  const mats = {};
  const cached = (key, make) => mats[key] || (mats[key] = make());
  // 꽃잎은 벨벳처럼 결이 빛을 받는 재질(sheen)
  const petalMat = () => cached('petal', () => new T.MeshPhysicalMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.55, sheen: 1, sheenRoughness: 0.45, sheenColor: new T.Color('#ffffff'), envMapIntensity: 0.5 }));
  const plain = (hex, rough = 0.7) => cached(hex + '|' + rough, () => new T.MeshStandardMaterial({ color: hex, roughness: rough, side: T.DoubleSide, envMapIntensity: 0.5 }));
  const STEM = '#3f6430';

  /* 꽃잎 한 장. 밑동이 원점이고 +Y로 자라요. 가장자리는 -Z(꽃 안쪽)로 오므라져요.
     cup  : 옆으로 오므린 정도
     bend : 끝이 바깥(+Z)으로 젖혀지는 정도 (음수면 안으로 말려요)
     peak : 가장 넓은 곳의 높이 (0~1)
     tip  : 끝 모양 (작을수록 둥글고, 1보다 크면 뾰족)
     wave : 가장자리 물결
     roll : 꽃잎 끝 양옆이 바깥으로 말리는 정도 (장미) */
  function petal(o) {
    const len = o.len ?? 1, wid = o.wid ?? 0.5, cup = o.cup ?? 0.3, bend = o.bend ?? 0.1;
    const peak = o.peak ?? 0.6, tip = o.tip ?? 0.6, wave = o.wave ?? 0, roll = o.roll ?? 0;
    const nu = o.nu ?? 8, nv = o.nv ?? 12;
    const c0 = col(o.base ?? o.color), c1 = col(o.color), c2 = col(o.edge ?? o.color);
    const sp = Math.log(0.5) / Math.log(peak); // v = peak 에서 가장 넓어지게
    const pos = [], clr = [], idx = [];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      const w = Math.max(0.05, Math.pow(Math.sin(Math.PI * Math.pow(v, sp)), tip));
      const cv = v < 0.5 ? c0.clone().lerp(c1, v * 2) : c1.clone().lerp(c2, (v - 0.5) * 2);
      for (let i = 0; i <= nu; i++) {
        const u = (i / nu) * 2 - 1;
        const half = wid * 0.5 * w;
        let z = -cup * u * u * half * 1.6 + bend * len * v * v;
        if (wave) z += wave * Math.sin(u * 6 + v * 4) * half * v;
        if (roll) z += roll * Math.pow(Math.abs(u), 3) * Math.pow(v, 2) * len;
        pos.push(u * half, v * len, z);
        const k = 1 - 0.1 * Math.abs(u);
        clr.push(cv.r * k, cv.g * k, cv.b * k);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(clr, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // 꽃잎을 꽃 중심 둘레에 붙여요. az: 둘레 방향, tilt: 바깥으로 눕는 각도, r0: 중심에서 떨어진 거리
  function place(group, geo, az, tilt, r0 = 0, y0 = 0, material = petalMat()) {
    const pivot = new T.Group();
    pivot.rotation.y = az;
    pivot.position.y = y0;
    const m = new T.Mesh(geo, material);
    m.position.z = r0;
    m.rotation.x = tilt;
    pivot.add(m);
    group.add(pivot);
    return m;
  }

  function sepals(group, n, len, hex = STEM, tilt = 2.1) {
    const geo = petal({ len, wid: len * 0.35, cup: 0.3, bend: 0.1, peak: 0.35, tip: 1.3, color: hex, base: shade(hex, -0.2), nu: 4, nv: 5 });
    for (let k = 0; k < n; k++) place(group, geo, (k / n) * TAU + 0.3, tilt, 0.02, 0.01);
  }

  // a에서 b까지 가는 막대
  function rod(a, b, r, material) {
    const d = new T.Vector3().subVectors(b, a);
    const m = new T.Mesh(new T.CylinderGeometry(r * 0.8, r, d.length(), 5, 1), material);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return m;
  }

  // 작은 조각을 수백 개 찍을 때 (수국 꽃송이, 해바라기 씨, 라벤더 봉오리, 안개꽃)
  function scatter(geo, material, list) {
    const im = new T.InstancedMesh(geo, material, list.length);
    const m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    list.forEach((it, i) => {
      q.setFromUnitVectors(up, it.n || up);
      if (it.spin) q.multiply(new T.Quaternion().setFromAxisAngle(up, it.spin));
      m.compose(it.p, q, it.s || new T.Vector3(1, 1, 1));
      im.setMatrixAt(i, m);
      if (it.c) im.setColorAt(i, col(it.c));
    });
    return im;
  }

  // 여러 메시를 한 덩어리 지오메트리로 굳혀요 (수국 꽃 한 송이를 인스턴스로 찍으려고)
  function bake(group) {
    group.updateMatrixWorld(true);
    const pos = [], nor = [], clr = [], idx = [];
    group.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const base = pos.length / 3;
      pos.push(...g.attributes.position.array);
      nor.push(...g.attributes.normal.array);
      clr.push(...g.attributes.color.array);
      g.index.array.forEach((v) => idx.push(v + base));
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new T.Float32BufferAttribute(clr, 3));
    out.setIndex(idx);
    return out;
  }

  /* ---------- 꽃 한 송이씩. 모두 +Y를 바라보고, 원점이 꽃대 끝이에요 ---------- */

  function rose(c) {
    const g = new T.Group();
    const n = 32;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const geo = petal({
        len: 0.19 + 0.2 * t, wid: 0.2 + 0.32 * t, cup: 1.0 - 0.5 * t, bend: -0.16 + 0.3 * t * t,
        roll: 0.05 + 0.3 * t * t, peak: 0.66, tip: 0.3,
        base: mix(shade(c, -0.35), '#d8c27a', 0.15), color: c, edge: shade(c, t > 0.5 ? 0.12 : -0.12), wave: 0.04 * t,
      });
      place(g, geo, k * GOLD, 0.04 + 0.95 * Math.pow(t, 1.7), 0.01 + 0.06 * t, -0.05 * t);
    }
    sepals(g, 5, 0.2);
    return g;
  }

  function tulip(c) {
    const g = new T.Group();
    for (let ring = 0; ring < 2; ring++) {
      const geo = petal({
        len: 0.6 - ring * 0.03, wid: 0.42, cup: 0.8, bend: -0.06 + ring * 0.04, peak: 0.62, tip: 0.5,
        base: mix(c, '#e9d36a', 0.35), color: c, edge: shade(c, 0.15), nv: 12, roll: -0.03,
      });
      for (let k = 0; k < 3; k++) place(g, geo, (k / 3) * TAU + ring * (TAU / 6), 0.12 + ring * 0.08, 0.03);
    }
    return g;
  }

  function daisy(c) {
    const g = new T.Group();
    const geo = petal({ len: 0.4, wid: 0.09, cup: 0.25, bend: 0.06, peak: 0.6, tip: 0.4, base: shade(c, -0.08), color: c, nu: 3, nv: 6 });
    const n = 26;
    for (let k = 0; k < n; k++) place(g, geo, (k / n) * TAU, 1.38 + (k % 3) * 0.06, 0.09, 0.01);
    const eye = new T.Mesh(new T.SphereGeometry(0.12, 18, 10), plain('#e5b021', 0.85));
    eye.scale.y = 0.45;
    eye.position.y = 0.03;
    g.add(eye);
    sepals(g, 8, 0.12, STEM, 1.9);
    return g;
  }

  function sunflower(c) {
    const g = new T.Group();
    for (let ring = 0; ring < 2; ring++) {
      const geo = petal({ len: 0.4 + ring * 0.04, wid: 0.13, cup: 0.35, bend: 0.05, peak: 0.42, tip: 1.3, base: shade(c, -0.25), color: c, edge: shade(c, 0.1), nu: 4, nv: 7 });
      const n = 22;
      for (let k = 0; k < n; k++) place(g, geo, (k / n) * TAU + ring * (TAU / n / 2), 1.42 - ring * 0.14, 0.26, -0.01 * ring);
    }
    const disc = new T.Mesh(new T.CylinderGeometry(0.29, 0.27, 0.06, 32), plain('#3a2210', 0.95));
    disc.position.y = 0.01;
    g.add(disc);
    const seeds = [];
    for (let i = 0; i < 200; i++) {
      const r = 0.27 * Math.sqrt(i / 200), a = i * GOLD;
      seeds.push({ p: new T.Vector3(Math.cos(a) * r, 0.045 + 0.02 * (1 - r / 0.27), Math.sin(a) * r), c: r < 0.08 ? '#5f6b2a' : i % 2 ? '#4a2c12' : '#6b4319' });
    }
    g.add(scatter(new T.SphereGeometry(0.016, 6, 4), plain('#ffffff', 0.9), seeds));
    sepals(g, 14, 0.22, STEM, 1.75);
    return g;
  }

  function hydrangea(c, rand) {
    const g = new T.Group();
    const floret = new T.Group();
    const geo = petal({ len: 0.085, wid: 0.08, cup: 0.25, bend: 0.02, peak: 0.55, tip: 0.4, color: '#ffffff', base: '#f2f2f2', nu: 3, nv: 4 });
    for (let k = 0; k < 4; k++) place(floret, geo, (k / 4) * TAU, 1.25, 0.004);
    const floretGeo = bake(floret);
    const R = 0.36, list = [];
    const n = 120;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 1.35; // 아래쪽은 조금 비워 둬요
      const r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * GOLD;
      const nrm = new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      list.push({
        p: nrm.clone().multiplyScalar(R).add(new T.Vector3(0, R * 0.75, 0)),
        n: nrm, spin: rand() * TAU,
        c: mix(c, '#ffffff', rand() * 0.35).lerp(shade(c, -0.2), rand() * 0.4),
      });
    }
    g.add(scatter(floretGeo, petalMat(), list));
    const core = new T.Mesh(new T.SphereGeometry(R * 0.93, 20, 14), plain(shade(c, -0.35).getStyle(), 0.9));
    core.position.y = R * 0.75;
    g.add(core);
    return g;
  }

  function lily(c) {
    const g = new T.Group();
    const geo = petal({ len: 0.6, wid: 0.24, cup: 0.4, bend: 0.4, peak: 0.42, tip: 1.15, base: mix(c, '#d9e59a', 0.55), color: c, edge: c, wave: 0.06 });
    for (let k = 0; k < 6; k++) place(g, geo, (k / 6) * TAU + (k % 2) * 0.1, 0.7 + (k % 2) * 0.08, 0.02);
    const fil = plain('#d4dca0', 0.6), anther = plain('#8f3f16', 0.8);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.5;
      const tipP = new T.Vector3(Math.cos(a) * 0.15, 0.44, Math.sin(a) * 0.15);
      g.add(rod(new T.Vector3(0, 0.02, 0), tipP, 0.008, fil));
      const an = new T.Mesh(new T.SphereGeometry(0.026, 8, 6), anther);
      an.scale.set(0.6, 0.6, 1.6);
      an.position.copy(tipP);
      an.rotation.y = -a;
      g.add(an);
    }
    g.add(rod(new T.Vector3(0, 0.02, 0), new T.Vector3(0, 0.5, 0), 0.011, plain('#a9c46a', 0.6)));
    return g;
  }

  function lavender(c, rand) {
    const g = new T.Group();
    g.add(rod(new T.Vector3(0, -0.02, 0), new T.Vector3(0, 0.82, 0), 0.012, plain(STEM, 0.8)));
    const buds = [];
    const n = 70;
    for (let i = 0; i < n; i++) {
      const t = i / n, y = 0.08 + t * 0.74;
      const r = 0.04 * (1 - t * 0.55), a = i * GOLD;
      buds.push({
        p: new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
        n: new T.Vector3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize(),
        s: new T.Vector3(1, 1.7, 1),
        c: mix(c, '#3d2a6b', rand() * 0.35),
      });
    }
    g.add(scatter(new T.SphereGeometry(0.022, 7, 5), plain('#ffffff', 0.85), buds));
    return g;
  }

  function gypsophila(c, rand) {
    const g = new T.Group();
    const twig = plain('#6f8f4a', 0.8);
    const dots = [];
    for (let b = 0; b < 8; b++) {
      const a = b * GOLD + rand(), spread = 0.12 + rand() * 0.22;
      const end = new T.Vector3(Math.cos(a) * spread, 0.25 + rand() * 0.3, Math.sin(a) * spread);
      g.add(rod(new T.Vector3(0, 0, 0), end, 0.006, twig));
      for (let k = 0; k < 16; k++) {
        const p = end.clone().add(new T.Vector3((rand() - 0.5) * 0.2, (rand() - 0.3) * 0.12, (rand() - 0.5) * 0.2));
        dots.push({ p, c: mix(c, '#ffffff', rand() * 0.3), s: new T.Vector3(1, 1, 1).multiplyScalar(0.7 + rand() * 0.6) });
        if (k % 4 === 0) g.add(rod(end, p, 0.003, twig));
      }
    }
    g.add(scatter(new T.IcosahedronGeometry(0.02, 1), plain('#ffffff', 0.7), dots));
    return g;
  }

  function eucalyptus(c) {
    const g = new T.Group();
    const stemMat = plain('#7c6a5a', 0.8);
    g.add(rod(new T.Vector3(0, -0.02, 0), new T.Vector3(0, 0.95, 0), 0.01, stemMat));
    const pairs = 8;
    for (let k = 0; k < pairs; k++) {
      const t = k / (pairs - 1);
      const size = 0.2 - 0.09 * t;
      const geo = petal({ len: size, wid: size * 0.95, cup: 0.18, bend: 0.03, peak: 0.5, tip: 0.45, base: shade(c, -0.15), color: c, edge: mix(c, '#c9d6cf', 0.08), nu: 5, nv: 6 });
      const y = 0.06 + t * 0.86, az = k * (Math.PI / 2);
      place(g, geo, az, 1.05, 0.008, y);
      place(g, geo, az + Math.PI, 1.05, 0.008, y);
    }
    return g;
  }

  /* 꽃 목록. 색 이름은 꽃집에서 부르는 이름이에요. focal: 꽃다발 가운데 쪽, green: 바깥 둘레 쪽 */
  const FLOWERS = {
    rose: { name: '장미', mean: '사랑', size: 1.05, build: rose, focal: true, leaves: true,
      colors: [['#b3112e', '레드'], ['#f07a93', '핑크'], ['#f3ece2', '화이트'], ['#f2c14e', '옐로'], ['#f39a6b', '피치']] },
    tulip: { name: '튤립', mean: '사랑의 고백', size: 0.95, build: tulip, focal: true,
      colors: [['#e23f55', '레드'], ['#f5a3b6', '핑크'], ['#f4d35e', '옐로'], ['#f6f1e7', '화이트'], ['#7a3b93', '퍼플']] },
    daisy: { name: '데이지', mean: '순수한 마음', size: 0.9, build: daisy,
      colors: [['#fbfbf6', '화이트'], ['#f4b5c6', '핑크'], ['#f5d65a', '옐로']] },
    sunflower: { name: '해바라기', mean: '당신만 바라봐요', size: 1.15, build: sunflower, focal: true,
      colors: [['#f5b81b', '선옐로'], ['#e5821a', '오렌지']] },
    hydrangea: { name: '수국', mean: '진심', size: 0.9, build: hydrangea, focal: true,
      colors: [['#86abe6', '블루'], ['#b4a0df', '라일락'], ['#f0b2cb', '핑크'], ['#eef1f5', '화이트']] },
    lily: { name: '백합', mean: '순결', size: 1.05, build: lily, focal: true,
      colors: [['#fbf8f0', '화이트'], ['#f4a3b5', '핑크'], ['#f3963f', '오렌지']] },
    lavender: { name: '라벤더', mean: '기다림', size: 1, build: lavender, filler: true, rise: 0.25,
      colors: [['#8668c6', '라벤더'], ['#b29bda', '연보라']] },
    gypsophila: { name: '안개꽃', mean: '맑은 마음', size: 1, build: gypsophila, filler: true,
      colors: [['#fbfbf7', '화이트'], ['#f5c4d4', '핑크'], ['#c7b6e9', '퍼플']] },
    eucalyptus: { name: '유칼립투스', mean: '추억', size: 1, build: eucalyptus, green: true, rise: 0.1,
      colors: [['#7f998b', '실버달러'], ['#5d7f6b', '그린']] },
  };

  const WRAPS = [['#c49a6c', '크라프트'], ['#f2efe9', '화이트'], ['#2a2a2e', '블랙'], ['#eec0c6', '로즈'], ['#b5c5ae', '세이지'], ['#cec2e6', '라일락']];
  const RIBBONS = [['#f3ead9', '아이보리'], ['#a8122c', '레드'], ['#1c1c1f', '블랙'], ['#ee98ad', '핑크'], ['#c49b45', '골드'], ['#3d6a4e', '그린']];

  const HEAD = 1.3; // 꽃 머리 전체 크기
  const heads = {};
  function head(t, c) {
    const key = t + c;
    if (!heads[key]) {
      const f = FLOWERS[t];
      const h = f.build(c, rng(key.length * 7919 + parseInt(c.slice(1), 16)));
      h.scale.setScalar(f.size * HEAD);
      heads[key] = h;
    }
    return heads[key].clone();
  }

  /* ---------- 포장지와 리본 ---------- */

  // 종이 결: 잘게 구겨진 섬유 무늬를 캔버스로 한 번 그려 두고 모든 포장지가 같이 써요
  let paperTex = null;
  function paperTexture() {
    if (paperTex) return paperTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#eeeeee';
    g.fillRect(0, 0, 256, 256);
    const rand = rng(42);
    for (let i = 0; i < 1400; i++) { // 섬유
      const x = rand() * 256, y = rand() * 256, a = rand() * Math.PI, l = 4 + rand() * 14;
      g.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.07)';
      g.lineWidth = 0.6 + rand();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    for (let i = 0; i < 9; i++) { // 굵게 접힌 자국
      const y = rand() * 256;
      const grad = g.createLinearGradient(0, y - 6, 0, y + 6);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, rand() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.25)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, y - 6, 256, 12);
    }
    paperTex = new T.CanvasTexture(c);
    paperTex.wrapS = paperTex.wrapT = T.RepeatWrapping;
    paperTex.repeat.set(2, 2);
    return paperTex;
  }
  const paperMat = (hex, sheer) => cached('paper' + hex + sheer, () => new T.MeshStandardMaterial({
    color: hex, map: paperTexture(), bumpMap: paperTexture(), bumpScale: 0.004,
    roughness: sheer ? 0.7 : 0.88, side: T.DoubleSide,
    transparent: !!sheer, opacity: sheer ? 0.92 : 1,
  }));

  /* 포장지 한 장: 가운데가 접혀 각이 선 연잎 모양. 밑동이 원점, 바깥(+Z)을 보고 +Y로 서요.
     w: 가장 넓은 곳의 반폭, h: 높이, fold: 가운데 접힌 깊이 */
  function paperSheet(w, h, fold, material, wobble) {
    const nu = 12, nv = 16, pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      const hw = w * (v < 0.72 ? 0.16 + 0.84 * Math.sin((v / 0.72) * Math.PI / 2) : 1 - 0.8 * Math.pow((v - 0.72) / 0.28, 1.6));
      for (let i = 0; i <= nu; i++) {
        const u = (i / nu) * 2 - 1;
        let z = -fold * Math.abs(u) * hw + 0.22 * v * v * h + wobble * Math.sin(u * 7 + v * 6) * v * hw;
        pos.push(u * hw, v * h, z);
        uv.push((u + 1) / 2, v);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const p = j * (nu + 1) + i;
      idx.push(p, p + nu + 1, p + 1, p + 1, p + nu + 1, p + nu + 2);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new T.Mesh(g, material);
  }

  const TIE_Y = -0.3;
  function wrapping(hex, ribbon) {
    const g = new T.Group();
    const dark = new T.Color(hex).getHSL({}).l < 0.3;
    const tissue = paperMat(mix(hex, '#ffffff', dark ? 0.12 : 0.7).getHexString().replace(/^/, '#'), true);
    const outer = paperMat(hex, false);
    // 안쪽 속지 7장 → 꽃 사이로 살짝 비치고, 바깥 종이 5장 → 꽃다발 모양을 잡아요
    const layers = [
      { n: 8, w: 0.5, h: 1.95, tilt: 0.3, r: 0.16, mat: tissue, off: 0.2, fold: 0.35 },
      { n: 5, w: 0.66, h: 1.68, tilt: 0.5, r: 0.2, mat: outer, off: 0, fold: 0.55 },
    ];
    for (const L of layers) {
      for (let k = 0; k < L.n; k++) {
        const pivot = new T.Group();
        pivot.rotation.y = (k / L.n) * TAU + L.off;
        pivot.position.y = TIE_Y - 0.08;
        const m = paperSheet(L.w * (0.92 + 0.16 * ((k * 7) % 3) / 2), L.h * (0.94 + 0.1 * ((k * 5) % 3) / 2), L.fold, L.mat, 0.03);
        m.position.z = L.r;
        m.rotation.x = L.tilt;
        pivot.add(m);
        g.add(pivot);
      }
    }
    // 리본 아래 손잡이: 줄기를 감싼 종이
    const sleeve = new T.Mesh(new T.CylinderGeometry(0.2, 0.17, 0.75, 28, 1, true), outer);
    sleeve.position.y = TIE_Y - 0.36;
    g.add(sleeve);

    // 리본: 묶은 띠, 나비 고리 두 개, 늘어진 꼬리 두 개
    const rm = cached('ribbon' + ribbon, () => new T.MeshPhysicalMaterial({ color: ribbon, roughness: 0.35, sheen: 1, sheenRoughness: 0.3, sheenColor: new T.Color('#ffffff'), side: T.DoubleSide }));
    const band = new T.Mesh(new T.CylinderGeometry(0.235, 0.235, 0.09, 32, 1, true), rm);
    band.position.y = TIE_Y;
    g.add(band);
    const front = new T.Vector3(0, TIE_Y, 0.25);
    for (const side of [-1, 1]) {
      const loop = new T.Mesh(new T.TorusGeometry(0.12, 0.028, 10, 32), rm);
      loop.scale.set(1.3, 0.62, 0.55);
      loop.position.copy(front).add(new T.Vector3(side * 0.14, 0.03, 0.03));
      loop.rotation.z = side * 0.32;
      g.add(loop);
      const tail = new T.Mesh(petal({ len: 0.62, wid: 0.1, cup: 0.25, bend: 0.1, peak: 0.9, tip: 0.15, color: ribbon, nu: 4, nv: 10, wave: 0.15 }), rm);
      tail.position.copy(front).add(new T.Vector3(0, 0, 0.02));
      tail.rotation.set(0.12, 0, Math.PI - side * 0.3);
      g.add(tail);
    }
    const knot = new T.Mesh(new T.SphereGeometry(0.05, 14, 10), rm);
    knot.position.copy(front).add(new T.Vector3(0, 0, 0.05));
    knot.scale.set(1, 0.85, 0.7);
    g.add(knot);
    return g;
  }

  /* ---------- 꽃다발 ----------
     state = { items: [{ t: 'rose', c: '#f07a93' }, ...], wrap, ribbon, seed }
     꽃 머리는 위쪽 둥근 돔에 해바라기 씨처럼 고르게 놓고, 꽃대는 모두 리본 묶는 곳에서 엇갈려요. */
  function buildBouquet(state) {
    const root = new T.Group();
    const items = state.items || [];
    const rand = rng(state.seed || 1);
    const n = items.length;

    // 가운데엔 큰 꽃, 사이사이엔 작은 꽃, 바깥 둘레엔 잎
    const order = items.map((it, i) => {
      const f = FLOWERS[it.t];
      return { i, key: rand() + (f.green ? 0.9 : 0) + (f.filler ? 0.35 : 0) - (f.focal ? 0.15 : 0) };
    }).sort((a, b) => a.key - b.key);

    const R = Math.min(1.05, 0.2 + 0.17 * Math.sqrt(n));
    const tie = new T.Vector3(0, TIE_Y, 0);
    const stemMat = plain(STEM, 0.8);
    const leafGeo = petal({ len: 0.32, wid: 0.15, cup: 0.4, bend: 0.12, peak: 0.45, tip: 1.1, color: '#5d8a3f', base: '#3f6a2c', nu: 4, nv: 7 });

    order.forEach((o, rank) => {
      const it = items[o.i], f = FLOWERS[it.t];
      const k = n === 1 ? 0 : Math.sqrt((rank + 0.5) / n);
      const a = rank * GOLD + rand() * 0.5;
      const r = R * k;
      const y = 1.28 - 0.42 * k * k + (f.rise || 0) + (rand() - 0.5) * 0.12;
      const headPos = new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      const out = new T.Vector3(Math.cos(a), 0, Math.sin(a));

      // 꽃대: 아래 끝 → 리본 → 살짝 바깥으로 휘어 → 꽃 머리
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(-out.x * 0.1 + (rand() - 0.5) * 0.04, -1.45, -out.z * 0.1 + (rand() - 0.5) * 0.04),
        tie.clone().addScaledVector(out, 0.03),
        new T.Vector3().lerpVectors(tie, headPos, 0.55).addScaledVector(out, 0.12 * k),
        headPos,
      ]);
      const flower = new T.Group();
      flower.userData.idx = o.i;
      flower.add(new T.Mesh(new T.TubeGeometry(curve, 20, f.green ? 0.012 : 0.02, 5, false), f.green ? plain('#7c6a5a', 0.8) : stemMat));

      const h = head(it.t, it.c);
      h.position.copy(headPos);
      const dir = curve.getTangent(1).lerp(new T.Vector3(0, 1, 0), 0.25).normalize();
      h.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
      h.rotateY(rand() * TAU);
      flower.add(h);
      flower.userData.head = h;

      if (f.leaves) {
        for (const t of [0.62, 0.72]) {
          const lp = curve.getPoint(t);
          const leaf = new T.Mesh(leafGeo, petalMat());
          leaf.position.copy(lp);
          leaf.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), curve.getTangent(t));
          leaf.rotateY(t * 9 + a);
          leaf.rotateX(0.9);
          flower.add(leaf);
        }
      }
      root.add(flower);
    });

    root.add(wrapping(state.wrap || WRAPS[0][0], state.ribbon || RIBBONS[0][0]));
    return root;
  }

  window.FLOWN = { FLOWERS, WRAPS, RIBBONS, HEAD, buildBouquet, flowerHead: head };
})();
