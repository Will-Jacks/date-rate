-- ============================================================
-- Date Rate — schema inicial
-- Casal (2 pessoas) · dates com fotos · notas 1–10 ocultas até
-- os dois avaliarem · lista "Queremos ir"
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Utilitário: updated_at
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------
-- couples
-- ------------------------------------------------------------
create table public.couples (
  id          uuid primary key default gen_random_uuid(),
  name        text check (char_length(name) <= 60),
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  couple_id    uuid references public.couples(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_profiles_couple on public.profiles (couple_id);

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o profile automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
                  split_part(new.email, '@', 1)), 40)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Casal do usuário logado (security definer evita recursão nas policies)
create or replace function public.my_couple_id()
returns uuid language sql stable security definer set search_path = public as $$
  select couple_id from public.profiles where id = auth.uid()
$$;

-- ------------------------------------------------------------
-- dates
-- ------------------------------------------------------------
create table public.dates (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  created_by    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  place_name    text not null check (char_length(place_name) between 1 and 120),
  place_address text check (char_length(place_address) <= 300),
  date_on       date not null default current_date,
  category      text not null default 'outro' check (category in (
                  'jantar','almoco','cafe','bar','cinema','passeio',
                  'viagem','em_casa','show','outro')),
  cost          numeric(10,2) check (cost >= 0),
  cover_path    text,
  favorite      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_dates_couple_date on public.dates (couple_id, date_on desc, created_at desc);

create trigger trg_dates_updated
  before update on public.dates
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- date_photos (fotos extras; a capa fica em dates.cover_path)
-- ------------------------------------------------------------
create table public.date_photos (
  id         uuid primary key default gen_random_uuid(),
  date_id    uuid not null references public.dates(id) on delete cascade,
  path       text not null unique,
  position   smallint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_date_photos_date on public.date_photos (date_id, position);

-- ------------------------------------------------------------
-- ratings (uma por pessoa por date)
-- ------------------------------------------------------------
create table public.ratings (
  id         uuid primary key default gen_random_uuid(),
  date_id    uuid not null references public.dates(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  score      smallint not null check (score between 1 and 10),
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date_id, user_id)
);

create trigger trg_ratings_updated
  before update on public.ratings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- wishlist ("Queremos ir")
-- ------------------------------------------------------------
create table public.wishlist (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  added_by     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  place_name   text not null check (char_length(place_name) between 1 and 120),
  notes        text check (char_length(notes) <= 300),
  done_date_id uuid references public.dates(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_wishlist_couple on public.wishlist (couple_id, created_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table public.couples     enable row level security;
alter table public.profiles    enable row level security;
alter table public.dates       enable row level security;
alter table public.date_photos enable row level security;
alter table public.ratings     enable row level security;
alter table public.wishlist    enable row level security;

-- couples: só o próprio casal. Criar/entrar é feito pelas RPCs abaixo.
create policy couples_select on public.couples
  for select to authenticated using (id = public.my_couple_id());

-- profiles: vejo o meu e o do meu par; só altero o meu nome
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or couple_id = public.my_couple_id());
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;

-- dates: tudo do próprio casal
create policy dates_select on public.dates
  for select to authenticated using (couple_id = public.my_couple_id());
create policy dates_insert on public.dates
  for insert to authenticated
  with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy dates_update on public.dates
  for update to authenticated
  using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());
create policy dates_delete on public.dates
  for delete to authenticated using (couple_id = public.my_couple_id());

-- date_photos: via o date
create policy date_photos_all on public.date_photos
  for all to authenticated
  using (exists (select 1 from public.dates d
                 where d.id = date_id and d.couple_id = public.my_couple_id()))
  with check (exists (select 1 from public.dates d
                      where d.id = date_id and d.couple_id = public.my_couple_id()));

-- ratings: vejo a minha; a do par só depois de eu ter avaliado
create or replace function public.has_rated(p_date_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ratings
                 where date_id = p_date_id and user_id = auth.uid())
$$;

create policy ratings_select on public.ratings
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.has_rated(date_id)
        and exists (select 1 from public.dates d
                    where d.id = date_id and d.couple_id = public.my_couple_id()))
  );
create policy ratings_insert on public.ratings
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.dates d
                where d.id = date_id and d.couple_id = public.my_couple_id())
  );
