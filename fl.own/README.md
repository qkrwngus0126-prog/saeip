# fl.own

꽃을 한 송이씩 골라 담고, 포장지와 리본을 고르고, 카드에 한마디를 적어 만드는 3D 꽃다발.

- 꽃 9가지(장미, 튤립, 데이지, 해바라기, 수국, 백합, 라벤더, 안개꽃, 유칼립투스)는 모두 `js/flowers.js`에서 코드로 빚어요. 이미지나 3D 모델 파일이 없어요.
- 정적 사이트(GitHub Pages) + Supabase(꽃다발 저장과 공유 링크).

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `index.html`, `style.css` | 화면 |
| `js/flowers.js` | 3D 꽃, 포장지, 리본, 꽃다발 배치 (three.js r147) |
| `js/app.js` | 꽃 고르기, 작업대, 저장, 공유 링크(`?b=<id>`) |
| `config.js` | Supabase 주소와 공개용 키 |
| `supabase-setup.sql` | 꽃다발 테이블과 저장/불러오기 함수 |

## 꽃 하나 더 넣기

`js/flowers.js`의 `FLOWERS`에 한 줄을 더하고 그 꽃을 만드는 함수를 쓰면 돼요. 꽃은 `petal()`로 꽃잎을 만들고 `place()`로 둘레에 붙이는 식이에요.
새 꽃 이름은 `supabase-setup.sql`의 `save_bouquet` 안 꽃 목록에도 넣고 SQL을 다시 실행하세요.

## 설정

1. Supabase에서 새 프로젝트를 만들어요 (Region: Northeast Asia (Seoul), Plan: Free).
2. **SQL Editor**에 `supabase-setup.sql`을 통째로 붙여 넣고 **Run**.
3. **Project Settings → API Keys**에서 Project URL과 **Publishable key**(`sb_publishable_...`)를 `config.js`에 넣어요.
   `secret` / `service_role` 키는 절대 넣지 마세요.
4. GitHub 저장소 **Settings → Pages**에서 Source를 `main` 브랜치의 `/ (root)`로.

`config.js`를 비워 두면 꽃다발을 브라우저에만 저장하는 미리보기 모드로 열려요.
