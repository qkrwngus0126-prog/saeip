# saeip 설정 안내

처음 한 번만 하면 됩니다. 순서대로 따라 하세요. 30분쯤 걸려요.

> 이 안내의 사이트 주소는 `https://saeip.com/` 기준입니다. (이 저장소 `saeip`를 GitHub Pages로 올리고, 가비아에서 산 saeip.com을 연결했어요)

> **현재 상태 (2026-10-19)**: 1, 2, 5단계는 이미 끝났어요. Supabase 프로젝트 `clover-happiness`
> (주소 `https://kddwszxlmdlkgskxmwgg.supabase.co`, 서울)를 만들고, SQL을 실행하고, 공개용 키를 `config.js`에 넣어 두었어요.
> 남은 일은 **3단계, 4단계, 6단계**입니다. 아래 안내의 `abcdefgh.supabase.co`는 `kddwszxlmdlkgskxmwgg.supabase.co`로 읽으세요.

```
1. Supabase 프로젝트 만들기
2. SQL 한 번에 실행하기 (테이블, RLS, 사진 저장소)
3. 로그인 후 돌아올 주소 등록하기
4. Google Cloud에서 로그인 키 만들기 → Supabase에 붙여넣기
5. 공개용 키를 config.js에 넣기
6. GitHub Pages에 올리기
7. 확인하기
```

---

## 1. Supabase 프로젝트 만들기

1. <https://supabase.com> 접속 → 오른쪽 위 **Start your project**
2. **Continue with GitHub**로 로그인
3. **New project** 클릭
   - Organization: 기본으로 만들어진 것 선택 (없으면 이름 아무거나 입력해 새로 만들기, Plan은 **Free**)
   - Project name: `clover-happiness` (아무 이름이나 괜찮아요)
   - Database Password: **Generate a password** 누르고 메모장에 저장해 두기 (이 사이트 코드에는 안 써요)
   - Region: **Northeast Asia (Seoul)**
4. **Create new project** → 1~2분 기다리기

## 2. SQL 한 번에 실행하기

테이블 만들기, RLS(행 단위 보안) 켜기, 사진 저장소(Storage) 만들기가 이 한 번으로 끝납니다.

1. 왼쪽 메뉴에서 **SQL Editor** (`>_` 모양 아이콘)
2. 위쪽 **+ New query** (또는 빈 편집 창)
3. 이 폴더의 [`supabase-setup.sql`](supabase-setup.sql) 파일 내용을 **전부 복사해서 붙여넣기**
4. 오른쪽 아래 **Run** (또는 Ctrl/Cmd + Enter)
5. 아래에 `Success. No rows returned`가 나오면 성공
   - "destructive operation" 경고 창이 뜨면 **Run this query** 눌러도 괜찮아요 (예전 규칙을 지우고 다시 만드는 줄 때문이에요)

확인해 보기:
- 왼쪽 **Table Editor** → `happies`, `reports` 두 테이블이 있고, 빨간 **RLS disabled** 경고가 **보이지 않으면** 정상
- 왼쪽 **Storage** → `happy-photos` 버킷이 있고 **Public** 표시가 있으면 정상

이 SQL이 정한 규칙:

| 대상 | 읽기 | 쓰기 | 수정·삭제 |
|---|---|---|---|
| 행복 기록 `happies` | 누구나 (로그인 없이). 신고로 숨겨진 글은 글쓴이만 | 로그인한 사람, 자기 이름으로만 | 자기 글만 |
| 신고 `reports` | 아무도 (관리자는 대시보드에서) | 로그인한 사람, 자기 이름으로만, 한 기록에 한 번 | 불가 |
| 사진 `happy-photos` | 누구나 (사진 주소로) | 로그인한 사람, 자기 폴더에만, 2MB 이하 | 자기 사진만 삭제 |

글쓴이도 숨김 여부, 신고 수, 클로버 위치는 직접 바꿀 수 없게 막아 두었어요.
기록에는 구글 이름이나 이메일이 저장되지 않아요. 들판에서는 모두 "누군가의 행복"으로 보입니다.

