-- ============================================================
-- Notificações push
-- Cada aparelho que ativa as notificações vira uma linha aqui.
-- O envio é feito pelo servidor do app (rota /api/notify), que usa
-- a chave secreta do Supabase para ler a inscrição do par.
-- ============================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- cada um só mexe nas inscrições dos próprios aparelhos
drop policy if exists push_select on public.push_subscriptions;
drop policy if exists push_insert on public.push_subscriptions;
drop policy if exists push_update on public.push_subscriptions;
drop policy if exists push_delete on public.push_subscriptions;
create policy push_select on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy push_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy push_update on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Se o mesmo aparelho for usado por outra conta, a inscrição passa a ser dela.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh,
        auth = excluded.auth, user_agent = excluded.user_agent, created_at = now();
end $$;

revoke execute on function public.save_push_subscription(text, text, text, text) from anon, public;
grant  execute on function public.save_push_subscription(text, text, text, text) to authenticated;
