-- 세잎 들판: Supabase SQL Editor에 통째로 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 괜찮습니다 (이미 있는 것은 건너뛰거나 다시 만듭니다).

-- ============================================================
-- 1. 행복 기록 테이블
-- ============================================================
create table if not exists public.happies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  happy_on     date not null default current_date,                            -- 행복했던 날
  place        text check (char_length(place) <= 40),                         -- 장소
  line         text not null check (char_length(btrim(line)) between 1 and 80), -- 한 줄 (필수)
  more         text check (char_length(more) <= 2000),                        -- 조금 더 적기 (선택)
  photo_path   text,                                                          -- Storage 안의 사진 경로 (선택)
  fx           real not null check (fx between 0 and 1),                      -- 들판 가로 위치 (0~1)
  fy           real not null check (fy between 0 and 1),                      -- 들판 세로 위치 (0~1)
  created_at   timestamptz not null default now(),                           -- 작성 시각
  updated_at   timestamptz,                                                   -- 마지막 수정 시각
  report_count int not null default 0,                                        -- 받은 신고 수
  hidden       boolean not null default false                                 -- 신고가 쌓여 숨겨졌는지
);

create index if not exists happies_visible_idx on public.happies (created_at) where not hidden;
create index if not exists happies_user_idx on public.happies (user_id);

alter table public.happies enable row level security;

-- 손님(anon)과 로그인한 사람(authenticated)이 만질 수 있는 칸을 좁힙니다.
-- 숨김 여부, 신고 수, 작성자, 위치는 글쓴이도 직접 바꿀 수 없어요.
revoke all on public.happies from anon, authenticated;
-- 누가 썼는지(user_id)는 아무에게도 보내지 않아요. 내 글인지는 아래 my_happy_ids()로만 알려 줘요.
grant select (id, happy_on, place, line, more, photo_path, fx, fy, created_at, updated_at, report_count, hidden)
  on public.happies to anon, authenticated;
grant insert (happy_on, place, line, more, photo_path, fx, fy) on public.happies to authenticated;
grant update (happy_on, place, line, more, photo_path) on public.happies to authenticated;
grant delete on public.happies to authenticated;

drop policy if exists "읽기: 누구나 (숨겨진 글은 글쓴이만)" on public.happies;
create policy "읽기: 누구나 (숨겨진 글은 글쓴이만)" on public.happies
  for select to anon, authenticated
  using (not hidden or user_id = (select auth.uid()));

drop policy if exists "쓰기: 로그인한 사람이 자기 이름으로만" on public.happies;
create policy "쓰기: 로그인한 사람이 자기 이름으로만" on public.happies
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (photo_path is null or photo_path like (select auth.uid())::text || '/%')
  );

drop policy if exists "수정: 자기 글만" on public.happies;
create policy "수정: 자기 글만" on public.happies
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (photo_path is null or photo_path like (select auth.uid())::text || '/%')
  );

drop policy if exists "삭제: 자기 글만" on public.happies;
create policy "삭제: 자기 글만" on public.happies
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 내용을 고치면 수정 시각을 자동으로 남깁니다.
create or replace function public.happies_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.happy_on, new.place, new.line, new.more, new.photo_path)
     is distinct from (old.happy_on, old.place, old.line, old.more, old.photo_path) then
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists happies_touch on public.happies;
create trigger happies_touch before update on public.happies
  for each row execute function public.happies_touch();

-- ============================================================
-- 2. 신고 테이블: 한 사람이 한 기록에 한 번만, 3번 쌓이면 숨김
-- ============================================================
create table if not exists public.reports (
  id         bigint generated always as identity primary key,
  happy_id   uuid not null references public.happies (id) on delete cascade,
  reporter   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason     text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (happy_id, reporter)
);

alter table public.reports enable row level security;

-- 신고 내용은 아무도 API로 읽을 수 없어요. 관리자는 Supabase 대시보드에서 봅니다.
revoke all on public.reports from anon, authenticated;
grant insert (happy_id, reason) on public.reports to authenticated;

