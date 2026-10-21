/* saeip: 로그인, 읽기, 적기, 고치기, 지우기, 신고.
   데이터는 Supabase에 있고, config.js가 비어 있으면 예시 기록으로만 움직이는 미리보기로 열립니다. */
(function () {
  const cfg = window.HAPPY_CONFIG || {};
  const $ = id => document.getElementById(id);
  const sheet = $('sheet'), body = $('sheet-body');
  const PENDING = 'happy:pending';     // 로그인하러 다녀오는 동안 하던 일을 기억해 두는 곳
  const LIMITS = { line: 80, place: 40, more: 2000 };
  const tr = window.I18N.t;
  window.I18N.fill();
  document.title = tr('brand');
  document.querySelector('meta[name="description"]').content = tr('desc');

  /* ---------- small helpers ---------- */
  // h('p', { class: 'note' }, '글자', child) — 글자는 항상 textContent로 들어가서 안전합니다
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dot = s => window.I18N.date((s || '').slice(0, 10)); // a day, written the way the visitor's language writes it
  const localDay = iso => window.I18N.date(iso);
  const chars = s => [...(s || '')].length; // 이모지도 한 글자로 셉니다

  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 3400);
  }
  // 예상 못 한 오류는 한 번만 짧게 보여 줘요. 캡처해서 알려 주면 고치기 쉬워요
  let shownError = false;
  const showError = e => { if (shownError || /ResizeObserver|^Script error/i.test(errMsg(e))) return; shownError = true; toast(tr('oops') + ' ' + errMsg(e)); const l = document.getElementById('loading'); if (l) l.classList.add('done'); };
  window.addEventListener('error', ev => showError(ev.error || ev.message));
  window.addEventListener('unhandledrejection', ev => showError(ev.reason));
  function errMsg(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return tr('errNet');
    if (/JWT|token/i.test(m)) return tr('errAuth');
    if (/daily_limit/.test(m)) return tr('errDaily');
    return tr('errRetry', { m });
  }

  /* ---------- connect ---------- */
  // 관리자용 키가 들어 있으면 아무것도 하지 않고 멈춥니다
  function keyProblem(key) {
    if (/^sb_secret_/.test(key)) return true;
    const parts = key.split('.');
    if (parts.length === 3) {
      try {
        const b = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const p = JSON.parse(atob(b + '='.repeat((4 - b.length % 4) % 4)));
        return p.role === 'service_role';
      } catch (_) { /* 알 수 없는 모양이면 Supabase가 판단하게 둡니다 */ }
    }
    return false;
  }

  let sb = null;
  const wantsServer = !!(cfg.supabaseUrl && cfg.supabaseKey);
  if (wantsServer && keyProblem(cfg.supabaseKey)) {
    document.body.prepend(h('p', { class: 'wrap', style: 'padding:16px 20px;background:#fbeae8;color:#b3261e;margin:0' },
      tr('secretKey')));
    return;
  }
  if (wantsServer && window.supabase) {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  const demo = !sb;
  if (demo) $('demo-note').hidden = false;
  if (wantsServer && !sb) $('demo-note').textContent = tr('libFail');

  /* ---------- data: Supabase, or memory in preview ---------- */
  const BUCKET = cfg.photoBucket || 'happy-photos';
  let user = null;

  // the columns anyone may read; who wrote a clover is never sent, only "is it mine" through my_happy_ids
  const COLS = 'id,happy_on,place,line,more,photo_path,fx,fy,created_at,updated_at,hidden';
  const thumbOf = path => path.replace(/\.jpg$/, '.t.jpg');
  const server = {
    async list() {
      const out = [];
      for (let from = 0; from < 10000; from += 1000) {
        const { data, error } = await sb.from('happies').select('id,fx,fy,line,photo_path').order('created_at').range(from, from + 999);
        if (error) throw error;
        out.push(...data);
        if (data.length < 1000) break;
      }
      return out;
    },
    async get(id) {
      const { data, error } = await sb.from('happies').select(COLS).eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async mine() {
      const { data, error } = await sb.rpc('my_happies');
      if (error) throw error;
      return data;
    },
    async myIds() {
      const { data, error } = await sb.rpc('my_happy_ids');
      if (error) throw error;
      return data.map(x => typeof x === 'string' ? x : x.my_happy_ids || x.id);
    },
    async create(row) {
      const { data, error } = await sb.from('happies').insert(row).select(COLS).single();
      if (error) throw error;
      return data;
    },
    async update(id, row) {
      const { data, error } = await sb.from('happies').update(row).eq('id', id).select(COLS).single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { data, error } = await sb.from('happies').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data.length) throw new Error(tr('cantDelete'));
    },
    async report(id, reason) {
      const { error } = await sb.from('reports').insert({ happy_id: id, reason: reason || null });
      if (error) throw error;
    },
    async upload(blob) {
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const opt = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false };
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, opt);
      if (error) throw error;
      // 들판 이름표에 붙는 작은 사진도 같이 올려요. 실패해도 큰 사진으로 대신 보여 줘요
      const small = await window.thumbPhoto(blob).catch(() => null);
      if (small) await sb.storage.from(BUCKET).upload(thumbOf(path), small, opt).catch(() => {});
      return path;
    },
    async unlink(path) { await sb.storage.from(BUCKET).remove([path, thumbOf(path)]); },
    photoUrl(path) { return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; },
    thumbUrl(path) { return this.photoUrl(thumbOf(path)); },
  };

  // 미리보기: 새로고침하면 처음으로 돌아가요
  const DEMO = [
    { line: '퇴근길 버스에서 창가 자리가 비어 있었다', place: '472번 버스', happy_on: '2026-10-14', fx: 0.22, fy: 0.3 },
    { line: '엄마가 싸 준 김밥이 아직 따뜻했다', place: '회사 옥상', happy_on: '2026-10-09', fx: 0.64, fy: 0.24,
      more: '점심시간에 혼자 옥상에 올라갔다. 은박지를 벗기니 김이 살짝 올라왔다.\n별것 아닌데 하루 종일 그 김 생각이 났다.' },
    { line: '빨래가 해 질 녘에 딱 맞춰 말랐다', place: '베란다', happy_on: '2026-10-02', fx: 0.43, fy: 0.55 },
    { line: '오랜만에 연락한 친구가 바로 답장을 했다', place: '', happy_on: '2026-09-27', fx: 0.82, fy: 0.5 },
    { line: '처음 간 빵집인데 사장님이 하나 더 넣어 주셨다', place: '동네 골목 빵집', happy_on: '2026-09-20', fx: 0.12, fy: 0.68,
      more: '소금빵을 두 개 샀는데 봉투에 세 개가 들어 있었다. 다음에 또 오라고 하셨다.' },
  ].map((r, i) => ({ id: 'demo-' + i, user_id: 'demo-other', more: null, photo_path: null, created_at: r.happy_on + 'T12:00:00', updated_at: null, hidden: false, ...r }));
  const demoPhotos = new Map();
  const memory = {
    rows: DEMO.slice(),
    async list() { return this.rows.map(r => ({ id: r.id, fx: r.fx, fy: r.fy, line: r.line, photo_path: r.photo_path })); },
    async myIds() { return this.rows.filter(r => r.user_id === user.id).map(r => r.id); },
    async get(id) { return this.rows.find(r => r.id === id) || null; },
    async mine() { return this.rows.filter(r => r.user_id === user.id).reverse(); },
    async create(row) {
      const r = { id: 'demo-' + Date.now(), user_id: user.id, created_at: new Date().toISOString(), updated_at: null, hidden: false, ...row };
      this.rows.push(r); return r;
    },
    async update(id, row) {
      const r = this.rows.find(x => x.id === id);
      Object.assign(r, row, { updated_at: new Date().toISOString() }); return r;
    },
    async remove(id) { this.rows = this.rows.filter(r => r.id !== id); },
    async report() {},
    async upload(blob) { const p = 'demo/' + Date.now(); demoPhotos.set(p, URL.createObjectURL(blob)); return p; },
    async unlink(p) { URL.revokeObjectURL(demoPhotos.get(p)); demoPhotos.delete(p); },
    photoUrl(p) { return demoPhotos.get(p) || ''; },
    thumbUrl(p) { return demoPhotos.get(p) || ''; },
  };
  const api = demo ? memory : server;

  /* ---------- the field ---------- */
  const foundN = $('found-n'), totalN = $('total-n'), hintText = $('hint-text'), hintBtn = $('hint-btn'), openBtn = $('open-btn');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const IDLE_HINT = coarse ? tr('idleTouch') : tr('idleMouse');
  hintText.textContent = IDLE_HINT;
  let shown = null;

  const field = CloverField($('field'), {
    width: cfg.fieldWidth, height: cfg.fieldHeight,
    onPick: pick,
    onShow(c) {
      shown = c;
      openBtn.hidden = !c;
      document.querySelector('.field-bar').classList.toggle('has-open', !!c); // narrow phones show one button at a time
      if (c) openBtn.textContent = c.kind === 'empty' ? tr('writeHere') : tr('open');
    },
    onFound(n, all, c) {
      foundN.textContent = n; totalN.textContent = all;
      if (c) hintText.textContent = c.kind === 'empty' ? tr('foundEmpty') : c.mine ? tr('foundMine') : tr('foundOther');
      if (all && n === all) hintText.textContent = tr('foundAll');
      if (!c && n === 0) hintText.textContent = IDLE_HINT;
      hintBtn.disabled = all > 0 && n === all;
      hintBtn.textContent = hintBtn.disabled ? tr('allFound') : tr('showOne');
    },
  });
  // 적힌 세잎은 꽃 표시로 이미 보이니, "하나 보여 주기"는 빈 세잎부터 찾아 줘요
  hintBtn.addEventListener('click', () => field.hint('empty'));
  openBtn.addEventListener('click', () => { if (shown) pick(shown); });

  const records = new Map(); // id -> { id, fx, fy, line }
  let myIds = new Set();      // the clovers the signed-in person planted
  const isMine = id => !!user && myIds.has(id);
  let empties = [];
  let emptySeq = 0;

  // 빈 세잎 자리: 들판 어디든, 기존 세잎과 너무 가깝지 않은 곳을 무작위로 고릅니다
  // where clovers already are, filed in a grid so finding a free spot stays quick however many there are
  const GAP = 100; // no two clovers closer than this (px)
  let occ = new Map(), occW = 0, occH = 0;
  const cellKey = (x, y) => Math.floor(x / GAP) + ',' + Math.floor(y / GAP);
  function occupy(p) {
    const x = p.fx * occW, y = p.fy * occH, k = cellKey(x, y);
    if (!occ.has(k)) occ.set(k, []);
    occ.get(k).push([x, y]);
  }
  function resetOcc() {
    const { width, height } = field.world;
    occ = new Map(); occW = width; occH = height;
    for (const r of records.values()) occupy(r);
    for (const e of empties) occupy(e);
  }
  function nearest(x, y) {
    const cx = Math.floor(x / GAP), cy = Math.floor(y / GAP);
    let d = Infinity;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
      for (const [px, py] of occ.get((cx + i) + ',' + (cy + j)) || []) d = Math.min(d, Math.hypot(px - x, py - y));
    return d;
  }
  function freeSpot() {
    const { width: W, height: H } = field.world;
    if (W !== occW || H !== occH) resetOcc();
    let pick = null, far = -1;
    for (let t = 0; t < 300; t++) {
      const fx = 0.02 + Math.random() * 0.96, fy = 0.02 + Math.random() * 0.96;
      const d = nearest(fx * W, fy * H);
      if (d >= GAP) return { fx, fy };
      if (d > far) { far = d; pick = { fx, fy }; }
    }
    return pick;
  }
  function newEmpty() {
    const spot = freeSpot();
    const e = { key: 'empty-' + (++emptySeq), kind: 'empty', fx: spot.fx, fy: spot.fy };
    empties.push(e);
    occupy(e);
    return e;
  }
  // 사진이 있으면 작은 사진을, 작은 사진이 없던 예전 기록은 큰 사진을 이름표에 붙여요
  const photoOf = path => path ? [api.thumbUrl(path), api.photoUrl(path)] : null;
  const asClover = r => ({ key: r.id, kind: 'happy', fx: r.fx, fy: r.fy, text: r.line, photo: photoOf(r.photo_path), mine: isMine(r.id) });

  async function load() {
    let list = [];
    try { list = await api.list(); }
    catch (e) { toast(tr('loadFail') + ' ' + errMsg(e)); }
    records.clear();
    list.forEach(r => records.set(r.id, r));
    // the meadow grows with the number of records, so there is always room to hide empty clovers;
    // the number of empty clovers grows with it, so they stay just as easy to find
    const base = { w: cfg.fieldWidth || 3600, h: cfg.fieldHeight || 2400, empty: Math.max(1, cfg.emptyClovers ?? 80) };
    // the base field holds about 400 records with room to spare; past that it widens and lengthens together
    const roomy = base.empty + 400;
    const grow = Math.min(cfg.fieldMaxGrow ?? 3, Math.max(1, Math.sqrt((list.length + base.empty) / roomy)));
    field.setWorld(base.w * grow, base.h * grow);
    empties = [];
    resetOcc();
    const n = Math.round(base.empty * grow * grow);
    for (let i = 0; i < n; i++) newEmpty();
    field.set([...list.map(asClover), ...empties]);
    feed.reset();
  }

  /* ---------- the list beside the field: a few lines people wrote, one of them changing every few seconds ---------- */
  const feed = (() => {
    const box = $('feed'), list = $('feed-list');
    const narrow = matchMedia('(max-width: 640px)');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let shownIds = [], timer = 0, paused = false, turn = 0;
    const size = () => narrow.matches ? 1 : 6;
    const pool = () => [...records.values()].filter(r => r.line);
    const pickNew = () => {
      const left = pool().filter(r => !shownIds.includes(r.id));
      return left.length ? left[(Math.random() * left.length) | 0] : null;
    };
    function item(r) {
      return h('li', { 'data-id': r.id },
        h('button', { type: 'button', title: tr('showInField'), onclick: () => field.reveal(r.id, () => openRead(r.id)) },
          h('span', { class: 'dot' + (isMine(r.id) ? ' mine' : '') }), h('span', { class: 't' }, r.line)));
    }
    function reset() {
      shownIds = [];
      const n = Math.min(size(), pool().length);
      for (let i = 0; i < n; i++) { const r = pickNew(); if (r) shownIds.push(r.id); }
      list.replaceChildren(...shownIds.map(id => item(records.get(id))));
      sync();
      clearInterval(timer);
      timer = setInterval(rotate, narrow.matches ? 4500 : 3800);
    }
    // swap one line for one not on screen, oldest slot first, fading between them
    function rotate() {
      if (paused || document.hidden || sheet.open || closed()) return;
      const r = pickNew();
      if (!r || !shownIds.length) return;
      const slot = turn++ % shownIds.length;
      const li = list.children[slot];
      const swap = () => { shownIds[slot] = r.id; li.replaceWith(item(r)); };
      if (reduceMotion || !li) { swap(); return; }
      li.classList.add('out');
      setTimeout(() => { swap(); const n = list.children[slot]; n.classList.add('in'); requestAnimationFrame(() => requestAnimationFrame(() => n.classList.remove('in'))); }, 380);
    }
    // the list can be put away; the choice is remembered on this device
    const closed = () => { try { return !!localStorage.getItem('happy:feed-closed'); } catch (_) { return false; } };
    const reopen = $('feed-open');
    function setClosed(v) {
      try { if (v) localStorage.setItem('happy:feed-closed', '1'); else localStorage.removeItem('happy:feed-closed'); } catch (_) { /* 이번 방문에만 */ }
      sync();
      (v ? reopen : $('feed-close')).focus({ preventScroll: true });
    }
    function sync() {
      const has = shownIds.length > 0;
      box.hidden = !has || closed();
      reopen.hidden = !has || !closed();
    }
    $('feed-close').addEventListener('click', () => setClosed(true));
    reopen.addEventListener('click', () => setClosed(false));
    box.addEventListener('pointerenter', () => { paused = true; });
    box.addEventListener('pointerleave', () => { paused = false; });
    box.addEventListener('focusin', () => { paused = true; });
    box.addEventListener('focusout', () => { paused = false; });
    narrow.addEventListener('change', reset);
    return {
      reset,
      // a line someone just wrote goes to the top at once
      put(id) {
        const r = records.get(id);
        if (!r) return;
        const at = shownIds.indexOf(id);
        if (at >= 0) { list.children[at].replaceWith(item(r)); return; }
        shownIds.unshift(id);
        list.prepend(item(r));
        while (shownIds.length > size()) { shownIds.pop(); list.lastElementChild.remove(); }
        sync();
      },
      drop(id) {
        const at = shownIds.indexOf(id);
        if (at < 0) return;
        const r = pickNew();
        if (r) { shownIds[at] = r.id; list.children[at].replaceWith(item(r)); }
        else { shownIds.splice(at, 1); list.children[at].remove(); }
        sync();
      },
      mine() { for (const li of list.children) li.querySelector('.dot').classList.toggle('mine', isMine(li.dataset.id)); },
    };
  })();

  function pick(c) {
    if (c.kind === 'empty') openEmpty(c);
    else openRead(c.key);
  }

  /* ---------- the sheet ---------- */
  let onLeave = null, openedAt = 0;
  function open(nodes, leave) {
    openedAt = performance.now();
    if (onLeave) { const f = onLeave; onLeave = null; f(); }
    body.replaceChildren(...nodes.filter(n => n != null && n !== false));
    onLeave = leave || null;
    if (!sheet.open) sheet.showModal();
    body.scrollTop = 0; sheet.scrollTop = 0;
  }
  const close = () => sheet.close();
  sheet.addEventListener('close', () => { if (onLeave) { const f = onLeave; onLeave = null; f(); } });
  // 바깥 어두운 곳을 누르면 닫힙니다. 손가락으로 세잎을 눌러 막 열린 직후에 따라오는 클릭은 무시해요
  sheet.addEventListener('click', e => { if (e.target === sheet && performance.now() - openedAt > 500) close(); });

  function head(eyebrow, title) {
    return h('div', { class: 'sheet-head' },
      h('div', { style: 'display:grid;gap:6px' },
        eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null,
        h('h2', { id: 'sheet-title' }, title)),
      h('button', { type: 'button', class: 'x-btn', 'aria-label': tr('close'), onclick: close }, '×'));
  }
  function loading(text) { open([head(null, text || tr('loading'))]); }

  /* ---------- login ---------- */
  const returnUrl = () => location.origin + location.pathname;
  function savePending(p) { try { sessionStorage.setItem(PENDING, JSON.stringify(p)); } catch (_) {} }
  function takePending() {
    try { const v = sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); return v ? JSON.parse(v) : null; }
    catch (_) { return null; }
  }

  // 로그인이 되어 있으면 true. 아니면 하던 일을 기억해 두고 로그인 창을 엽니다.
  function requireLogin(pending, why) {
    if (user) return true;
    if (pending) savePending(pending);
    openLogin(why);
    return false;
  }

  // inside KakaoTalk, Instagram, Facebook, LINE, Naver… Google refuses to sign anyone in ("disallowed_useragent")
  const UA = navigator.userAgent || '';
  const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|Whale\/.*inapp|; wv\)/i.test(UA);
  const IN_KAKAO = /KAKAOTALK/i.test(UA);
  const IS_IOS = /iPhone|iPad|iPod/i.test(UA);
  function openOutside() {
    const url = location.href;
    if (IN_KAKAO) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    else if (!IS_IOS) location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
  }

  // which sign-in providers are switched on in Supabase, asked once (so a button never leads to "provider is not enabled")
  let enabledProviders = null;
  async function providersOn() {
    const wanted = cfg.loginProviders && cfg.loginProviders.length ? cfg.loginProviders : [{ id: 'google' }];
    if (demo) return wanted;
    if (!enabledProviders) {
      try {
        const r = await fetch(cfg.supabaseUrl + '/auth/v1/settings', { headers: { apikey: cfg.supabaseKey } });
        const j = await r.json();
        enabledProviders = wanted.filter(p => j.external ? j.external[p.id] : true);
      } catch (_) { enabledProviders = wanted; }
      if (!enabledProviders.length) enabledProviders = wanted;
    }
    return enabledProviders;
  }

  async function openLogin(why) {
    let leaving = false;
    const all = await providersOn();
    // in an app's own browser Google can't be used; Kakao still works inside KakaoTalk
    const providers = IN_APP ? all.filter(p => p.id !== 'google') : all;
    const label = p => (tr('provider_' + p.id) === 'provider_' + p.id ? p.label : tr('provider_' + p.id));
    const copyBtn = h('button', { type: 'button', class: 'btn quiet', async onclick() {
      try { await navigator.clipboard.writeText(location.href); toast(tr('linkCopiedPlain')); } catch (_) { window.prompt(tr('copyLink'), location.href); }
    } }, tr('copyLink'));
    open([
      head(null, tr('loginTitle')),
      h('p', { class: 'note' }, why || tr('loginWhyWrite'), h('br'), tr('loginBack')),
      IN_APP ? h('div', { class: 'inapp' },
        h('b', null, tr('inAppTitle')),
        h('p', null, all.some(p => p.id === 'kakao') && IN_KAKAO ? tr('inAppKakao') : (IS_IOS && !IN_KAKAO ? tr('inAppIos') : tr('inAppOther'))),
        h('div', { class: 'row' },
          IN_KAKAO || !IS_IOS ? h('button', { type: 'button', class: 'btn', onclick: openOutside }, tr('openBrowser')) : null,
          copyBtn)) : null,
      h('div', { class: 'providers' }, providers.map(p => h('button', {
        type: 'button', class: 'btn wide provider-' + p.id + (p.id === 'google' ? ' primary' : ''),
        async onclick(e) {
          const btn = e.currentTarget;
          btn.disabled = true;
          leaving = true;
          if (demo) { setUser({ id: 'demo-me' }); close(); resume(); return; }
          const { error } = await sb.auth.signInWithOAuth({ provider: p.id, options: { redirectTo: returnUrl() } });
          if (error) { leaving = false; btn.disabled = false; toast(tr('loginFail') + ' ' + errMsg(error)); }
        },
      }, label(p)))),
      h('p', { class: 'note small' }, tr('loginAge'), ' ',
        h('a', { href: tr('termsHref'), target: '_blank', rel: 'noopener' }, tr('terms')), ' · ',
        h('a', { href: tr('privacyHref'), target: '_blank', rel: 'noopener' }, tr('privacy'))),
      demo ? h('p', { class: 'note' }, tr('loginDemo')) : null,
    ], () => { if (!leaving) takePending(); }); // 그냥 닫으면 하던 일도 잊습니다
  }

  const navAuth = $('nav-auth');
  let booted = false; // true once the field has loaded, so a later login can check "on this day"
  // ask which clovers are mine, then mark them in the field and the list
  async function refreshMine() {
    let ids = [];
    if (user) { try { ids = await api.myIds(); } catch (_) { /* 표시만 늦어져요 */ } }
    myIds = new Set(ids);
    for (const r of records.values()) field.update(r.id, { mine: isMine(r.id) });
    feed.mine();
  }
  function setUser(u) {
    const changed = (user && user.id) !== (u && u.id);
    user = u;
    navAuth.textContent = user ? tr('logout') : tr('login');
    if (!changed) return Promise.resolve();
    return refreshMine().then(() => { if (user && booted) onThisDay(); });
  }
  navAuth.addEventListener('click', async () => {
    if (!user) { takePending(); openLogin(tr('loginWhyHeader')); return; }
    if (sb) await sb.auth.signOut();
    setUser(null);
    toast(tr('loggedOut'));
  });

  // 로그인하고 돌아왔을 때, 하던 일을 이어서 합니다
  function resume() {
    const p = takePending();
    if (!p || !user) return;
    if (p.type === 'write') {
      let spot = empties.find(e => e.key === p.spot.key);
      if (!spot) { // 새로고침으로 빈 세잎이 새로 뿌려졌으니, 그 자리에 다시 둡니다
        spot = { key: p.spot.key + '-back', kind: 'empty', fx: p.spot.fx, fy: p.spot.fy };
        empties.push(spot); field.add(spot);
      }
      field.reveal(spot.key);
      openWrite({ spot, draft: p.draft });
    } else if (p.type === 'edit') openEditById(p.id);
    else if (p.type === 'report') openReport(p.id);
    else if (p.type === 'mine') openMine();
  }

  /* ---------- an empty clover ---------- */
  function openEmpty(c) {
    open([
      head(tr('emptyEyebrow'), tr('emptyTitle')),
      h('p', { class: 'note' }, tr('emptyBody')),
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'btn quiet', onclick: close }, tr('close')),
        h('button', { type: 'button', class: 'btn primary', onclick: () => startWrite(c) }, tr('emptyWrite'))),
    ]);
  }
  function startWrite(spot, draft) {
    if (!requireLogin({ type: 'write', spot: { key: spot.key, fx: spot.fx, fy: spot.fy }, draft })) return;
    openWrite({ spot, draft });
  }
  // 머리말의 "행복 적기": 들판을 빈 세잎 하나로 옮겨 가서 손으로 헤친 다음 적기 창을 엽니다
  $('nav-write').addEventListener('click', () => {
    let spot = empties[(Math.random() * empties.length) | 0];
    if (!spot) { spot = newEmpty(); field.add(spot); }
    field.reveal(spot.key, () => startWrite(spot));
  });

  /* ---------- reading ---------- */
  async function openRead(id) {
    loading();
    let r;
    try { r = await api.get(id); }
    catch (e) { open([head(null, tr('readFail')), h('p', { class: 'note' }, errMsg(e))]); return; }
    if (!r) {
      open([head(null, tr('gone')), h('p', { class: 'note' }, tr('goneBody'))]);
      records.delete(id); field.remove(id); feed.drop(id);
      return;
    }
    const mine = isMine(r.id);
    const moreText = h('p', { class: 'read-more', id: 'read-more', hidden: true }, r.more || '');
    const moreBtn = r.more ? h('button', {
      type: 'button', class: 'btn link', 'aria-expanded': 'false', 'aria-controls': 'read-more',
      onclick(e) {
        const on = moreText.hidden;
        moreText.hidden = !on;
        e.currentTarget.setAttribute('aria-expanded', String(on));
        e.currentTarget.textContent = on ? tr('fold') : tr('readMore');
      },
    }, tr('readMore')) : null;

    open([
      head([dot(r.happy_on), r.place].filter(Boolean).join(' · '), r.line),
      (mine || r.hidden) ? h('div', { class: 'row' },
        mine ? h('span', { class: 'badge' }, tr('badgeMine')) : null,
        r.hidden ? h('span', { class: 'badge warn' }, tr('badgeHidden')) : null) : null,
      r.photo_path ? h('figure', { class: 'read-photo', style: 'margin-block:0' }, h('img', { src: api.photoUrl(r.photo_path), alt: tr('photoAlt'), loading: 'lazy' })) : null,
      moreBtn, moreText,
      h('div', { class: 'row split' },
        h('span', { class: 'eyebrow' }, tr('plantedOn', { d: localDay(r.created_at) }) + (r.updated_at ? ' · ' + tr('edited') : '')),
        mine
          ? h('div', { class: 'row' },
              shareBtn(r),
              h('button', { type: 'button', class: 'btn', onclick: () => openWrite({ record: r }) }, tr('edit')),
              h('button', { type: 'button', class: 'btn danger', onclick: () => openDelete(r) }, tr('del')))
          : h('div', { class: 'row' },
              shareBtn(r),
              h('button', { type: 'button', class: 'btn quiet', onclick: () => { if (requireLogin({ type: 'report', id: r.id }, tr('loginWhyReport'))) openReport(r.id); } }, tr('report')))),
    ]);
  }

  // a link straight to one clover: whoever opens it lands on it, already open
  const linkTo = id => location.origin + location.pathname + '?c=' + encodeURIComponent(id);
  function shareBtn(r) {
    return h('button', { type: 'button', class: 'btn', async onclick() {
      const url = linkTo(r.id);
      // phones offer their own share sheet (KakaoTalk, messages…); elsewhere the link is copied
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title: tr('brand'), text: `${tr('shareText')}: “${r.line}”`, url }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(url); toast(tr('linkCopied')); }
      catch (_) { window.prompt(tr('shareLink'), url); }
    } }, tr('shareLink'));
  }

  /* ---------- writing and editing ---------- */
  async function openEditById(id) {
    loading();
    try {
      const r = await api.get(id);
      if (r && isMine(r.id)) openWrite({ record: r }); else close();
    } catch (e) { toast(errMsg(e)); close(); }
  }

  function counter(input, max) {
    const c = h('span', { class: 'cnt' });
    const sync = () => { const n = chars(input.value); c.textContent = `${n} / ${max}`; c.classList.toggle('over', n > max); };
    input.addEventListener('input', sync); sync();
    return c;
  }

  function openWrite({ spot, draft, record }) {
    const editing = !!record;
    const src = draft || record || {};
    const t = today();

    const dateIn = h('input', { type: 'date', id: 'f-date', required: true, max: t, value: src.happy_on || t });
    const placeIn = h('input', { type: 'text', id: 'f-place', maxlength: LIMITS.place, placeholder: tr('placePh'), autocomplete: 'off', value: src.place || '' });
    const lineIn = h('input', { type: 'text', id: 'f-line', required: true, maxlength: LIMITS.line, placeholder: tr('linePh'), autocomplete: 'off', value: src.line || '', 'aria-describedby': 'f-err' });
    const moreIn = h('textarea', { id: 'f-more', maxlength: LIMITS.more, rows: 5, placeholder: tr('morePh') });
    moreIn.value = src.more || '';
    const err = h('p', { class: 'err', id: 'f-err', role: 'alert' });

    // 사진: 고르는 순간 줄여 두고, 저장할 때 올립니다
    const photo = { blob: null, removed: false, url: null };
    const fileIn = h('input', { type: 'file', id: 'f-photo', accept: 'image/*', tabindex: '-1', 'aria-hidden': 'true' });
    const prevImg = h('img', { alt: tr('photoPrevAlt') });
    const prevMeta = h('span', { class: 'meta' });
    const prev = h('div', { class: 'photo-prev', hidden: true }, prevImg, prevMeta);
    const pickBtn = h('button', { type: 'button', class: 'btn', onclick: () => fileIn.click() }, tr('pickPhoto'));
    const dropBtn = h('button', { type: 'button', class: 'btn quiet', hidden: true, onclick() {
      photo.blob = null; photo.removed = true; fileIn.value = '';
      if (photo.url) URL.revokeObjectURL(photo.url);
      photo.url = null; prev.hidden = true; dropBtn.hidden = true; pickBtn.textContent = tr('pickPhoto');
    } }, tr('dropPhoto'));
    if (record && record.photo_path) {
      prevImg.src = api.photoUrl(record.photo_path); prevMeta.textContent = tr('photoNow');
      prev.hidden = false; dropBtn.hidden = false; pickBtn.textContent = tr('photoOther');
    }
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      pickBtn.disabled = true; pickBtn.textContent = tr('shrinking');
      try {
        const blob = await window.shrinkPhoto(f);
        if (photo.url) URL.revokeObjectURL(photo.url);
        photo.blob = blob; photo.removed = false; photo.url = URL.createObjectURL(blob);
        prevImg.src = photo.url;
        prevMeta.textContent = `${Math.round(f.size / 1024).toLocaleString()}KB → ${Math.round(blob.size / 1024).toLocaleString()}KB`;
        prev.hidden = false; dropBtn.hidden = false;
      } catch (e) { toast(e.message || tr('shrinkFail')); }
      pickBtn.disabled = false; pickBtn.textContent = photo.blob || !prev.hidden ? tr('photoOther') : tr('pickPhoto');
    });

    const submit = h('button', { type: 'submit', class: 'btn primary' }, editing ? tr('saveEdit') : tr('plant'));
    const form = h('form', { class: 'form', novalidate: true },
      h('div', { class: 'two' },
        h('div', { class: 'f' }, h('label', { for: 'f-date' }, tr('labelDate')), dateIn),
        h('div', { class: 'f' }, h('label', { for: 'f-place' }, h('span', null, tr('labelPlace') + ' ', h('span', { class: 'opt' }, tr('optional'))), counter(placeIn, LIMITS.place)), placeIn)),
      h('div', { class: 'f' }, h('label', { for: 'f-line' }, h('span', null, tr('labelLine')), counter(lineIn, LIMITS.line)), lineIn),
      h('details', { class: 'more', open: !!src.more },
        h('summary', null, tr('moreSummary')),
        h('div', { class: 'f' }, h('label', { for: 'f-more' }, h('span', { class: 'opt' }, tr('moreLabel')), counter(moreIn, LIMITS.more)), moreIn)),
      h('div', { class: 'f photo-pick' },
        h('span', { class: 'lab' }, h('span', null, tr('labelPhoto') + ' ', h('span', { class: 'opt' }, tr('photoOpt')))),
        prev, h('div', { class: 'row' }, pickBtn, dropBtn, fileIn)),
      err,
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'btn quiet', onclick: close }, tr('cancel')),
        submit));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = '';
      const row = {
        happy_on: dateIn.value,
        place: placeIn.value.trim() || null,
        line: lineIn.value.trim(),
        more: moreIn.value.trim() || null,
      };
      if (!row.line) { err.textContent = tr('errLineReq'); lineIn.focus(); return; }
      if (chars(row.line) > LIMITS.line) { err.textContent = tr('errLineMax', { n: LIMITS.line }); lineIn.focus(); return; }
      if (!row.happy_on || row.happy_on > today()) { err.textContent = tr('errDate'); dateIn.focus(); return; }
      if (chars(row.place) > LIMITS.place || chars(row.more) > LIMITS.more) { err.textContent = tr('errLen'); return; }
      // 쓰는 사이에 로그인이 풀렸다면, 쓴 글을 기억해 두고 다시 로그인합니다 (사진은 다시 골라야 해요)
      if (!user) {
        requireLogin(editing ? { type: 'edit', id: record.id } : { type: 'write', spot: { key: spot.key, fx: spot.fx, fy: spot.fy }, draft: row },
          tr('loginExpired'));
        return;
      }

      submit.disabled = true; submit.textContent = photo.blob ? tr('uploading') : tr('saving');
      let uploaded = null;
      try {
        let photo_path = record ? record.photo_path : null;
        if (photo.blob) { uploaded = await api.upload(photo.blob); photo_path = uploaded; }
        else if (photo.removed) photo_path = null;
        submit.textContent = tr('saving');
        const saved = editing
          ? await api.update(record.id, { ...row, photo_path })
          : await api.create({ ...row, photo_path, fx: spot.fx, fy: spot.fy });
        // 바꾸거나 뺀 예전 사진은 지웁니다
        if (record && record.photo_path && record.photo_path !== photo_path) api.unlink(record.photo_path).catch(() => {});
        if (photo.url) URL.revokeObjectURL(photo.url);
        records.set(saved.id, { id: saved.id, fx: saved.fx, fy: saved.fy, line: saved.line });
        myIds.add(saved.id);
        feed.put(saved.id);

        if (editing) {
          field.update(saved.id, { text: saved.line, photo: photoOf(saved.photo_path) });
          toast(tr('toastEdited'));
          openRead(saved.id);
        } else {
          // 빈 세잎이 내 세잎이 되고, 들판 어딘가에 새 빈 세잎이 하나 생깁니다
          empties = empties.filter(x => x.key !== spot.key);
          field.update(spot.key, { key: saved.id, kind: 'happy', mine: true, text: saved.line, photo: photoOf(saved.photo_path) });
          field.add(newEmpty());
          close();
          field.reveal(saved.id);
          toast(demo ? tr('toastPlantedDemo') : tr('toastPlanted'));
        }
      } catch (e2) {
        if (uploaded) api.unlink(uploaded).catch(() => {});
        err.textContent = errMsg(e2);
        submit.disabled = false; submit.textContent = editing ? tr('saveEdit') : tr('plant');
      }
    });

    open([head(editing ? tr('writeEyebrowEdit') : tr('writeEyebrowNew'), editing ? tr('writeTitleEdit') : tr('writeTitleNew')), form],
      () => { if (photo.url) URL.revokeObjectURL(photo.url); });
    setTimeout(() => lineIn.focus({ preventScroll: true }), 50);
  }

  /* ---------- deleting ---------- */
  function openDelete(r, back) {
    const yes = h('button', { type: 'button', class: 'btn danger', async onclick() {
      yes.disabled = true; yes.textContent = tr('deleting');
      try {
        await api.remove(r.id);
        if (r.photo_path) api.unlink(r.photo_path).catch(() => {});
        records.delete(r.id); field.remove(r.id); feed.drop(r.id);
        toast(tr('toastDeleted'));
        if (back) back(); else close();
      } catch (e) { yes.disabled = false; yes.textContent = tr('del'); toast(errMsg(e)); }
    } }, tr('del'));
    open([
      head(null, tr('delTitle')),
      h('p', { class: 'note' }, `“${r.line}”`, h('br'), tr('delBody')),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn quiet', onclick: () => back ? back() : openRead(r.id) }, tr('keep')), yes),
    ]);
  }

  /* ---------- reporting ---------- */
  function openReport(id) {
    const reason = h('select', { id: 'f-reason' },
      // the reason is saved in Korean so the admin reads every report the same way
      window.I18N.t('reasons').map((label, i) => h('option', { value: ['불쾌하거나 혐오스러운 내용', '광고나 스팸', '다른 사람의 개인정보', '기타'][i] }, label)));
    const yes = h('button', { type: 'button', class: 'btn danger', async onclick() {
      yes.disabled = true;
      try {
        await api.report(id, reason.value);
        toast(tr('toastReported'));
        close();
      } catch (e) {
        yes.disabled = false;
        toast(e && e.code === '23505' ? tr('alreadyReported') : errMsg(e));
        if (e && e.code === '23505') close();
      }
    } }, tr('reportBtn'));
    open([
      head(null, tr('reportTitle')),
      h('p', { class: 'note' }, tr('reportBody')),
      h('div', { class: 'f' }, h('label', { for: 'f-reason' }, tr('reason')), reason),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn quiet', onclick: () => openRead(id) }, tr('cancel')), yes),
    ]);
  }

  /* ---------- my records ---------- */
  async function openMine() {
    loading(tr('mineTitle'));
    let list;
    try { list = await api.mine(); }
    catch (e) { open([head(null, tr('mineTitle')), h('p', { class: 'note' }, errMsg(e))]); return; }
    const out = h('button', { type: 'button', class: 'btn quiet', onclick: () => navAuth.click() }, tr('logout'));
    if (!list.length) {
      open([head(null, tr('mineTitle')),
        h('p', { class: 'note' }, tr('mineEmpty')),
        h('div', { class: 'row split' }, out, h('button', { type: 'button', class: 'btn primary', onclick: () => { close(); $('nav-write').click(); } }, tr('navWrite')))]);
      return;
    }
    open([
      head(tr('countAll', { n: list.length }), tr('mineTitle')),
      h('ul', { class: 'mine' }, list.map(r => h('li', null,
        h('span', { class: 'eyebrow' }, [dot(r.happy_on), r.place].filter(Boolean).join(' · ')),
        h('span', { class: 'l' }, r.line),
        r.hidden ? h('span', { class: 'badge warn' }, tr('badgeHiddenShort')) : null,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', onclick: () => { close(); field.reveal(r.id, () => openRead(r.id)); } }, tr('showInField')),
          h('button', { type: 'button', class: 'btn', onclick: () => openWrite({ record: r }) }, tr('edit')),
          h('button', { type: 'button', class: 'btn danger', onclick: () => openDelete(r, openMine) }, tr('del')))))),
      h('div', { class: 'row' }, out),
    ]);
  }
  $('nav-mine').addEventListener('click', () => {
    if (requireLogin({ type: 'mine' }, tr('loginWhyMine'))) openMine();
  });

  /* ---------- help, and the card shown on a first visit ---------- */
  function lines(list) { return list.flatMap((l, i) => i ? [h('br'), l] : [l]); }
  function openHelp() {
    // one sentence to a line, so the help reads in short, even steps; the first two depend on touch or mouse
    const steps = tr('steps').map(([b, touch, mouse]) => [b, mouse && !coarse ? mouse : touch]);
    open([
      head(null, tr('help')),
      langPicker(),
      h('ol', { class: 'steps' }, steps.map(([b, ls]) => h('li', null, h('b', null, b), h('span', null, lines(ls))))),
      h('p', { class: 'note' }, lines(tr('mapNote'))),
      skyPicker(),
      h('div', { class: 'row split' },
        h('div', { class: 'row' }, h('a', { href: tr('termsHref'), class: 'btn quiet' }, tr('terms')), h('a', { href: tr('privacyHref'), class: 'btn quiet' }, tr('privacy'))),
        h('button', { type: 'button', class: 'btn primary', onclick: close }, tr('toField'))),
    ]);
  }
  // 한국어 · English · 日本語: choosing one reloads the page in that language
  function langPicker() {
    const I = window.I18N;
    return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': tr('language') },
      I.langs.map(l => h('button', { type: 'button', role: 'radio', lang: l, 'aria-checked': String(l === I.lang), onclick: () => { if (l !== I.lang) I.set(l); } }, I.names[l])));
  }
  // 들판의 시간·계절·날씨: 평소엔 시계와 달력과 날씨를 따르고, 원하면 하나로 고정할 수 있어요
  function seg(kind, label, opts) {
    const now = window.Sky.choice(kind);
    const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label },
      opts.map(([v, t]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === now), onclick(e) {
        window.Sky.set(kind, v);
        for (const b of group.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
      } }, t)));
    return h('div', { class: 'f' }, h('span', { class: 'lab' }, label), group);
  }
  function skyPicker() {
    if (!window.Sky) return null;
    const geo = h('input', { type: 'checkbox', id: 'f-geo', checked: window.Sky.choice('geo') === 'on' });
    geo.addEventListener('change', () => window.Sky.set('geo', geo.checked ? 'on' : 'auto'));
    return h('details', { class: 'more' },
      h('summary', null, tr('decorate')),
      h('div', { class: 'form', style: 'gap:14px' },
        seg('time', tr('time'), [['auto', tr('tAuto')], ['dawn', tr('tDawn')], ['day', tr('tDay')], ['dusk', tr('tDusk')], ['night', tr('tNight')]]),
        seg('season', tr('season'), [['auto', tr('sAuto')], ['spring', tr('sSpring')], ['summer', tr('sSummer')], ['autumn', tr('sAutumn')], ['winter', tr('sWinter')]]),
        seg('weather', tr('weather'), [['auto', tr('wAuto')], ['clear', tr('wClear')], ['cloud', tr('wCloud')], ['rain', tr('wRain')], ['snow', tr('wSnow')], ['fog', tr('wFog')]]),
        h('label', { class: 'check', for: 'f-geo' }, geo,
          h('span', null, tr('geoLabel'), h('br'), h('small', null, tr('geoNote', { place: window.Sky.placeName() }))))));
  }
  if (window.Sky) { window.Sky.mount($('flies')); window.Sky.onChange(st => field.setAtmosphere(st)); }
  $('help-btn').addEventListener('click', openHelp);
  $('nav-lang').addEventListener('click', () => open([head(null, tr('language')), langPicker()]));
  const intro = $('intro');
  // the first card also offers the other languages, for someone who landed in the wrong one
  $('intro-langs').replaceChildren(...window.I18N.langs.filter(l => l !== window.I18N.lang)
    .map(l => h('button', { type: 'button', class: 'btn link', lang: l, onclick: () => window.I18N.set(l) }, window.I18N.names[l])));
  // the card greets every visit; "don't show for a day" hides it for 24 hours on this device
  const SNOOZE = 'happy:intro-until', DAY = 24 * 60 * 60 * 1000;
  try { if (Date.now() < Number(localStorage.getItem(SNOOZE) || 0)) intro.hidden = true; } catch (_) { /* 저장소를 못 쓰면 매번 보여 줘요 */ }
  $('intro-close').addEventListener('click', () => { intro.hidden = true; });
  $('intro-snooze').addEventListener('click', () => {
    intro.hidden = true;
    try { localStorage.setItem(SNOOZE, String(Date.now() + DAY)); } catch (_) { /* 이번만 닫혀요 */ }
  });

  /* ---------- on this day: a line you planted on today's date in an earlier year ---------- */
  async function onThisDay() {
    if (!user) return;
    const t = today(), seen = 'happy:anniv:' + user.id + ':' + t;
    try { if (localStorage.getItem(seen)) return; } catch (_) { return; }
    let mine = [];
    try { mine = await api.mine(); } catch (_) { return; }
    const r = mine.find(x => x.happy_on && x.happy_on.slice(5) === t.slice(5) && x.happy_on < t);
    if (!r) return;
    try { localStorage.setItem(seen, '1'); } catch (_) { /* 괜찮아요 */ }
    const years = Number(t.slice(0, 4)) - Number(r.happy_on.slice(0, 4));
    if (sheet.open) return; // 다른 창을 쓰는 중이면 방해하지 않아요
    open([
      head(tr(years === 1 ? 'yearsAgo' : 'yearsAgoPl', { n: years }), r.line),
      h('p', { class: 'note' }, [dot(r.happy_on), r.place].filter(Boolean).join(' · '), h('br'), tr('annivNote')),
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'btn quiet', onclick: close }, tr('close')),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { close(); field.reveal(r.id, () => openRead(r.id)); } }, tr('showInField'))),
    ]);
  }

  /* ---------- start ---------- */
  (async function start() {
    if (sb) {
      // 구글에서 돌아온 직후라면 여기서 로그인이 마무리됩니다.
      // 일부 앱 안 브라우저에서 이 단계가 멈추는 일이 있어, 8초가 지나면 로그인 없이 들판부터 펼쳐요
      const late = new Promise(res => setTimeout(() => res({ data: { session: null }, late: true }), 8000));
      const { data, late: wasLate } = await Promise.race([sb.auth.getSession(), late]).catch(() => ({ data: { session: null } }));
      if (wasLate) console.warn('getSession timed out');
      await setUser(data.session ? data.session.user : null).catch(() => {});
      const q = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
      const failed = q.get('error_description') || hash.get('error_description');
      if (q.has('code') || q.has('error') || hash.has('access_token') || hash.has('error')) history.replaceState(null, '', location.pathname);
      if (failed) { toast(tr('loginFailed') + ' ' + failed); takePending(); }
      sb.auth.onAuthStateChange((_event, session) => setUser(session ? session.user : null));
    }
    // 들판을 펼치다 문제가 생겨도 '펼치는 중'에 멈춰 있지 않고, 무슨 문제인지 알려 줘요
    try { await load(); }
    catch (e) { console.error(e); toast(tr('loadFail') + ' ' + errMsg(e)); }
    finally { $('loading').classList.add('done'); }
    // opened from a shared link (?c=…): fly to that clover and open it, unless the visitor is back from logging in mid-task
    const shared = new URLSearchParams(location.search).get('c');
    let busy = false;
    try { busy = !!sessionStorage.getItem(PENDING); } catch (_) { /* 없다고 봐요 */ }
    if (shared && !busy) { if (records.has(shared)) field.reveal(shared, () => openRead(shared)); else openRead(shared); }
    resume();
    booted = true;
    onThisDay();
  })();
})();