## 3. 로그인 후 돌아올 주소(redirect URL) 등록하기

1. 왼쪽 **Authentication** → **URL Configuration**
2. **Site URL**에 입력 → **Save**
   ```
   https://saeip.com/
   ```
3. 아래 **Redirect URLs** → **Add URL** → 같은 주소를 넣고 **Save URLs**
   ```
   https://saeip.com/
   ```
   - 내 컴퓨터에서 로그인까지 시험해 보고 싶다면 `http://localhost:5500/**` 도 하나 더 추가하세요 (VS Code Live Server 기본 주소)

여기 없는 주소로는 로그인 후 돌아오지 못해요. 사이트 주소가 바뀌면 여기부터 고치면 됩니다.

## 4. 구글 로그인 켜기

### 4-1. Supabase에서 돌아올 주소(Callback URL) 복사

1. 왼쪽 **Authentication** → **Sign In / Providers**
2. 목록에서 **Google** 클릭 → 펼쳐진 창 아래쪽 **Callback URL (for OAuth)** 의 주소를 복사
   (모양: `https://abcdefgh.supabase.co/auth/v1/callback`)
3. 이 창은 열어 둔 채로, 새 탭에서 Google Cloud로 갑니다

### 4-2. Google Cloud에서 할 일

1. <https://console.cloud.google.com> 접속, 구글 계정으로 로그인 (처음이면 약관 동의)
2. 맨 위 프로젝트 선택 상자 → **새 프로젝트** → 이름 `clover-happiness` → **만들기** → 알림에서 **프로젝트 선택**
3. 왼쪽 위 ☰ 메뉴 → **API 및 서비스** → **OAuth 동의 화면**
   (화면 이름이 **Google 인증 플랫폼 / Google Auth Platform**으로 보일 수 있어요) → **시작하기**
   - 앱 정보: 앱 이름 `saeip`, 사용자 지원 이메일은 내 이메일 → **다음**
   - 대상: **외부** → **다음**
   - 연락처 정보: 내 이메일 → **다음**
   - 정책 동의 체크 → **계속** → **만들기**
4. 왼쪽 **브랜딩** → 아래 **승인된 도메인** → **+ 도메인 추가**
   → 4-1에서 복사한 주소의 가운데 부분만 넣기: `abcdefgh.supabase.co` → **저장**
5. 왼쪽 **클라이언트** → **+ 클라이언트 만들기**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 이름: `clover-happiness web`
   - **승인된 자바스크립트 원본** → **+ URI 추가** → `https://saeip.com`
     (뒤에 `/`나 폴더 이름을 붙이지 않아요)
   - **승인된 리디렉션 URI** → **+ URI 추가** → 4-1에서 복사한 `https://abcdefgh.supabase.co/auth/v1/callback`
   - **만들기**
6. 뜨는 창에서 **클라이언트 ID**와 **클라이언트 보안 비밀번호(Client secret)** 를 복사
   (보안 비밀번호는 나중에 다시 못 볼 수 있으니 바로 다음 단계에 붙여넣으세요. 이 값은 Supabase에만 넣고, 코드에는 절대 넣지 않아요)
7. 왼쪽 **대상** → 게시 상태 **테스트** 아래 **앱 게시** → **확인**
   - 이걸 안 하면 "테스트 사용자"로 등록한 사람만 로그인할 수 있어요
   - 이름·이메일 같은 기본 정보만 쓰기 때문에 구글 심사는 필요 없어요

### 4-3. Supabase에 붙여넣기

1. 4-1에서 열어 둔 Supabase의 Google 창으로 돌아가기
2. **Enable Sign in with Google** 켜기
3. **Client IDs**에 클라이언트 ID, **Client Secret (for OAuth)** 에 보안 비밀번호 붙여넣기
4. **Save**

> 나중에 카카오 로그인을 더하고 싶다면: Supabase **Sign In / Providers → Kakao**를 같은 방식으로 켠 뒤,
> `config.js`의 `// { id: 'kakao', ... }` 줄 맨 앞 `//`만 지우면 로그인 창에 카카오 버튼이 생깁니다.

## 5. 공개용 키를 config.js에 넣기

