import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./db-harness";

const A = "11111111-1111-4111-8111-111111111111"; // Will
const B = "22222222-2222-4222-8222-222222222222"; // Bia
const C = "33333333-3333-4333-8333-333333333333"; // outra pessoa

let h: Awaited<ReturnType<typeof createDb>>;
let code = "";
let coupleId = "";
let dateId = "";

beforeAll(async () => {
  h = await createDb();
  await h.addUser(A, "will@x.com", "Will");
  await h.addUser(B, "bia@x.com");
  await h.addUser(C, "eve@x.com");
  code = (await h.as<{ c: string }>(A, `select public.create_couple('Nós') c`)).rows[0].c;
  await h.as(B, `select public.join_couple($1)`, [code.toLowerCase()]);
  coupleId = (await h.as<{ c: string }>(A, `select public.my_couple_id() c`)).rows[0].c;
  dateId = (
    await h.as<{ id: string }>(
      A,
      `insert into dates (couple_id, place_name, category, cost, tags, quote)
       values ($1, 'Mangai', 'jantar', 120, '{aniversario}', 'Que noite!') returning id`,
      [coupleId],
    )
  ).rows[0].id;
}, 60_000);

describe("casal", () => {
  it("gera código de 6 letras sem caracteres ambíguos", () => {
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("não deixa entrar uma terceira pessoa", async () => {
    const r = await h.as(C, `select public.join_couple($1)`, [code]);
    expect(r.error).toContain("couple_full");
  });

  it("perfil criado automaticamente, com nome do cadastro ou do e-mail", async () => {
    const r = await h.as<{ display_name: string }>(A, `select display_name from profiles order by 1`);
    expect(r.rows.map((x) => x.display_name)).toEqual(["Will", "bia"]);
  });

  it("ninguém muda o próprio couple_id direto", async () => {
    const r = await h.as(A, `update profiles set couple_id = null where id = auth.uid()`);
    expect(r.error).toContain("permission denied");
  });
});

describe("isolamento entre casais", () => {
  it("outra pessoa não vê nem cria dates no casal", async () => {
    expect((await h.as(C, `select count(*)::int n from dates`)).rows[0]).toEqual({ n: 0 });
    const r = await h.as(C, `insert into dates (couple_id, place_name) values ($1, 'x')`, [coupleId]);
    expect(r.error).toContain("row-level security");
  });

  it("outra pessoa não comenta, não reage e não marca date no casal", async () => {
    expect((await h.as(C, `insert into date_comments (date_id, body) values ($1, 'oi')`, [dateId])).error).toBeTruthy();
    expect(
      (await h.as(C, `insert into reactions (date_id, target_kind, target_ref, emoji) values ($1,'rating',$2,'😂')`, [dateId, A]))
        .error,
    ).toBeTruthy();
    expect(
      (await h.as(C, `insert into plans (couple_id, place_name, scheduled_at) values ($1,'x',now())`, [coupleId])).error,
    ).toBeTruthy();
  });

  it("fotos do storage ficam na pasta do casal", async () => {
    const ok = await h.as(A, `insert into storage.objects (bucket_id, name) values ('date-photos', $1)`, [`${coupleId}/${dateId}/a.jpg`]);
    expect(ok.error).toBeNull();
    const bad = await h.as(C, `insert into storage.objects (bucket_id, name) values ('date-photos', $1)`, [`${coupleId}/x/b.jpg`]);
    expect(bad.error).toContain("row-level security");
  });

  it("anônimo não chama get_dates", async () => {
    expect((await h.as(null, `select * from get_dates()`)).error).toContain("permission denied");
  });
});

describe("notas ocultas", () => {
  it("nota fora de 1–10 é recusada", async () => {
    const r = await h.as(B, `insert into ratings (date_id, score) values ($1, 11)`, [dateId]);
    expect(r.error).toContain("check constraint");
  });

  it("a nota (e os critérios) do par só aparecem depois que você avalia", async () => {
    await h.as(A, `insert into ratings (date_id, score, comment, food, vibe) values ($1, 9, 'top', 10, 8)`, [dateId]);

    const before = await h.as(B, `select my_score, partner_rated, partner_score, partner_criteria, couple_avg from get_dates()`);
    expect(before.rows[0]).toEqual({ my_score: null, partner_rated: true, partner_score: null, partner_criteria: null, couple_avg: null });
    expect((await h.as(B, `select * from ratings`)).rows).toHaveLength(0);

    await h.as(B, `insert into ratings (date_id, score, comment, food) values ($1, 8, 'bom', 7)`, [dateId]);
    const after = await h.as(B, `select my_score, partner_score, partner_comment, partner_criteria, my_criteria, couple_avg from get_dates($1)`, [dateId]);
    expect(after.rows[0]).toMatchObject({
      my_score: 8,
      partner_score: 9,
      partner_comment: "top",
      partner_criteria: { food: 10, vibe: 8 },
      my_criteria: { food: 7 },
    });
    expect(Number((after.rows[0] as { couple_avg: string }).couple_avg)).toBe(8.5);
  });

  it("ninguém edita a nota do outro", async () => {
    const r = await h.as<{ id: string }>(B, `update ratings set score = 1 where user_id <> auth.uid() returning id`);
    expect(r.rows).toHaveLength(0);
  });

  it("dar nota 'toca' o date (para o tempo real avisar o par)", async () => {
    const before = (await h.as<{ u: string }>(A, `select updated_at::text u from dates where id = $1`, [dateId])).rows[0].u;
    await new Promise((r) => setTimeout(r, 15));
    await h.as(A, `update ratings set score = 10 where date_id = $1 and user_id = auth.uid()`, [dateId]);
    const after = (await h.as<{ u: string }>(A, `select updated_at::text u from dates where id = $1`, [dateId])).rows[0].u;
    expect(after > before).toBe(true);
  });
});

describe("novidades", () => {
  it("posição da capa: padrão no centro, o par pode ajustar e fica entre 0 e 100", async () => {
    const before = await h.as(A, `select cover_x, cover_y from get_dates($1)`, [dateId]);
    expect(before.rows[0]).toEqual({ cover_x: 50, cover_y: 50 });
    expect((await h.as(B, `update dates set cover_x = 30, cover_y = 0 where id = $1`, [dateId])).error).toBeNull();
    const after = await h.as(A, `select cover_x, cover_y from get_dates($1)`, [dateId]);
    expect(after.rows[0]).toEqual({ cover_x: 30, cover_y: 0 });
    expect((await h.as(A, `update dates set cover_x = 101 where id = $1`, [dateId])).error).toContain("dates_cover_focus_range");
  });

  it("critérios podem ser editados depois, sem mudar a nota", async () => {
    const id = (
      await h.as<{ id: string }>(A, `insert into dates (couple_id, place_name) values ($1, 'Crit') returning id`, [coupleId])
    ).rows[0].id;
    const up = `insert into ratings (date_id, user_id, score, comment, food, vibe) values ($1, auth.uid(), 8, 'bom', $2, $3)
                on conflict (date_id, user_id) do update set score = excluded.score, comment = excluded.comment,
                food = excluded.food, vibe = excluded.vibe`;
    expect((await h.as(A, up, [id, null, null])).error).toBeNull();
    expect((await h.as(A, up, [id, 9, 6])).error).toBeNull();
    const r = await h.as(A, `select my_score, my_comment, my_criteria from get_dates($1)`, [id]);
    expect(r.rows[0]).toEqual({ my_score: 8, my_comment: "bom", my_criteria: { food: 9, vibe: 6 } });
  });

  it("get_dates traz frase, etiquetas e contagem de comentários", async () => {
    await h.as(B, `insert into date_comments (date_id, body) values ($1, 'como assim 10??')`, [dateId]);
    const r = await h.as(A, `select quote, tags, comments_count from get_dates($1)`, [dateId]);
    expect(r.rows[0]).toEqual({ quote: "Que noite!", tags: ["aniversario"], comments_count: 1 });
  });

  it("reação duplicada é recusada; cada um apaga só as suas", async () => {
    const ins = `insert into reactions (date_id, target_kind, target_ref, emoji) values ($1, 'rating', $2, '😂')`;
    expect((await h.as(A, ins, [dateId, B])).error).toBeNull();
    expect((await h.as(A, ins, [dateId, B])).error).toContain("duplicate");
    const del = await h.as<{ id: string }>(B, `delete from reactions returning id`);
    expect(del.rows).toHaveLength(0);
  });

  it("os dois editam o orçamento, mas não o código de convite", async () => {
    expect((await h.as(B, `update couples set monthly_budget = 300`)).error).toBeNull();
    expect((await h.as(B, `update couples set invite_code = 'AAAAAA'`)).error).toContain("permission denied");
  });

  it("dates marcados ficam visíveis para os dois", async () => {
    await h.as(A, `insert into plans (couple_id, place_name, scheduled_at) values ($1, 'Pipa', now() + interval '2 days')`, [coupleId]);
    expect((await h.as(B, `select place_name from plans`)).rows).toEqual([{ place_name: "Pipa" }]);
  });

  it("inscrição de push: cada um só vê os próprios aparelhos", async () => {
    await h.as(A, `select public.save_push_subscription('https://push/1', 'p', 'a')`);
    expect((await h.as(B, `select * from push_subscriptions`)).rows).toHaveLength(0);
    // mesmo aparelho usado por outra conta: a inscrição muda de dono
    await h.as(B, `select public.save_push_subscription('https://push/1', 'p2', 'a2')`);
    expect((await h.as(A, `select * from push_subscriptions`)).rows).toHaveLength(0);
    expect((await h.as(B, `select endpoint from push_subscriptions`)).rows).toHaveLength(1);
  });

  it("publica as tabelas no Realtime", async () => {
    const r = await h.db.query<{ t: string }>(`select tablename t from pg_publication_tables where pubname = 'supabase_realtime' order by 1`);
    expect(r.rows.map((x) => x.t)).toEqual(["couples", "date_comments", "dates", "plans", "profiles", "reactions", "wishlist"]);
  });
});

describe("sair do casal", () => {
  it("quem sai deixa de ver; quem fica não vê mais a nota antiga como 'do par'", async () => {
    await h.as(B, `select public.leave_couple()`);
    expect((await h.as(B, `select count(*)::int n from dates`)).rows[0]).toEqual({ n: 0 });
    const r = await h.as(A, `select partner_rated, couple_avg from get_dates($1)`, [dateId]);
    expect(r.rows[0]).toEqual({ partner_rated: false, couple_avg: null });
    // e pode voltar com o mesmo código
    expect((await h.as(B, `select public.join_couple($1)`, [code])).error).toBeNull();
  });
});
