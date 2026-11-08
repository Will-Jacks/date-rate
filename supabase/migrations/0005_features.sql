-- ============================================================
-- Novas funcionalidades
-- frase do date · etiquetas · mapa · notas por critério ·
-- comentários e reações · dates marcados · orçamento do mês
-- ============================================================

-- ------------------------------------------------------------
-- dates: frase, etiquetas e coordenadas
-- ------------------------------------------------------------
alter table public.dates add column if not exists quote text;
alter table public.dates add column if not exists tags  text[] not null default '{}';
alter table public.dates add column if not exists lat   double precision;
alter table public.dates add column if not exists lng   double precision;

do $$ begin
  alter table public.dates add constraint dates_quote_len check (char_length(quote) <= 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.dates add constraint dates_tags_max check (cardinality(tags) <= 12);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.dates add constraint dates_coords check (
    (lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180));
exception when duplicate_object then null; end $$;

create index if not exists idx_dates_tags on public.dates using gin (tags);

-- ------------------------------------------------------------
-- ratings: critérios opcionais (1–10)
-- ------------------------------------------------------------
alter table public.ratings add column if not exists food     smallint;
alter table public.ratings add column if not exists ambience smallint;
alter table public.ratings add column if not exists price    smallint;
alter table public.ratings add column if not exists vibe     smallint;

do $$ begin
  alter table public.ratings add constraint ratings_criteria_range check (
    coalesce(food, 1) between 1 and 10 and coalesce(ambience, 1) between 1 and 10 and
    coalesce(price, 1) between 1 and 10 and coalesce(vibe, 1) between 1 and 10);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- couples: orçamento mensal (editável pelos dois)
-- ------------------------------------------------------------
alter table public.couples add column if not exists monthly_budget numeric(10,2);
do $$ begin
  alter table public.couples add constraint couples_budget_positive check (monthly_budget is null or monthly_budget >= 0);
exception when duplicate_object then null; end $$;

drop policy if exists couples_update on public.couples;
create policy couples_update on public.couples
  for update to authenticated
  using (id = public.my_couple_id()) with check (id = public.my_couple_id());
revoke update on public.couples from authenticated, anon;
grant update (name, monthly_budget) on public.couples to authenticated;

-- ------------------------------------------------------------
-- wishlist: endereço e coordenadas (vindos da busca de lugares)
-- ------------------------------------------------------------
alter table public.wishlist add column if not exists place_address text;
alter table public.wishlist add column if not exists lat double precision;
alter table public.wishlist add column if not exists lng double precision;

-- ------------------------------------------------------------
-- comentários de cada date
-- ------------------------------------------------------------
create table if not exists public.date_comments (
  id         uuid primary key default gen_random_uuid(),
  date_id    uuid not null references public.dates(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_date on public.date_comments (date_id, created_at);

alter table public.date_comments enable row level security;
drop policy if exists comments_select on public.date_comments;
drop policy if exists comments_insert on public.date_comments;
drop policy if exists comments_delete on public.date_comments;
create policy comments_select on public.date_comments
  for select to authenticated
  using (exists (select 1 from public.dates d where d.id = date_id and d.couple_id = public.my_couple_id()));
create policy comments_insert on public.date_comments
  for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.dates d where d.id = date_id and d.couple_id = public.my_couple_id()));
create policy comments_delete on public.date_comments
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- reações com emoji (no comentário de nota do par ou num comentário)
-- target_kind = 'rating'  → target_ref = id do autor da nota
-- target_kind = 'comment' → target_ref = id do comentário
-- ------------------------------------------------------------
create table if not exists public.reactions (
  id          uuid primary key default gen_random_uuid(),
  date_id     uuid not null references public.dates(id) on delete cascade,
  target_kind text not null check (target_kind in ('rating', 'comment')),
  target_ref  uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  unique (date_id, target_kind, target_ref, user_id, emoji)
);
create index if not exists idx_reactions_date on public.reactions (date_id);

alter table public.reactions enable row level security;
drop policy if exists reactions_select on public.reactions;
drop policy if exists reactions_insert on public.reactions;
drop policy if exists reactions_delete on public.reactions;
create policy reactions_select on public.reactions
  for select to authenticated
  using (exists (select 1 from public.dates d where d.id = date_id and d.couple_id = public.my_couple_id()));
create policy reactions_insert on public.reactions
  for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.dates d where d.id = date_id and d.couple_id = public.my_couple_id()));