drop policy if exists "신고: 로그인한 사람이 자기 이름으로만" on public.reports;
create policy "신고: 로그인한 사람이 자기 이름으로만" on public.reports
  for insert to authenticated
  with check (reporter = (select auth.uid()));

-- 신고가 들어오면 수를 세고, 3번 이상이면 숨깁니다. (숫자를 바꾸려면 아래 3을 고치세요)
create or replace function public.reports_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  select count(*) into n from public.reports where happy_id = new.happy_id;
  update public.happies
     set report_count = n,
         hidden = hidden or n >= 3
   where id = new.happy_id;
  return new;
end $$;

-- 트리거 함수는 바깥(API)에서 직접 부를 수 없게 막아 둡니다.
revoke execute on function public.reports_count() from public, anon, authenticated;
revoke execute on function public.happies_touch() from public, anon, authenticated;

drop trigger if exists reports_count on public.reports;
create trigger reports_count after insert on public.reports
  for each row execute function public.reports_count();

-- ============================================================
-- 3. 사진 저장소 (Storage)
--    공개 버킷: 사진 주소를 아는 사람은 누구나 볼 수 있어요 (기록 읽기가 누구나이므로).
--    올리기: 로그인한 사람이 자기 폴더(사용자 id)에만. 지우기: 자기 사진만.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('happy-photos', 'happy-photos', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "happy-photos 올리기: 로그인한 사람이 자기 폴더에" on storage.objects;
create policy "happy-photos 올리기: 로그인한 사람이 자기 폴더에" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'happy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 지우기 전에 Storage가 파일을 찾을 수 있도록, 자기 사진 목록만 볼 수 있게 합니다.
drop policy if exists "happy-photos 목록: 자기 사진만" on storage.objects;
create policy "happy-photos 목록: 자기 사진만" on storage.objects
  for select to authenticated
  using (bucket_id = 'happy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "happy-photos 지우기: 자기 사진만" on storage.objects;
create policy "happy-photos 지우기: 자기 사진만" on storage.objects
  for delete to authenticated
  using (bucket_id = 'happy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================
-- 4. 내 글 알아보기 (작성자를 공개하지 않고)
-- ============================================================
create or replace function public.my_happy_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.happies where user_id = (select auth.uid())
$$;

create or replace function public.my_happies()
returns table (id uuid, happy_on date, place text, line text, more text, photo_path text, fx real, fy real,
               created_at timestamptz, updated_at timestamptz, hidden boolean)
language sql stable security definer set search_path = '' as $$
  select id, happy_on, place, line, more, photo_path, fx, fy, created_at, updated_at, hidden
    from public.happies where user_id = (select auth.uid()) order by created_at desc
$$;

revoke execute on function public.my_happy_ids() from public, anon;
revoke execute on function public.my_happies() from public, anon;
grant execute on function public.my_happy_ids() to authenticated;
grant execute on function public.my_happies() to authenticated;

-- ============================================================
-- 5. 하루 제한: 한 사람이 하루에 세잎 20개, 신고 30개까지
-- ============================================================
create or replace function public.happies_daily_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.happies where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'daily_limit';
  end if;
  return new;
end $$;

create or replace function public.reports_daily_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports where reporter = new.reporter and created_at > now() - interval '1 day') >= 30 then
    raise exception 'daily_limit';
  end if;
  return new;
end $$;

revoke execute on function public.happies_daily_limit() from public, anon, authenticated;
revoke execute on function public.reports_daily_limit() from public, anon, authenticated;

drop trigger if exists happies_daily_limit on public.happies;
create trigger happies_daily_limit before insert on public.happies
  for each row execute function public.happies_daily_limit();
drop trigger if exists reports_daily_limit on public.reports;
create trigger reports_daily_limit before insert on public.reports
  for each row execute function public.reports_daily_limit();