1. Supabase 왼쪽 아래 **Project Settings** (톱니바퀴) → **API Keys**
2. **Publishable key** (`sb_publishable_`로 시작) 옆 복사 버튼
   - 이 탭이 없거나 예전 프로젝트라면 **Legacy API Keys** 탭의 **anon public** 키를 써도 돼요
   - ⚠️ **secret** 키(`sb_secret_`로 시작)나 **service_role** 키는 절대 복사하지 마세요. 이 키는 모든 규칙을 무시할 수 있어요.
     실수로 넣으면 사이트가 스스로 멈추고 경고를 띄웁니다.
3. 프로젝트 주소 찾기: Supabase 맨 위 **Connect** 버튼, 또는 **Project Settings → Data API**의 **Project URL** (`https://abcdefgh.supabase.co`)
4. `happiness/config.js`를 열어 두 줄을 채우기
   ```js
   supabaseUrl: 'https://abcdefgh.supabase.co',
   supabaseKey: 'sb_publishable_xxxxxxxxxxxx',
   ```
   GitHub 웹에서 고치려면: 저장소에서 `happiness/config.js` 열기 → 오른쪽 위 연필(✏️) → 고치기 → **Commit changes**

공개용 키는 브라우저에 그대로 보이는 게 정상이에요. 무엇을 할 수 있는지는 2단계의 RLS 규칙이 정합니다.

## 6. GitHub Pages와 saeip.com 연결하기

이 저장소(`saeip`)의 `main` 브랜치 맨 위 파일이 그대로 사이트가 됩니다. `CNAME` 파일에 `saeip.com`이 적혀 있어요.

1. **가비아 DNS** (My가비아 → 도메인 → saeip.com → **DNS 정보 → 도메인 연결/DNS 설정**)
   | 타입 | 호스트 | 값 |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | qkrwngus0126-prog.github.io. |
2. 저장소 **Settings → Pages**
   - Source: **Deploy from a branch**, Branch: **main**, 폴더 **/ (root)** → **Save**
   - Custom domain: `saeip.com` → **Save** → DNS 확인이 끝나면 **Enforce HTTPS** 체크
3. 예전 주소(`qkrwngus0126-prog.github.io/clover-portfolio/happiness/`)는 saeip.com으로 넘겨 주는 안내 페이지로 남아 있어요.

## 7. 확인하기

1. 사이트 접속 → 들판을 헤집어 보기, **하나 보여 주기** 눌러 보기
2. 빈 세잎을 찾아 누르기 → **여기에 행복 적기** → 로그인 창 → **Google로 계속하기**
3. 구글 로그인 후 사이트로 돌아와 적기 창이 바로 열리면 성공
4. 한 줄 쓰고 **들판에 심기** → 새로고침해도 같은 자리에 남아 있는지 확인
5. Supabase **Table Editor → happies**에 한 줄이 생겼는지 확인

잘 안 될 때:
- 로그인 후 `localhost`나 다른 주소로 가 버림 → 3단계 Site URL / Redirect URLs 확인
- 구글 화면에 `redirect_uri_mismatch` → 4-2의 5번 리디렉션 URI가 Supabase Callback URL과 글자 하나까지 같은지 확인
- "액세스 차단됨: 앱이 테스트 중" → 4-2의 7번 **앱 게시**
- 사이트 아래에 "미리보기예요"가 계속 보임 → 5단계 config.js 두 줄 확인 (따옴표 안에 넣었는지)

---

## 관리자: 신고 확인하기

신고가 **3번** 쌓이면 그 기록은 자동으로 들판에서 숨겨지고, 글쓴이 본인에게만 "신고가 쌓여 숨겨짐"으로 보여요.
관리자는 Supabase 대시보드에서 확인합니다. (대시보드는 RLS와 상관없이 모든 기록을 볼 수 있어요)

**눈으로 보기**: **Table Editor → happies** → 위쪽 **Filter** → `hidden` `equals` `true` (신고가 1개라도 있는 것은 `report_count` `greater than` `0`)

**SQL로 보기**: **SQL Editor**에 붙여넣고 Run

