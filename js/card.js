/* 공유 카드: 세잎 하나를 인스타 스토리 크기(1080×1920) 그림으로 만듭니다.
   배경은 지금 보고 있는 들판, 가운데에 그 세잎의 한 줄과 날짜·장소, 사진(있으면), 맨 아래 saeip.com. */
(function () {
  const W = 1080, H = 1920;
  const FONT = '"Noto Sans KR", system-ui, -apple-system, "Apple SD Gothic Neo", "Hiragino Sans", sans-serif';
  const GREEN = '#2f8a4f', INK = '#1d241f', MUTED = '#6f7a71', PAPER = 'rgba(248,246,237,0.95)';

  // 로고: 위와 오른쪽 잎을 이으면 3, 왼쪽 잎은 웃는 입 (index.html의 #mark와 같은 모양)
  const MARK_VB = { x: 8, y: 6, w: 88, h: 92 };
  const MARK_PATH = 'M36.1 21.2A17 17 0 1 1 57.8 46.1L58.2 46.9A17 17 0 1 1 55.1 75.0M45.4 70.2A17 17 0 0 1 14.6 70.2M50 80Q51 89 57 95';
  function drawMark(c, x, y, size) {
    c.save();
    c.translate(x, y); c.scale(size / MARK_VB.w, size / MARK_VB.w); c.translate(-MARK_VB.x, -MARK_VB.y);
    c.strokeStyle = c.fillStyle = GREEN; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
    c.stroke(new Path2D(MARK_PATH));
    for (const cx of [23.5, 36.5]) { c.beginPath(); c.arc(cx, 61, 4.3, 0, Math.PI * 2); c.fill(); }
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

  // { line, eyebrow, foot, photoUrl, field } → JPEG Blob
  window.makeCard = async function ({ line, eyebrow, foot, photoUrl, field }) {
    try { await Promise.all([document.fonts.load(`500 60px ${FONT}`), document.fonts.load(`400 30px ${FONT}`)]); } catch (_) { /* 기본 글꼴로 그려요 */ }
    const photo = await loadImage(photoUrl);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    if (!c) throw new Error('canvas');

    // 배경: 지금 보이는 들판을 세로로 꽉 채우고 살짝 어둡게
    c.fillStyle = '#16231a'; c.fillRect(0, 0, W, H);
    if (field && field.width) {
      const k = Math.max(W / field.width, H / field.height);
      const dw = field.width * k, dh = field.height * k;
      try { c.drawImage(field, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (_) { /* 배경 없이 */ }
    }
    const shade = c.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(8,14,10,0.35)'); shade.addColorStop(0.5, 'rgba(8,14,10,0.18)'); shade.addColorStop(1, 'rgba(8,14,10,0.5)');
    c.fillStyle = shade; c.fillRect(0, 0, W, H);

    // 카드 안의 내용을 먼저 재고, 그 높이에 맞춰 카드를 그려요
    const CW = 860, PAD = 72, inner = CW - PAD * 2;
    c.font = `500 60px ${FONT}`;
    const lines = wrap(c, line || '', inner, 6);
    const LINE_H = 84;
    let photoH = 0, pw = 0;
    if (photo) {
      pw = inner;
      photoH = Math.min(560, Math.round(photo.naturalHeight * (pw / photo.naturalWidth)));
    }
    const MARK = 76;
    const h = PAD + MARK + 40 + (eyebrow ? 52 : 0) + lines.length * LINE_H + (photo ? 48 + photoH : 0) + PAD;
    const x = (W - CW) / 2, y = Math.max(160, (H - h) / 2 - 40);

    c.save();
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 60; c.shadowOffsetY = 24;
    roundRect(c, x, y, CW, h, 44); c.fillStyle = PAPER; c.fill();
    c.restore();

    let cy = y + PAD;
    drawMark(c, x + PAD - 6, cy, MARK);
    cy += MARK + 40;
    c.textBaseline = 'top';
    if (eyebrow) {
      c.font = `400 32px ${FONT}`; c.fillStyle = MUTED;
      c.fillText(wrap(c, eyebrow, inner, 1)[0], x + PAD, cy);
      cy += 52;
    }
    c.font = `500 60px ${FONT}`; c.fillStyle = INK;
    for (const l of lines) { c.fillText(l, x + PAD, cy + 6); cy += LINE_H; }
    if (photo) {
      cy += 48;
      c.save(); roundRect(c, x + PAD, cy, pw, photoH, 24); c.clip();
      // 사진은 가로를 맞추고, 너무 길면 가운데만
      const k = pw / photo.naturalWidth, fullH = photo.naturalHeight * k;
      c.drawImage(photo, x + PAD, cy - (fullH - photoH) / 2, pw, fullH);
      c.restore();
    }

    // 맨 아래: 사이트 소개 한 줄과 주소
    c.textAlign = 'center'; c.fillStyle = 'rgba(248,246,237,0.92)';
    c.font = `400 34px ${FONT}`;
    if (foot) c.fillText(foot, W / 2, H - 250);
    c.font = `500 52px ${FONT}`;
    c.fillText('saeip.com', W / 2, H - 190);

    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) throw new Error('card');
    return blob;
  };
})();
