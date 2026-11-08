/**
 * Postgres de verdade em memória (PGlite) com um "mini Supabase":
 * schema auth (auth.uid() lê o usuário da sessão), papéis anon/authenticated,
 * storage e a publicação do Realtime. Roda todas as migrations em ordem.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";

const STUB = `
create role anon; create role authenticated;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public, storage to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on functions to authenticated, anon;
create publication supabase_realtime;
`;

export async function createDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(STUB);
  const dir = path.join(import.meta.dirname, "..", "supabase", "migrations");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }

  async function addUser(id: string, email: string, name?: string) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
      id,
      email,
      JSON.stringify(name ? { display_name: name } : {}),
    ]);
  }

  /** Executa SQL como um usuário logado (RLS ativa). Erros voltam como { error }. */
  async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
    await db.exec(uid ? "set role authenticated" : "set role anon");
    try {
      return { rows: (await db.query<T>(sql, params)).rows, error: null as string | null };
    } catch (e) {
      return { rows: [] as T[], error: (e as Error).message };
    } finally {
      await db.exec("reset role");
    }
  }

  return { db, addUser, as };
}
