-- fl.own 꽃다발 저장소: Supabase SQL Editor에 통째로 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 괜찮습니다.
--
-- 테이블은 바깥에서 직접 읽거나 쓸 수 없게 닫아 두고,
-- 사이트는 아래 두 함수로만 저장(save_bouquet)하고 꺼내 봐요(get_bouquet).
-- 그래서 링크(id)를 아는 사람만 그 꽃다발을 볼 수 있고, 남의 꽃다발 목록은 아무도 못 봐요.

create table if not exists public.bouquets (
  id         uuid primary key default gen_random_uuid(),
  items      jsonb not null,                                       -- [{"t":"rose","c":"#f07a93"}, ...]
  wrap       text  not null check (wrap ~ '^#[0-9a-f]{6}$'),       -- 포장지 색
  ribbon     text  not null check (ribbon ~ '^#[0-9a-f]{6}$'),     -- 리본 색
  seed       int   not null default 0,                             -- 꽃을 꽂는 배치
  to_name    text  check (char_length(to_name) <= 20),             -- 받는 사람
  message    text  check (char_length(message) <= 200),           -- 카드 한마디
  from_name  text  check (char_length(from_name) <= 20),           -- 보내는 사람
  created_at timestamptz not null default now(),
  constraint bouquets_items_ok check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30)
);

alter table public.bouquets enable row level security;
revoke all on public.bouquets from anon, authenticated;
-- 정책(policy)을 하나도 만들지 않아서 테이블 직접 접근은 모두 막혀요.

-- 저장: 꽃 이름과 색 모양을 확인하고 새 id를 돌려줘요
create or replace function public.save_bouquet(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if jsonb_typeof(p->'items') <> 'array' then
    raise exception 'items must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p->'items') e
    where not (
      e->>'t' = any (array['rose','tulip','daisy','sunflower','hydrangea','lily','lavender','gypsophila','eucalyptus'])
      and coalesce(e->>'c', '') ~ '^#[0-9a-f]{6}$'
    )
  ) then
    raise exception 'unknown flower or color';
  end if;

  insert into bouquets (items, wrap, ribbon, seed, to_name, message, from_name)
  values (
    p->'items',
    p->>'wrap',
    p->>'ribbon',
    coalesce((p->>'seed')::int, 0),
    nullif(btrim(p->>'to_name'), ''),
    nullif(btrim(p->>'message'), ''),
    nullif(btrim(p->>'from_name'), '')
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- 꺼내 보기: 링크의 id로 한 다발만
create or replace function public.get_bouquet(bid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', id, 'items', items, 'wrap', wrap, 'ribbon', ribbon, 'seed', seed,
    'to_name', to_name, 'message', message, 'from_name', from_name, 'created_at', created_at
  )
  from bouquets where id = bid;
$$;

revoke all on function public.save_bouquet(jsonb) from public;
revoke all on function public.get_bouquet(uuid) from public;
grant execute on function public.save_bouquet(jsonb) to anon, authenticated;
grant execute on function public.get_bouquet(uuid) to anon, authenticated;
