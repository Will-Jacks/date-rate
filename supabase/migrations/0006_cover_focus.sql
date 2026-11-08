-- ============================================================
-- Date Rate — 0006: posição da foto de capa
-- Ponto de foco da capa (0–100 em cada eixo, como o object-position
-- do CSS). 50/50 = centro, que era o comportamento até aqui.
-- Pode ser rodado de novo sem problema.
-- ============================================================

alter table public.dates add column if not exists cover_x smallint not null default 50;
alter table public.dates add column if not exists cover_y smallint not null default 50;

do $$
begin
  alter table public.dates add constraint dates_cover_focus_range
    check (cover_x between 0 and 100 and cover_y between 0 and 100);
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- get_dates v4: igual à v3, mais cover_x / cover_y
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
  cover_x          smallint,
  cover_y          smallint,
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
    d.cost, d.cover_path, d.cover_x, d.cover_y, d.favorite, d.created_at,
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

-- PostgREST passa a enxergar as colunas novas na hora
notify pgrst, 'reload schema';
