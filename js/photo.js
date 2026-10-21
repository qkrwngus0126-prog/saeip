/* 사진 줄이기: 올리기 전에 브라우저에서 긴 변 1600px, JPEG로 다시 저장해 보통 300KB~800KB로 만듭니다. */
(function () {
  const MAX_SIDE = 1600;
  const TARGET = 900 * 1024;   // 이보다 크면 화질을 조금씩 낮춰 다시 저장
  const LIMIT = 2 * 1024 * 1024; // Storage 버킷 한도와 같아요

  const t = k => (window.I18N ? window.I18N.t(k) : k);

  window.shrinkPhoto = async function (file) {
    if (!file.type.startsWith('image/')) throw new Error(t('photoOnly'));
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      // 휴대폰 사진의 회전 정보는 브라우저가 알아서 반영해요
      await img.decode().catch(() => { throw new Error(t('photoBad')); });
      let side = MAX_SIDE, quality = 0.84, blob = null;
      for (let round = 0; round < 6; round++) {
        const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); // 투명한 PNG도 흰 바탕으로
        ctx.drawImage(img, 0, 0, w, h);
        blob = await new Promise(res => c.toBlob(res, 'image/jpeg', quality));
        if (blob && blob.size <= TARGET) break;
        if (quality > 0.62) quality -= 0.08; else side = Math.round(side * 0.8);
      }
      if (!blob || blob.size > LIMIT) throw new Error(t('photoBig'));
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // 들판 이름표용 작은 사진: 가운데를 정사각형으로 잘라 160px로 (보통 5~10KB)
  window.thumbPhoto = async function (blob) {
    const SIDE = 160;
    const img = await createImageBitmap(blob);
    const s = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = SIDE;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, SIDE, SIDE);
    if (img.close) img.close();
    const out = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.8));
    if (!out) throw new Error('thumb');
    return out;
  };
})();
