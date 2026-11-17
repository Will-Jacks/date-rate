-- ============================================================
-- Date Rate — 0007: foto do casal (perfil)
-- Arquivo no bucket date-photos em {couple_id}/perfil/{uuid}.jpg
-- (as políticas do Storage já liberam a pasta do casal).
-- Pode ser rodado de novo sem problema.
-- ============================================================

alter table public.couples add column if not exists photo_path text;

-- o casal pode trocar a própria foto (além de nome e orçamento)
revoke update on public.couples from authenticated, anon;
grant update (name, monthly_budget, photo_path) on public.couples to authenticated;

notify pgrst, 'reload schema';
