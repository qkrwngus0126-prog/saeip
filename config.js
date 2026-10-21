/* 사이트 설정. 이 파일만 고치면 됩니다.

   supabaseUrl  : Supabase 프로젝트 주소 (https://xxxx.supabase.co)
   supabaseKey  : 공개용 키 — "Publishable key"(sb_publishable_로 시작) 또는 "anon public" 키
                  ⚠️ "secret" / "service_role" 키는 절대 넣지 마세요. 넣으면 사이트가 스스로 멈춥니다.

   둘 다 비워 두면 저장 없이 예시 기록으로만 움직이는 미리보기 모드로 열립니다. */
window.HAPPY_CONFIG = {
  supabaseUrl: 'https://kddwszxlmdlkgskxmwgg.supabase.co',
  supabaseKey: 'sb_publishable_UD4h3VkCUPhEbG8D5zLbxA_Qq18y5BY',

  // 사진을 넣을 Storage 버킷 이름 (supabase-setup.sql과 같아야 해요)
  photoBucket: 'happy-photos',

  // 로그인 버튼 목록. Supabase에서 켜져 있는 것만 버튼으로 보여요(꺼져 있으면 저절로 숨어요).
  loginProviders: [
    { id: 'google', label: 'Google로 계속하기' },
    { id: 'kakao', label: '카카오로 계속하기' },
  ],

  // 들판의 처음 크기(px)와 빈 세잎 개수. 손댈 필요 없어요.
  // 기록이 약 400개를 넘으면 들판이 저절로 넓어지고, 빈 세잎도 같은 비율로 늘어나요.
  // (기존 세잎은 들판 안의 같은 비율 위치에 그대로 남아요)
  fieldWidth: 3600,
  fieldHeight: 2400,
  emptyClovers: 80,

  // 들판이 커질 수 있는 최대 배율(가로·세로 각각). 3이면 처음 넓이의 9배, 기록 약 4,000개까지 여유 있게 들어가요.
  fieldMaxGrow: 3,
};