create policy ratings_update on public.ratings
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ratings_delete on public.ratings
  for delete to authenticated using (user_id = auth.uid());

-- wishlist: tudo do próprio casal
create policy wishlist_select on public.wishlist
  for select to authenticated using (couple_id = public.my_couple_id());
create policy wishlist_insert on public.wishlist
  for insert to authenticated
  with check (couple_id = public.my_couple_id() and added_by = auth.uid());
create policy wishlist_update on public.wishlist
  for update to authenticated
  using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());
create policy wishlist_delete on public.wishlist
  for delete to authenticated using (couple_id = public.my_couple_id());

-- ============================================================
-- RPCs
-- ============================================================

-- Cria um casal e coloca o usuário nele. Devolve o código de convite.
create or replace function public.create_couple(p_name text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  -- sem 0/O/1/I/L para evitar confusão ao digitar
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id   uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.my_couple_id() is not null then raise exception 'already_in_couple'; end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * char_length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;

  insert into public.couples (name, invite_code)
  values (nullif(trim(p_name), ''), v_code)
  returning id into v_id;

  update public.profiles set couple_id = v_id where id = auth.uid();
  return v_code;
end $$;

-- Entra num casal existente pelo código (máximo 2 pessoas)
create or replace function public.join_couple(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.my_couple_id() is not null then raise exception 'already_in_couple'; end if;

  select id into v_id from public.couples where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'invalid_code'; end if;

  if (select count(*) from public.profiles where couple_id = v_id) >= 2 then
    raise exception 'couple_full';
  end if;

  update public.profiles set couple_id = v_id where id = auth.uid();
  return v_id;
end $$;

-- Lista os dates do casal com o estado das avaliações.
-- A nota/comentário do par só vem se o usuário já avaliou;
-- a média só vem quando os dois avaliaram.
create or replace function public.get_dates(p_date_id uuid default null)
returns table (
  id              uuid,
  created_by      uuid,
  place_name      text,
  place_address   text,
  date_on         date,
  category        text,
  cost            numeric,
  cover_path      text,
  favorite        boolean,
  created_at      timestamptz,
  my_score        smallint,
  my_comment      text,
  partner_rated   boolean,
  partner_score   smallint,
  partner_comment text,
  couple_avg      numeric
)
language sql stable security definer set search_path = public as $$
  select
    d.id, d.created_by, d.place_name, d.place_address, d.date_on, d.category,
    d.cost, d.cover_path, d.favorite, d.created_at,
    mine.score,
    mine.comment,
    partner.id is not null,
    case when mine.id is not null then partner.score end,
    case when mine.id is not null then partner.comment end,
    case when mine.id is not null and partner.id is not null
         then round((mine.score + partner.score) / 2.0, 1) end
  from public.dates d
  left join public.ratings mine
         on mine.date_id = d.id and mine.user_id = auth.uid()
  left join public.ratings partner
         on partner.date_id = d.id and partner.user_id <> auth.uid()
  where d.couple_id = public.my_couple_id()
    and (p_date_id is null or d.id = p_date_id)
  order by d.date_on desc, d.created_at desc
$$;

revoke execute on function public.create_couple(text) from anon, public;
revoke execute on function public.join_couple(text)   from anon, public;
revoke execute on function public.get_dates(uuid)     from anon, public;
grant  execute on function public.create_couple(text) to authenticated;
grant  execute on function public.join_couple(text)   to authenticated;
grant  execute on function public.get_dates(uuid)     to authenticated;

-- ============================================================
-- Storage: bucket privado, pastas por casal
-- caminho: {couple_id}/{date_id}/{uuid}.jpg
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('date-photos', 'date-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy date_photos_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'date-photos'
         and (storage.foldername(name))[1] = public.my_couple_id()::text);
create policy date_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'date-photos'
              and (storage.foldername(name))[1] = public.my_couple_id()::text);
create policy date_photos_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'date-photos'
         and (storage.foldername(name))[1] = public.my_couple_id()::text);
