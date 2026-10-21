/* 언어: 한국어 · English · 日本語
   처음 오면 브라우저 언어를 따르고(한국어·일본어가 아니면 영어), 고른 언어는 이 기기에 기억해요.
   문장을 고치려면 아래 표에서 그 줄만 바꾸면 돼요. {n}, {d} 같은 자리는 숫자나 날짜로 채워져요.

   I18N.t('key', { n: 3 })   I18N.lang   I18N.set('en')   I18N.date('2026-10-19') */
(function () {
  const KEY = 'happy:lang';
  const LANGS = ['ko', 'en', 'ja'];

  const T = {
    // site
    brand: ['saeip', 'saeip', 'saeip'],
    desc: [
      '사람들은 행운(네잎)을 찾느라 행복(세잎)을 지나칩니다. 네잎클로버 들판을 헤집어 다른 사람이 숨겨 둔 행복을 읽고, 내 행복도 하나 심어 두세요.',
      'People pass by happiness (three leaves) while looking for luck (four leaves). Dig through a meadow of four-leaf clovers, read the happiness others left, and plant one of your own.',
      '人は幸運(四つ葉)を探すうちに、幸せ(三つ葉)を見過ごしてしまいます。四つ葉の野原をかき分けて誰かの幸せを読み、あなたの幸せもひとつ植えてください。',
    ],
    navWrite: ['행복 적기', 'Write', '幸せを書く'],
    navMine: ['내 기록', 'My clovers', 'わたしの記録'],
    login: ['로그인', 'Log in', 'ログイン'],
    logout: ['로그아웃', 'Log out', 'ログアウト'],
    langBtn: ['언어', 'Language', '言語'],
    introTitle: [['행운을 찾다 지나친 행복을', '같이 적어 둡니다'], ['The happiness we pass by', 'while looking for luck'], ['幸運を探して見過ごした幸せを、', 'みんなで書き留める場所']],
    introBody: [
      ['들판은 온통 네잎클로버예요.', '흰 꽃이 핀 곳엔 누군가 적어 둔 행복이 있고,', '꽃이 없는 곳 아래엔 빈 세잎이 숨어 있어요.', '헤집어 찾아서 내 행복을 심어 주세요.'],
      ['The meadow is all four-leaf clovers.', 'Where a white flower blooms, someone left their happiness;', 'beneath the bare spots, empty three-leaf clovers hide.', 'Dig one up and plant a happiness of your own.'],
      ['野原は一面の四つ葉。', '白い花が咲くところには、誰かの幸せが。', '花のないところの下には、空っぽの三つ葉が隠れています。', 'かき分けて見つけたら、あなたの幸せを植えてください。'],
    ],
    introGo: ['세잎클로버 찾아보기', 'Find three-leaf clovers', '三つ葉を探してみる'],
    introSnooze: ['하루 동안 보지 않기', "Don't show for a day", '1日表示しない'],
    feedTitle: ['들판에 적힌 행복', 'Happiness in the meadow', '野原に書かれた幸せ'],
    feedClose: ['목록 닫기', 'Close the list', '一覧を閉じる'],
    showInField: ['들판에서 보기', 'Show in the meadow', '野原で見る'],
    demoNote: ['미리보기예요 · config.js를 채우면 실제로 저장돼요', 'Preview · fill in config.js to save for real', 'プレビューです · config.js を設定すると保存されます'],
    libFail: ['Supabase 라이브러리를 불러오지 못해 미리보기로 열었어요. 인터넷 연결을 확인해 주세요.', "Couldn't load Supabase, so this is a preview. Check your connection.", 'Supabase を読み込めなかったため、プレビューで開きました。接続を確認してください。'],
    secretKey: [
      'config.js에 관리자용(secret / service_role) 키가 들어 있어요. 이 키는 공개되면 안 됩니다. 지금 바로 지우고, Supabase에서 그 키를 새로 발급(rotate)해 주세요. 공개용 Publishable(anon) 키를 넣어야 해요.',
      'config.js holds an admin (secret / service_role) key. It must never be public: remove it now, rotate it in Supabase, and use the publishable (anon) key instead.',
      'config.js に管理者用(secret / service_role)のキーが入っています。公開してはいけないキーです。すぐに削除し、Supabase で再発行(rotate)して、公開用の Publishable(anon)キーを入れてください。',
    ],
    canvas: [
      '화면보다 넓은 네잎클로버 들판. 그 아래 사람들이 적어 둔 세잎클로버와 빈 세잎클로버가 숨어 있습니다. 화살표 키로 둘러보고, 하나 보여 주기 버튼으로도 찾을 수 있습니다.',
      'A meadow of four-leaf clovers, wider than the screen. Beneath it hide three-leaf clovers people wrote on, and empty ones. Move around with the arrow keys, or use "Show me one".',
      '画面より広い四つ葉の野原。その下に、誰かが書いた三つ葉と空っぽの三つ葉が隠れています。矢印キーで見て回れます。「ひとつ見せて」でも探せます。',
    ],
    noscript: ['이 들판은 스크립트가 켜져 있을 때 헤집을 수 있어요.', 'This meadow needs JavaScript to dig through.', 'この野原をかき分けるには JavaScript が必要です。'],

    // the bar along the bottom
    help: ['이렇게 써요', 'How it works', '使い方'],
    found: ['찾은 세잎', 'Found', '見つけた三つ葉'],
    idleTouch: ['한 손가락으로 헤집고, 두 손가락으로 둘러보세요', 'Dig with one finger, move around with two', '指一本でかき分けて、二本で見て回れます'],
    idleMouse: ['마우스를 올려 헤집고, 끌거나 스크롤해서 둘러보세요', 'Move the mouse to dig; drag or scroll to look around', 'マウスでかき分けて、ドラッグかスクロールで見て回れます'],
    writeHere: ['여기에 적기', 'Write here', 'ここに書く'],
    open: ['열어 보기', 'Open', '開く'],
    foundEmpty: ['빈 세잎이에요. 눌러서 행복을 적어 보세요.', 'An empty clover. Open it to write your happiness.', '空っぽの三つ葉です。開いて幸せを書いてみてください。'],
    foundMine: ['내가 심은 세잎이에요.', 'One you planted.', 'あなたが植えた三つ葉です。'],
    foundOther: ['누군가의 행복이에요. 눌러서 읽어 보세요.', "Someone's happiness. Open it to read.", '誰かの幸せです。開いて読んでみてください。'],
    foundAll: ['들판의 세잎을 모두 찾았어요. 행복은 원래 흔했습니다.', 'You found every clover. Happiness was never rare.', '野原の三つ葉をすべて見つけました。幸せは、もともとありふれたものでした。'],
    showOne: ['하나 보여 주기', 'Show me one', 'ひとつ見せて'],
    allFound: ['다 찾았어요', 'All found', '全部見つけた'],

    // labels over clovers
    tagEmpty: ['빈 세잎 · 눌러서 적기', 'Empty clover · write here', '空っぽの三つ葉 · ここに書く'],
    tagMine: ['내가 심은 세잎 · 눌러서 읽기', 'Your clover · read', 'あなたの三つ葉 · 読む'],
    tagOther: ['누군가의 행복 · 눌러서 읽기', "Someone's happiness · read", '誰かの幸せ · 読む'],

    // errors and toasts
    errNet: ['인터넷 연결을 확인하고 다시 해 주세요.', 'Check your connection and try again.', '接続を確認して、もう一度お試しください。'],
    errAuth: ['로그인이 풀렸어요. 다시 로그인해 주세요.', 'You were logged out. Please log in again.', 'ログインが切れました。もう一度ログインしてください。'],
    errRetry: ['잠시 후 다시 해 주세요. ({m})', 'Please try again in a moment. ({m})', '少し時間をおいて、もう一度お試しください。({m})'],
    loadFail: ['기록을 불러오지 못했어요.', "Couldn't load the clovers.", '記録を読み込めませんでした。'],
    oops: ['문제가 생겼어요.', 'Something went wrong.', '問題が起きました。'],
    cantDelete: ['지울 수 없는 기록이에요.', "This one can't be deleted.", 'この記録は削除できません。'],
    loading: ['불러오는 중…', 'Loading…', '読み込み中…'],
    close: ['닫기', 'Close', '閉じる'],
    cancel: ['취소', 'Cancel', 'キャンセル'],

    // login
    loginTitle: ['로그인이 필요해요', 'Please log in', 'ログインが必要です'],
    loginWhyWrite: ['행복을 적으려면 로그인해 주세요. 읽기는 로그인 없이 할 수 있어요.', 'Log in to write. Reading needs no account.', '書くにはログインしてください。読むだけならログインは不要です。'],
    loginBack: ['로그인하면 지금 하던 곳으로 바로 돌아와요.', "You'll come right back to where you were.", 'ログインすると、今いた場所にすぐ戻ります。'],
    provider_google: ['Google로 계속하기', 'Continue with Google', 'Google で続ける'],
    provider_kakao: ['카카오로 계속하기', 'Continue with Kakao', 'カカオで続ける'],
    loginDemo: ['미리보기에서는 누르면 바로 로그인한 것처럼 움직여요.', 'In the preview, this logs you in straight away.', 'プレビューでは、押すとすぐにログインした状態になります。'],
    loginFail: ['로그인을 시작하지 못했어요.', "Couldn't start logging in.", 'ログインを始められませんでした。'],
    loginFailed: ['로그인하지 못했어요.', "Couldn't log in.", 'ログインできませんでした。'],
    loginWhyHeader: ['로그인하면 행복을 적고, 내가 쓴 기록을 고치거나 지울 수 있어요.', 'Log in to write, and to edit or delete what you wrote.', 'ログインすると、幸せを書いたり、自分の記録を直したり消したりできます。'],
    loggedOut: ['로그아웃했어요.', 'Logged out.', 'ログアウトしました。'],
    loginWhyReport: ['신고하려면 로그인해 주세요. 한 사람이 한 기록에 한 번만 신고할 수 있어요.', 'Log in to report. Each person can report a clover once.', '通報するにはログインしてください。ひとつの記録に通報できるのは一人一回です。'],
    loginWhyMine: ['내 기록을 보려면 로그인해 주세요.', 'Log in to see your clovers.', '自分の記録を見るにはログインしてください。'],
    loginExpired: ['로그인이 풀렸어요. 다시 로그인하면 쓰던 글로 돌아와요.', "You were logged out. Log in again and you'll return to your draft.", 'ログインが切れました。もう一度ログインすると、書きかけの文章に戻ります。'],

    loginAge: ['만 14세 이상만 기록할 수 있어요. 계속하면 이용 규칙과 개인정보처리방침에 동의하는 것으로 봐요.', 'You must be 14 or older to write. By continuing you agree to the house rules and the privacy policy.', '記録できるのは14歳以上の方です。続けると、利用ルールとプライバシーポリシーに同意したものとみなします。'],
    // opened inside an app (KakaoTalk, Instagram…), where Google refuses to sign anyone in
    inAppTitle: ['이 앱 안에서는 구글 로그인이 막혀 있어요', 'Google sign-in is blocked inside this app', 'このアプリの中では Google ログインが使えません'],
    inAppKakao: ['카카오로 로그인하거나, 바깥 브라우저로 열어 구글로 로그인해 주세요.', 'Log in with Kakao, or open this page in your browser to use Google.', 'カカオでログインするか、ブラウザで開いて Google でログインしてください。'],
    inAppOther: ['바깥 브라우저(Chrome, Safari)로 열면 로그인할 수 있어요.', 'Open this page in your browser (Chrome or Safari) to log in.', 'ブラウザ(Chrome・Safari)で開くとログインできます。'],
    inAppIos: ['오른쪽 아래나 위의 ⋯ 메뉴에서 "Safari로 열기"를 눌러 주세요. 링크를 복사해서 Safari에 붙여넣어도 돼요.', 'Tap the ⋯ menu and choose "Open in Safari", or copy the link and paste it into Safari.', '⋯ メニューから「Safariで開く」を選ぶか、リンクをコピーして Safari に貼り付けてください。'],
    openBrowser: ['브라우저로 열기', 'Open in browser', 'ブラウザで開く'],
    copyLink: ['링크 복사', 'Copy link', 'リンクをコピー'],
    linkCopiedPlain: ['링크를 복사했어요.', 'Link copied.', 'リンクをコピーしました。'],
    terms: ['이용 규칙', 'House rules', '利用ルール'],
    termsHref: ['terms.html', 'terms-en.html', 'terms-ja.html'],
    errDaily: ['오늘은 여기까지 심을 수 있어요. 내일 또 와 주세요.', "That's all you can plant today. Come back tomorrow.", '今日植えられるのはここまでです。また明日来てください。'],
    shareLink: ['링크 보내기', 'Share link', 'リンクを送る'],
    linkCopied: ['링크를 복사했어요. 이 링크로 들어오면 이 세잎으로 바로 와요.', 'Link copied. It opens right at this clover.', 'リンクをコピーしました。このリンクから来ると、この三つ葉がすぐに開きます。'],
    shareText: ['saeip에 심어 둔 행복 하나', 'A little happiness planted in the meadow', '野原に植えた小さな幸せ'],
    spreading: ['들판을 펼치는 중…', 'Spreading out the meadow…', '野原を広げています…'],

    // an empty clover
    emptyEyebrow: ['빈 세잎', 'Empty clover', '空っぽの三つ葉'],
    emptyTitle: ['아직 아무도 적지 않은 세잎이에요', 'No one has written on this one yet', 'まだ誰も書いていない三つ葉です'],
    emptyBody: ['여기에 행복을 적으면 이 자리에 계속 남아서, 다음에 들판을 헤집는 사람이 찾을 수 있어요.', 'Write your happiness here and it stays in this spot, for the next person digging through the meadow to find.', 'ここに幸せを書くと、この場所にずっと残り、次に野原をかき分ける人が見つけられます。'],
    emptyWrite: ['여기에 행복 적기', 'Write my happiness here', 'ここに幸せを書く'],

    // reading
    readFail: ['세잎을 열지 못했어요', "Couldn't open this clover", '三つ葉を開けませんでした'],
    gone: ['이제 볼 수 없는 세잎이에요', 'This clover is gone', 'もう見られない三つ葉です'],
    goneBody: ['글쓴이가 지웠거나, 신고가 쌓여 잠시 숨겨진 기록이에요.', 'Its writer deleted it, or it is hidden for now after several reports.', '書いた人が削除したか、通報が重なって一時的に隠されています。'],
    readMore: ['조금 더 읽기', 'Read more', 'もう少し読む'],
    fold: ['접기', 'Less', 'たたむ'],
    badgeMine: ['내가 심은 세잎', 'Planted by you', 'あなたが植えた三つ葉'],
    badgeHidden: ['신고가 쌓여 지금은 나에게만 보여요', 'Hidden after reports — only you can see it', '通報が重なり、今はあなたにだけ見えています'],
    photoAlt: ['글쓴이가 함께 올린 사진', 'Photo shared with this clover', '一緒に投稿された写真'],
    plantedOn: ['{d}에 심음', 'Planted {d}', '{d}に植えました'],
    edited: ['고침', 'edited', '編集済み'],
    edit: ['고치기', 'Edit', '直す'],
    del: ['지우기', 'Delete', '削除'],
    report: ['신고', 'Report', '通報'],

    // writing
    placePh: ['예: 동네 빵집 앞 벤치', 'e.g. the bench outside the bakery', '例: 近所のパン屋の前のベンチ'],
    linePh: ['오늘 나를 웃게 한 작은 일', 'A small thing that made you smile', '今日、あなたを笑顔にした小さなこと'],
    morePh: ['길게 쓰고 싶을 때만 적어 주세요. 읽는 사람은 한 줄을 먼저 보고, 눌러야 이 글이 펼쳐져요.', 'Only if you want to say more. Readers see your one line first and open this if they like.', '長く書きたいときだけどうぞ。読む人はまず一行を見て、開くとこの文章が出てきます。'],
    photoPrevAlt: ['고른 사진 미리보기', 'Preview of the chosen photo', '選んだ写真のプレビュー'],
    pickPhoto: ['사진 고르기', 'Choose a photo', '写真を選ぶ'],
    dropPhoto: ['사진 빼기', 'Remove photo', '写真を外す'],
    photoNow: ['지금 사진', 'Current photo', '今の写真'],
    photoOther: ['다른 사진으로', 'Choose another', '別の写真にする'],
    shrinking: ['사진 줄이는 중…', 'Resizing photo…', '写真を縮小中…'],
    shrinkFail: ['사진을 줄이지 못했어요.', "Couldn't resize the photo.", '写真を縮小できませんでした。'],
    saveEdit: ['고친 내용 저장', 'Save changes', '変更を保存'],
    plant: ['들판에 심기', 'Plant it', '野原に植える'],
    labelDate: ['행복했던 날', 'The happy day', '幸せだった日'],
    labelPlace: ['장소', 'Place', '場所'],
    optional: ['선택', 'optional', '任意'],
    labelLine: ['한 줄', 'One line', 'ひとこと'],
    moreSummary: ['조금 더 적기 (선택)', 'Say a little more (optional)', 'もう少し書く(任意)'],
    moreLabel: ['길게 적기', 'More', '詳しく'],
    labelPhoto: ['사진', 'Photo', '写真'],
    photoOpt: ['선택 · 1장', 'optional · 1', '任意 · 1枚'],
    errLineReq: ['한 줄은 꼭 적어 주세요.', 'Please write your one line.', 'ひとことは必ず書いてください。'],
    errLineMax: ['한 줄은 {n}자까지예요.', 'One line can be up to {n} characters.', 'ひとことは{n}文字までです。'],
    errDate: ['행복했던 날은 오늘이나 그 전 날짜로 골라 주세요.', 'Pick today or an earlier day.', '幸せだった日は、今日かそれより前の日を選んでください。'],
    errLen: ['글자 수를 조금 줄여 주세요.', 'Please make it a little shorter.', '文字数を少し減らしてください。'],
    uploading: ['사진 올리는 중…', 'Uploading photo…', '写真をアップロード中…'],
    saving: ['저장하는 중…', 'Saving…', '保存中…'],
    toastEdited: ['고쳤어요.', 'Saved.', '直しました。'],
    toastPlantedDemo: ['심었어요. 미리보기라서 새로고침하면 사라져요.', "Planted. This is a preview, so it's gone on reload.", '植えました。プレビューなので、再読み込みすると消えます。'],
    toastPlanted: ['들판에 심었어요. 다음 사람이 이 자리에서 찾을 수 있어요.', 'Planted. The next person can find it right here.', '野原に植えました。次の人がこの場所で見つけられます。'],
    writeEyebrowEdit: ['내 세잎 고치기', 'Edit your clover', '自分の三つ葉を直す'],
    writeEyebrowNew: ['빈 세잎에 적기', 'Writing on an empty clover', '空っぽの三つ葉に書く'],
    writeTitleEdit: ['행복을 고쳐 적어요', 'Rewrite your happiness', '幸せを書き直す'],
    writeTitleNew: ['오늘의 세잎 한 장', "Today's three leaves", '今日の三つ葉'],

    // deleting
    deleting: ['지우는 중…', 'Deleting…', '削除中…'],
    toastDeleted: ['지웠어요.', 'Deleted.', '削除しました。'],
    delTitle: ['이 세잎을 지울까요?', 'Delete this clover?', 'この三つ葉を削除しますか?'],
    delBody: ['지우면 들판에서 사라지고 되돌릴 수 없어요.', 'It will leave the meadow for good.', '削除すると野原から消え、元に戻せません。'],
    keep: ['그대로 두기', 'Keep it', 'そのままにする'],

    // reporting (the reason is stored in Korean for the admin)
    reasons: [
      ['불쾌하거나 혐오스러운 내용', '광고나 스팸', '다른 사람의 개인정보', '기타'],
      ['Offensive or hateful', 'Advertising or spam', "Someone else's personal information", 'Something else'],
      ['不快・差別的な内容', '広告・スパム', '他人の個人情報', 'その他'],
    ],
    toastReported: ['신고했어요. 고맙습니다.', 'Reported. Thank you.', '通報しました。ありがとうございます。'],
    alreadyReported: ['이미 신고한 기록이에요.', 'You already reported this one.', 'この記録はすでに通報済みです。'],
    reportBtn: ['신고하기', 'Report', '通報する'],
    reportTitle: ['이 기록을 신고할까요?', 'Report this clover?', 'この記録を通報しますか?'],
    reportBody: ['신고가 3번 쌓이면 관리자가 확인할 때까지 들판에서 숨겨져요. 누가 신고했는지는 글쓴이에게 보이지 않아요.', 'After three reports it is hidden until the admin checks it. The writer never sees who reported.', '通報が3件たまると、管理者が確認するまで野原から隠されます。誰が通報したかは書いた人には見えません。'],
    reason: ['이유', 'Reason', '理由'],

    // my clovers
    mineTitle: ['내 기록', 'My clovers', 'わたしの記録'],
    mineEmpty: ['아직 심은 세잎이 없어요. 들판에서 빈 세잎을 찾아보세요.', "You haven't planted any yet. Look for an empty clover in the meadow.", 'まだ植えた三つ葉はありません。野原で空っぽの三つ葉を探してみてください。'],
    countAll: ['모두 {n}개', '{n} in all', '全部で{n}件'],
    badgeHiddenShort: ['신고가 쌓여 숨겨짐', 'Hidden after reports', '通報により非表示'],

    // help
    steps: [
      [['헤집기', ['한 손가락으로 네잎을 헤치면', '아래 숨은 세잎이 드러나요.'], ['마우스를 들판 위에서 움직이면', '네잎이 헤쳐지고 아래 숨은 세잎이 드러나요.']],
       ['둘러보기', ['들판은 화면보다 훨씬 넓어요.', '두 손가락으로 끌어서 옮겨 다니세요.'], ['들판은 화면보다 훨씬 넓어요.', '끌거나 스크롤해서 옮겨 다니세요.']],
       ['읽기', ['누군가 적은 세잎 위엔 흰 꽃이 피어 있어요.', '꽃을 누르면 로그인 없이 바로 읽을 수 있어요.', '옆 목록의 문장을 눌러도 그 세잎으로 데려가 줘요.']],
       ['심기', ['꽃이 없는 곳 아래에는 빈 세잎이 숨어 있어요.', '헤집어서 찾으면 내 행복을 적을 수 있고,', '그 자리에 꽃이 피어 다음 사람을 기다려요.', '내가 심은 곳의 꽃은 금색이에요.']]],
      [['Dig', ['Brush the four-leaf clovers aside with one finger', 'and the hidden three-leaf ones appear.'], ['Move the mouse over the meadow', 'and the four-leaf clovers part to show what hides beneath.']],
       ['Look around', ['The meadow is much bigger than the screen.', 'Drag with two fingers to move around.'], ['The meadow is much bigger than the screen.', 'Drag or scroll to move around.']],
       ['Read', ['A white flower blooms over every clover someone wrote on.', 'Tap the flower to read it, no account needed.', 'Tap a line in the list and it takes you there.']],
       ['Plant', ['Empty clovers hide beneath the spots without a flower.', 'Dig one up and you can write your happiness;', 'a flower blooms there and waits for the next person.', 'Flowers over your own clovers are gold.']]],
      [['かき分ける', ['指一本で四つ葉をかき分けると、', '下に隠れた三つ葉が現れます。'], ['野原の上でマウスを動かすと、', '四つ葉がかき分けられ、下に隠れた三つ葉が現れます。']],
       ['見て回る', ['野原は画面よりずっと広いです。', '指二本でドラッグして移動してください。'], ['野原は画面よりずっと広いです。', 'ドラッグかスクロールで移動してください。']],
       ['読む', ['誰かが書いた三つ葉の上には、白い花が咲いています。', '花を押せば、ログインなしですぐに読めます。', '一覧の文章を押しても、その三つ葉へ連れて行ってくれます。']],
       ['植える', ['花のないところの下には、空っぽの三つ葉が隠れています。', '見つけたら、あなたの幸せを書けます。', 'その場所に花が咲き、次の人を待ちます。', 'あなたが植えたところの花は金色です。']]],
    ],
    mapNote: [['오른쪽 위 작은 지도는 들판 전체예요.', '누르면 그곳으로 옮겨 가요.'], ['The small map at the top right shows the whole meadow.', 'Tap it to go there.'], ['右上の小さな地図は野原全体です。', '押すとその場所へ移動します。']],
    decorate: ['들판 꾸미기 (시간 · 계절 · 날씨)', 'The meadow (time · season · weather)', '野原の様子(時間・季節・天気)'],
    time: ['시간', 'Time', '時間'],
    season: ['계절', 'Season', '季節'],
    weather: ['날씨', 'Weather', '天気'],
    tAuto: ['시계 따라', 'By the clock', '時計どおり'], tDawn: ['새벽', 'Dawn', '明け方'], tDay: ['낮', 'Day', '昼'], tDusk: ['해 질 녘', 'Dusk', '夕暮れ'], tNight: ['밤', 'Night', '夜'],
    sAuto: ['달력 따라', 'By the calendar', 'カレンダーどおり'], sSpring: ['봄', 'Spring', '春'], sSummer: ['여름', 'Summer', '夏'], sAutumn: ['가을', 'Autumn', '秋'], sWinter: ['겨울', 'Winter', '冬'],
    wAuto: ['실제 날씨', 'Real weather', '実際の天気'], wClear: ['맑음', 'Clear', '晴れ'], wCloud: ['흐림', 'Cloudy', 'くもり'], wRain: ['비', 'Rain', '雨'], wSnow: ['눈', 'Snow', '雪'], wFog: ['안개', 'Fog', '霧'],
    geoLabel: ['실제 날씨를 내 위치로 보기', 'Use my location for the weather', '天気を現在地で見る'],
    geoNote: [
      '끄면 내 시간대의 도시({place}) 날씨예요. 켜면 브라우저가 위치를 물어보고, 대략적인 위치(약 10km 단위)만 날씨 서비스(Open-Meteo)에 보내요. 저장하지 않아요.',
      "Off: the weather in your time zone's city ({place}). On: your browser asks for your location, and only a rough position (about 10km) goes to the weather service (Open-Meteo). Nothing is stored.",
      'オフのときは、タイムゾーンの都市({place})の天気です。オンにするとブラウザが位置情報をたずね、おおよその位置(約10km単位)だけを天気サービス(Open-Meteo)に送ります。保存はしません。',
    ],
    privacy: ['개인정보처리방침', 'Privacy', 'プライバシーポリシー'],
    privacyHref: ['privacy.html', 'privacy-en.html', 'privacy-ja.html'],
    toField: ['들판으로', 'Back to the meadow', '野原へ'],
    language: ['언어', 'Language', '言語'],

    // on this day
    yearsAgo: ['{n}년 전 오늘', 'On this day, {n} year ago', '{n}年前の今日'],
    yearsAgoPl: ['{n}년 전 오늘', 'On this day, {n} years ago', '{n}年前の今日'],
    annivNote: ['그날 심어 둔 세잎이 아직 들판에 있어요.', 'The clover you planted that day is still in the meadow.', 'あの日に植えた三つ葉は、今も野原にあります。'],

    // photos
    photoOnly: ['사진 파일만 올릴 수 있어요.', 'Only photos can be added.', '写真ファイルのみ追加できます。'],
    photoBad: ['이 사진은 열 수 없어요. JPG나 PNG로 다시 골라 주세요.', "This photo can't be opened. Please choose a JPG or PNG.", 'この写真は開けません。JPG か PNG を選び直してください。'],
    photoBig: ['사진을 충분히 줄이지 못했어요. 다른 사진을 골라 주세요.', "Couldn't make this photo small enough. Please choose another.", '写真を十分に小さくできませんでした。別の写真を選んでください。'],
  };

  function pick() {
    try { const v = localStorage.getItem(KEY); if (LANGS.includes(v)) return v; } catch (_) { /* 기억 못 해도 괜찮아요 */ }
    for (const l of navigator.languages || [navigator.language || 'en']) {
      const k = String(l).slice(0, 2).toLowerCase();
      if (LANGS.includes(k)) return k;
    }
    return 'en';
  }
  const lang = pick();
  const i = LANGS.indexOf(lang);
  document.documentElement.lang = lang;

  function t(key, vars) {
    const row = T[key];
    let v = row ? row[i] : key;
    if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? vars[k] : '');
    return v;
  }
  // dates as each language writes them: 2026.10.19 · Oct 19, 2026 · 2026年10月19日
  const fmt = new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: lang === 'ja' ? 'long' : 'short', day: 'numeric' });
  function date(v) {
    if (!v) return '';
    const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
    if (isNaN(d)) return '';
    if (lang === 'ko') return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    return fmt.format(d);
  }

  // fill the page's fixed text: data-i18n (text), data-i18n-lines (one item per line), data-i18n-attr="attr:key;attr:key"
  function fill(root) {
    root = root || document;
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of root.querySelectorAll('[data-i18n-lines]')) {
      const lines = t(el.dataset.i18nLines);
      // the space keeps words apart when a phone hides the line breaks; Japanese runs sentences together without one
      const gap = lang === 'ja' ? '' : ' ';
      el.replaceChildren(...lines.flatMap((l, n) => n ? [gap, document.createElement('br'), l] : [l]));
    }
    for (const el of root.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr, t(key));
      }
    }
  }

  window.I18N = {
    lang, langs: LANGS, t, date, fill,
    names: { ko: '한국어', en: 'English', ja: '日本語' },
    set(l) {
      try { localStorage.setItem(KEY, l); } catch (_) { /* 이번 방문에만 */ }
      location.reload();
    },
  };
})();