```sql
-- 신고가 들어온 기록과 신고 이유 (숨겨진 것 먼저)
select h.id, h.hidden, h.report_count, h.line, h.place, h.more, h.photo_path, h.created_at,
       (select string_agg(r.reason, ', ') from public.reports r where r.happy_id = h.id) as reasons
from public.happies h
where h.report_count > 0
order by h.hidden desc, h.report_count desc, h.created_at desc;
```

확인 후 처리 (`'기록-id'` 자리에 위 결과의 id를 붙여넣기):

```sql
-- 괜찮은 기록이었다면: 신고를 지우고 다시 보이게
delete from public.reports where happy_id = '기록-id';
update public.happies set hidden = false, report_count = 0 where id = '기록-id';

-- 지워야 할 기록이라면: 기록 삭제 (신고도 함께 지워져요)
delete from public.happies where id = '기록-id';

-- 신고가 없어도 관리자가 직접 숨기고 싶다면
update public.happies set hidden = true where id = '기록-id';
```

기록을 SQL로 지우면 사진 파일은 남아요. **Storage → happy-photos**에서 위 결과의 `photo_path`(예: `사용자id/파일.jpg`) 폴더로 들어가 그 파일을 지우세요.

숨김 기준(3번)을 바꾸고 싶다면 `supabase-setup.sql`에서 `n >= 3`의 숫자를 고쳐 그 부분(`create or replace function public.reports_count` 블록)만 다시 Run 하면 됩니다.

---

## 언어 (한국어 · English · 日本語)

- 처음 오면 브라우저 언어를 따라요. 한국어·일본어가 아니면 영어로 보여요.
- 오른쪽 위 지구본 버튼, 첫 화면 카드 아래, "?" 도움말 창에서 언어를 바꿀 수 있어요. 고른 언어는 그 기기에 기억돼요.
- 모든 문장은 `js/i18n.js` 한 파일에 있어요. 표현을 고치려면 그 줄의 한국어·영어·일본어 중 하나만 바꾸면 돼요.
- 개인정보처리방침은 `privacy.html`(한국어), `privacy-en.html`, `privacy-ja.html` 세 개예요. 내용을 바꿀 땐 셋 다 고쳐 주세요.
- 신고 이유는 어느 언어로 신고해도 한국어로 저장돼요(관리자가 한 가지 말로 볼 수 있게).

## 날씨와 계절의 기준 위치

- 위치를 묻지 않고, 방문자 기기의 시간대 도시(예: 서울, 도쿄, 뉴욕)의 날씨를 Open-Meteo에서 가져와요.
- 남반구(예: 시드니)에서는 계절이 반대로 보여요.
- 도움말에서 "실제 날씨를 내 위치로 보기"를 켠 사람만 실제 위치(약 10km 단위)를 써요.

## 운영: 잠들지 않게, 백업은 직접

- **일시 정지 막기**: Supabase 무료 프로젝트는 일주일 동안 요청이 없으면 일시 정지돼요. 저장소의 GitHub Actions(`happiness keep-alive`)가 사흘에 한 번 기록 하나를 읽어서 깨워 둬요. 저장소 **Actions** 탭에서 초록 체크가 보이면 잘 돌고 있는 거예요. 그래도 멈췄다면 Supabase 대시보드에서 **Restore project**를 누르면 돌아와요.
- **백업**: 무료 플랜은 자동 백업을 내려받을 수 없어요. 한 달에 한 번쯤 아래처럼 받아 두세요.
  1. Supabase → **Table Editor** → `happies` → 오른쪽 위 **Export** → **Export table as CSV**
  2. `reports`도 같은 방법으로
  3. 사진은 **Storage** → `happy-photos`에서 폴더째 내려받기
- **하루 제한**: 한 사람이 하루에 세잎 20개, 신고 30개까지만 할 수 있어요. 숫자는 `supabase-setup.sql`의 5번 블록에서 바꾸고 그 블록만 다시 Run 하면 돼요.
- **작성자 비공개**: 기록을 읽을 때 작성자 ID는 아무에게도 보내지 않아요. 관리자는 대시보드에서 볼 수 있어요.
