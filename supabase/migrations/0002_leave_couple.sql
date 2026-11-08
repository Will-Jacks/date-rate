-- ============================================================
-- Sair do casal
-- O usuário volta a ficar sem casal e pode entrar em outro com
-- um novo código. Os dates, fotos e notas continuam no casal
-- antigo, que pode ser retomado com o mesmo código de convite.
-- ============================================================

create or replace function public.leave_couple()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.my_couple_id() is null then raise exception 'not_in_couple'; end if;
  update public.profiles set couple_id = null where id = auth.uid();
end $$;

revoke execute on function public.leave_couple() from anon, public;
grant  execute on function public.leave_couple() to authenticated;

-- get_dates: a nota "do par" passa a considerar só quem é membro
-- atual do casal (ignora notas antigas de quem saiu).
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
         on partner.date_id = d.id
        and partner.user_id <> auth.uid()
        and partner.user_id in (select p.id from public.profiles p
                                where p.couple_id = d.couple_id)
  where d.couple_id = public.my_couple_id()
    and (p_date_id is null or d.id = p_date_id)
  order by d.date_on desc, d.created_at desc
$$;
