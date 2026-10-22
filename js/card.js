/* 공유 카드: 세잎 하나를 인스타 스토리 크기(1080×1920) 그림으로 만듭니다.
   세잎클로버 하나와 그 한 줄만 넓은 여백 가운데에 두고, 맨 아래에만 saeip.com을 적어요.
   모양은 세 가지예요: paper(종이), night(밤 들판), meadow(흐린 들판). */
(function () {
  const W = 1080, H = 1920;
  const SERIF = '"Noto Serif KR", "Noto Serif JP", "Apple SD Gothic Neo", serif';
  const SANS = '"Noto Sans KR", system-ui, -apple-system, "Apple SD Gothic Neo", "Hiragino Sans", sans-serif';

  const STYLES = {
    // 크림색 종이 위에 글만
    paper: { bg: '#f4f1e8', ink: '#1d241f', muted: '#8a928b', mark: '#2f8a4f', url: '#2f8a4f' },
    // 밤 들판: 어두운 숲색 위에 빛나는 세잎클로버와 반딧불이 몇 개
    night: { bg: '#0e1410', ink: '#eef3ea', muted: '#8fa394', mark: '#7fcf95', url: '#7fcf95' },
    // 지금 보던 들판을 아주 흐리게 깔고 그 위에 글
    meadow: { bg: '#16231a', ink: '#f6f3ea', muted: 'rgba(246,243,234,0.72)', mark: '#9fe0b0', url: '#f6f3ea' },
  };

  // 로고: 위와 오른쪽 잎을 이으면 3, 왼쪽 잎은 웃는 입 (index.html의 #mark와 같은 모양)
  const MARK_PATH = 'M36.1 21.2A17 17 0 1 1 57.8 46.1L58.2 46.9A17 17 0 1 1 55.1 75.0M45.4 70.2A17 17 0 0 1 14.6 70.2M50 80Q51 89 57 95';
  function drawMark(c, cx, cy, size, color) {
    c.save();
    c.translate(cx - size / 2, cy - size / 2); c.scale(size / 88, size / 88); c.translate(-8, -6);
    c.strokeStyle = c.fillStyle = color; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
    c.stroke(new Path2D(MARK_PATH));
    for (const x of [23.5, 36.5]) { c.beginPath(); c.arc(x, 61, 4.3, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  // 세잎클로버: 하트 모양 잎 세 장(위, 오른쪽 아래, 왼쪽 아래)과 잎마다 옅은 V 무늬, 짧은 줄기
  function drawClover(c, cx, cy, L, tone) {
    const T = {
      paper: { a: '#4f9a5f', b: '#2c6e3d', vein: 'rgba(20,60,30,0.35)', mark: 'rgba(235,245,225,0.55)', stem: '#3c7c4a' },
      night: { a: '#86d49a', b: '#3f8f57', vein: 'rgba(10,40,20,0.35)', mark: 'rgba(240,252,235,0.5)', stem: '#5aa86e' },
      meadow: { a: '#a6e2b3', b: '#5daa70', vein: 'rgba(10,40,20,0.3)', mark: 'rgba(245,255,240,0.55)', stem: '#7cc48e' },
    }[tone] || null;
    const C = T || { a: '#86d49a', b: '#3f8f57', vein: 'rgba(10,40,20,0.35)', mark: 'rgba(240,252,235,0.5)', stem: '#5aa86e' };
    c.save(); c.translate(cx, cy);
    if (tone === 'night') {
      const glow = c.createRadialGradient(0, 0, 0, 0, 0, L * 2.6);
      glow.addColorStop(0, 'rgba(150,230,170,0.22)'); glow.addColorStop(1, 'rgba(150,230,170,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(0, 0, L * 2.6, 0, Math.PI * 2); c.fill();
    }
    // 줄기
    c.strokeStyle = C.stem; c.lineWidth = L * 0.09; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, L * 0.05); c.quadraticCurveTo(L * 0.08, L * 0.8, L * 0.42, L * 1.35); c.stroke();
    const leaf = new Path2D(
      `M0 0C${L * 0.12} ${-L * 0.36} ${L * 0.5} ${-L * 0.66} ${L * 0.8} ${-L * 0.46}` +
      `C${L * 1.03} ${-L * 0.3} ${L * 1.02} ${-L * 0.06} ${L * 0.86} 0` +
      `C${L * 1.02} ${L * 0.06} ${L * 1.03} ${L * 0.3} ${L * 0.8} ${L * 0.46}` +
      `C${L * 0.5} ${L * 0.66} ${L * 0.12} ${L * 0.36} 0 0Z`);
    for (const deg of [-90, 30, 150]) {
      c.save(); c.rotate(deg * Math.PI / 180);
      const g = c.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, C.b); g.addColorStop(1, C.a);
      c.fillStyle = g; c.fill(leaf);
      c.strokeStyle = C.vein; c.lineWidth = L * 0.025;
      c.beginPath(); c.moveTo(L * 0.06, 0); c.lineTo(L * 0.8, 0); c.stroke();
      c.strokeStyle = C.mark; c.lineWidth = L * 0.045; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(L * 0.58, -L * 0.28); c.lineTo(L * 0.4, 0); c.lineTo(L * 0.58, L * 0.28); c.stroke();
      c.restore();
    }
    c.restore();
  }

  // 한국어·일본어는 띄어쓰기 없이도 줄이 바뀌어야 해서, 단어가 너무 길면 글자 단위로 나눠요
  function wrap(c, text, width, maxLines) {
    const lines = [];
    let cur = '';
    const push = () => { lines.push(cur.trim()); cur = ''; };
    for (const word of text.split(/(\s+)/)) {
      if (c.measureText(cur + word).width <= width) { cur += word; continue; }
      if (cur.trim()) push();
      if (c.measureText(word).width <= width) { cur = word.trimStart(); continue; }
      for (const ch of [...word]) {
        if (c.measureText(cur + ch).width > width && cur) push();
        cur += ch;
      }
    }
    if (cur.trim()) push();
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (last && c.measureText(last + '…').width > width) last = [...last].slice(0, -1).join('');
      lines[maxLines - 1] = last + '…';
    }
    return lines;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function loadImage(src) {
    return new Promise(res => {
      if (!src) return res(null);
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Supabase 사진도 그림에 넣을 수 있게
      img.onload = () => res(img); img.onerror = () => res(null);
      img.src = src;
    });
  }

  // 글자 크기는 글 길이에 맞춰: 짧은 한 줄은 크게, 긴 글은 조금 작게
  function fitLines(c, text, width, maxH) {
    for (let size = 72; size >= 44; size -= 4) {
      c.font = `500 ${size}px ${SERIF}`;
      const lines = wrap(c, text, width, 7);
      const lh = Math.round(size * 1.6);
      if (lines.length * lh <= maxH || size === 44) return { lines, size, lh };
    }
  }

  // { line, eyebrow, photoUrl, field, style } → JPEG Blob
  window.makeCard = async function ({ line, eyebrow, photoUrl, field, style }) {
    const S = STYLES[style] || STYLES.night;
    try {
      await Promise.all([document.fonts.load(`500 64px ${SERIF}`, line || '가'), document.fonts.load(`400 34px ${SANS}`, (eyebrow || '') + 'saeip.com')]);
    } catch (_) { /* 기본 글꼴로 그려요 */ }
    const photo = await loadImage(photoUrl);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    if (!c) throw new Error('canvas');

    // 바탕
    c.fillStyle = S.bg; c.fillRect(0, 0, W, H);
    if (style === 'meadow' && field && field.width) {
      // 아주 작게 줄였다 키우면 어느 브라우저에서나 부드럽게 흐려져요
      const t = document.createElement('canvas'); t.width = 27; t.height = 48;
      const tc = t.getContext('2d');
      if (tc) {
        const k = Math.max(t.width / field.width, t.height / field.height);
        try { tc.drawImage(field, (t.width - field.width * k) / 2, (t.height - field.height * k) / 2, field.width * k, field.height * k); } catch (_) { /* 바탕색만 */ }
        // 한 번에 키우면 네모가 보여서, 두 번에 나눠 키워요
        const m = document.createElement('canvas'); m.width = 270; m.height = 480;
        const mc = m.getContext('2d');
        c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
        if (mc) { mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high'; mc.drawImage(t, 0, 0, m.width, m.height); c.drawImage(m, 0, 0, W, H); }
        else c.drawImage(t, 0, 0, W, H);
      }
      c.fillStyle = 'rgba(10,18,12,0.38)'; c.fillRect(0, 0, W, H);
    }
    if (style === 'night' || !STYLES[style]) {
      const g = c.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, H * 0.7);
      g.addColorStop(0, 'rgba(40,70,48,0.55)'); g.addColorStop(1, 'rgba(14,20,16,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // 반딧불이 몇 개 (매번 같은 자리에 오도록 글에서 씨앗을 얻어요)
      let seed = 0; for (const ch of line || '') seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 9; i++) {
        // 글이 있는 가운데는 비워 두고, 위아래 여백에만
        const x = 80 + rnd() * (W - 160), y = i % 2 ? 120 + rnd() * 330 : H - 520 + rnd() * 260, r = 3 + rnd() * 4;
        const f = c.createRadialGradient(x, y, 0, x, y, r * 6);
        f.addColorStop(0, 'rgba(226,240,150,0.85)'); f.addColorStop(1, 'rgba(226,240,150,0)');
        c.fillStyle = f; c.beginPath(); c.arc(x, y, r * 6, 0, Math.PI * 2); c.fill();
      }
    }

    // 내용: (사진) → 꽃 또는 로고 → 날짜·장소 → 한 줄, 모두 가운데 정렬로 세로 가운데에
    const M = 130, width = W - M * 2;
    const photoSide = photo ? 640 : 0;
    const fit = fitLines(c, line || '', width, photo ? 480 : 700);
    const block = (photo ? photoSide + 290 : 330) + (eyebrow ? 70 : 0) + fit.lines.length * fit.lh;
    let y = Math.max(170, (H - 200 - block) / 2);

    if (photo) {
      const x = (W - photoSide) / 2, s = Math.min(photo.naturalWidth, photo.naturalHeight);
      c.save(); roundRect(c, x, y, photoSide, photoSide, 36); c.clip();
      c.drawImage(photo, (photo.naturalWidth - s) / 2, (photo.naturalHeight - s) / 2, s, s, x, y, photoSide, photoSide);
      c.restore();
      y += photoSide + 160;
    } else {
      // 사진이 없으면 세잎클로버가 주인공이에요
      drawClover(c, W / 2, y + 120, 118, STYLES[style] ? style : 'night');
      y += 330;
    }
    if (photo) {
      // 사진이 있어도 세잎은 빠지지 않게, 사진 아래에 작게
      drawClover(c, W / 2, y, 50, STYLES[style] ? style : 'night');
      y += 130;
    }

    c.textAlign = 'center'; c.textBaseline = 'top';
    if (eyebrow) {
      c.font = `400 32px ${SANS}`; c.fillStyle = S.muted;
      c.fillText(wrap(c, eyebrow, width, 1)[0], W / 2, y);
      y += 70;
    }
    c.font = `500 ${fit.size}px ${SERIF}`; c.fillStyle = S.ink;
    for (const l of fit.lines) { c.fillText(l, W / 2, y); y += fit.lh; }

    // 맨 아래: 작은 로고와 주소만
    const by = H - 170;
    c.font = `500 38px ${SANS}`;
    const tw = c.measureText('saeip.com').width, gap = 16, ms = 46;
    const sx = W / 2 - (ms + gap + tw) / 2;
    drawMark(c, sx + ms / 2, by + 20, ms, S.mark);
    c.textAlign = 'left'; c.fillStyle = S.url;
    c.fillText('saeip.com', sx + ms + gap, by);

    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) throw new Error('card');
    return blob;
  };
})();