create policy reactions_delete on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- dates marcados (planos)
-- ------------------------------------------------------------
create table if not exists public.plans (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid not null references public.couples(id) on delete cascade,
  created_by       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  place_name       text not null check (char_length(place_name) between 1 and 120),
  place_address    text check (char_length(place_address) <= 300),
  lat              double precision,
  lng              double precision,
  scheduled_at     timestamptz not null,
  notes            text check (char_length(notes) <= 300),
  wish_id          uuid references public.wishlist(id) on delete set null,
  done_date_id     uuid references public.dates(id) on delete set null,
  today_sent_at    timestamptz,
  followup_sent_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_plans_couple on public.plans (couple_id, scheduled_at);

alter table public.plans enable row level security;
drop policy if exists plans_select on public.plans;
drop policy if exists plans_insert on public.plans;
drop policy if exists plans_update on public.plans;
drop policy if exists plans_delete on public.plans;
create policy plans_select on public.plans
  for select to authenticated using (couple_id = public.my_couple_id());
create policy plans_insert on public.plans
  for insert to authenticated
  with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy plans_update on public.plans
  for update to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy plans_delete on public.plans
  for delete to authenticated using (couple_id = public.my_couple_id());

-- ------------------------------------------------------------
-- get_dates v3: inclui frase, etiquetas, coordenadas, critérios e
-- contagem de comentários. Critérios do par seguem a mesma regra da
-- nota: só aparecem depois que você avaliou.
-- ------------------------------------------------------------
drop function if exists public.get_dates(uuid);
create function public.get_dates(p_date_id uuid default null)
returns table (
  id               uuid,
  created_by       uuid,
  place_name       text,
  place_address    text,
  date_on          date,
  category         text,
  cost             numeric,
  cover_path       text,
  favorite         boolean,
  created_at       timestamptz,
  quote            text,
  tags             text[],
  lat              double precision,
  lng              double precision,
  my_score         smallint,
  my_comment       text,
  my_criteria      jsonb,
  partner_rated    boolean,
  partner_score    smallint,
  partner_comment  text,
  partner_criteria jsonb,
  couple_avg       numeric,
  comments_count   integer
)
language sql stable security definer set search_path = public as $$
  select
    d.id, d.created_by, d.place_name, d.place_address, d.date_on, d.category,
    d.cost, d.cover_path, d.favorite, d.created_at,
    d.quote, d.tags, d.lat, d.lng,
    mine.score,
    mine.comment,
    case when mine.id is not null then
      jsonb_strip_nulls(jsonb_build_object('food', mine.food, 'ambience', mine.ambience,
                                           'price', mine.price, 'vibe', mine.vibe)) end,
    partner.id is not null,
    case when mine.id is not null then partner.score end,
    case when mine.id is not null then partner.comment end,
    case when mine.id is not null and partner.id is not null then
      jsonb_strip_nulls(jsonb_build_object('food', partner.food, 'ambience', partner.ambience,
                                           'price', partner.price, 'vibe', partner.vibe)) end,
    case when mine.id is not null and partner.id is not null
         then round((mine.score + partner.score) / 2.0, 1) end,
    (select count(*)::int from public.date_comments c where c.date_id = d.id)
  from public.dates d
  left join public.ratings mine
         on mine.date_id = d.id and mine.user_id = auth.uid()
  left join public.ratings partner
         on partner.date_id = d.id
        and partner.user_id <> auth.uid()
        and partner.user_id in (select p.id from public.profiles p where p.couple_id = d.couple_id)
  where d.couple_id = public.my_couple_id()
    and (p_date_id is null or d.id = p_date_id)
  order by d.date_on desc, d.created_at desc
$$;

revoke execute on function public.get_dates(uuid) from anon, public;
grant  execute on function public.get_dates(uuid) to authenticated;

-- ------------------------------------------------------------
-- Tempo real para as tabelas novas
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.date_comments; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.reactions;     exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.plans;         exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.couples;       exception when duplicate_object then null; end;
  end if;
end $$;
