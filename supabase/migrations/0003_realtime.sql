-- ============================================================
-- Tempo real
-- O app escuta mudanças em dates, wishlist e profiles.
-- A nota do par não é visível antes de você avaliar (RLS), então
-- o Realtime não entregaria esse evento. Por isso, toda mudança em
-- ratings "toca" o date (updated_at), que os dois enxergam.
-- ============================================================

create or replace function public.touch_date_from_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.dates set updated_at = now()
  where id = coalesce(new.date_id, old.date_id);
  return null;
end $$;

drop trigger if exists trg_ratings_touch_date on public.ratings;
create trigger trg_ratings_touch_date
  after insert or update or delete on public.ratings
  for each row execute function public.touch_date_from_rating();

-- Fotos extras também atualizam o date
drop trigger if exists trg_photos_touch_date on public.date_photos;
create or replace function public.touch_date_from_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.dates set updated_at = now()
  where id = coalesce(new.date_id, old.date_id);
  return null;
end $$;
create trigger trg_photos_touch_date
  after insert or update or delete on public.date_photos
  for each row execute function public.touch_date_from_photo();

-- Publica as tabelas no canal do Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.dates;    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.wishlist; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  end if;
end $$;
