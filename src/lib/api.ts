/**
 * Acesso ao Supabase. Toda falha sai como AppError (mensagem amigável);
 * os componentes nunca chamam o Supabase diretamente, só via hooks.ts.
 */
import { AppError, toAppError } from "./errors";
import { uuid } from "./format";
import { compressImage } from "./images";
import { BUCKET, supabase } from "./supabase";
import type { Comment, Couple, Criteria, DateInput, DateItem, DatePhoto, Me, Plan, Profile, Reaction, WishItem } from "./types";

type Res = { data?: unknown; error: unknown };

/** Executa uma chamada do Supabase e converte falhas em AppError. */
async function run<R extends Res>(fn: () => PromiseLike<R>): Promise<NonNullable<R["data"]>> {
  let res: R;
  try {
    res = await fn();
  } catch (e) {
    throw toAppError(e);
  }
  if (res.error) throw toAppError(res.error);
  return res.data as NonNullable<R["data"]>;
}

function normalizeDate(row: DateItem): DateItem {
  return {
    ...row,
    cost: row.cost == null ? null : Number(row.cost),
    couple_avg: row.couple_avg == null ? null : Number(row.couple_avg),
    // colunas novas: valores padrão caso a migration 0005 ainda não tenha rodado
    quote: row.quote ?? null,
    tags: row.tags ?? [],
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    my_criteria: row.my_criteria ?? null,
    partner_criteria: row.partner_criteria ?? null,
    comments_count: row.comments_count ?? 0,
    cover_x: row.cover_x ?? 50,
    cover_y: row.cover_y ?? 50,
  };
}

/**
 * Grava em `dates`. Se a migração 0006 (posição da capa) ainda não rodou no
 * banco, tenta de novo sem cover_x/cover_y em vez de falhar o salvamento.
 */
async function writeDate<T extends { cover_x?: number; cover_y?: number }>(
  row: T,
  fn: (r: Omit<T, "cover_x" | "cover_y">) => PromiseLike<Res>,
) {
  try {
    await run(() => fn(row));
  } catch (e) {
    const cause = e instanceof AppError ? (e.cause as { message?: string } | undefined) : undefined;
    if (!/cover_[xy]/.test(String(cause?.message ?? ""))) throw e;
    const rest: Partial<T> = { ...row };
    delete rest.cover_x;
    delete rest.cover_y;
    await run(() => fn(rest as Omit<T, "cover_x" | "cover_y">));
  }
}

/* ---------------------------------------------------------------- auth */

export async function signIn(email: string, password: string) {
  await run(() => supabase().auth.signInWithPassword({ email, password }));
}

/** Devolve true se já entrou direto; false se o Supabase pediu confirmação por e-mail. */
export async function signUp(name: string, email: string, password: string): Promise<boolean> {
  const data = await run(() =>
    supabase().auth.signUp({ email, password, options: { data: { display_name: name } } }),
  );
  return !!data.session;
}

/** Manda o e-mail com o link para criar uma senha nova. */
export async function requestPasswordReset(email: string) {
  await run(() =>
    supabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` }),
  );
}

export async function updatePassword(password: string) {
  await run(() => supabase().auth.updateUser({ password }));
}

export async function signOut() {
  await run(() => supabase().auth.signOut());
}

/* ------------------------------------------------------------ perfil */

export async function fetchMe(userId: string, email: string): Promise<Me> {
  const profiles: Profile[] = await run(() =>
    supabase().from("profiles").select("id, couple_id, display_name"),
  );
  const profile = profiles.find((p) => p.id === userId);
  if (!profile) {
    throw new AppError(
      "NOT_FOUND",
      "Seu perfil não foi encontrado. Confira se a migration do banco foi aplicada.",
    );
  }
  const partner =
    profiles.find((p) => p.id !== userId && p.couple_id && p.couple_id === profile.couple_id) ??
    null;

  let couple: Couple | null = null;
  if (profile.couple_id) {
    couple = await run(() =>
      supabase()
        .from("couples")
        .select("*")
        .eq("id", profile.couple_id!)
        .single(),
    );
  }
  if (couple) couple = { ...couple, monthly_budget: couple.monthly_budget == null ? null : Number(couple.monthly_budget) };
  return { userId, email, profile, partner, couple };
}

export async function setBudget(coupleId: string, value: number | null) {
  await run(() => supabase().from("couples").update({ monthly_budget: value }).eq("id", coupleId));
}

export async function updateDisplayName(userId: string, name: string) {
  await run(() => supabase().from("profiles").update({ display_name: name }).eq("id", userId));
}

export async function createCouple(name: string | null): Promise<string> {
  return run(() => supabase().rpc("create_couple", { p_name: name }));
}

export async function leaveCouple() {
  await run(() => supabase().rpc("leave_couple"));
}

export async function joinCouple(code: string) {
  await run(() => supabase().rpc("join_couple", { p_code: code }));
}

/* ------------------------------------------------------------- fotos */

async function uploadPhoto(coupleId: string, dateId: string, file: File): Promise<string> {
  const blob = await compressImage(file);
  const path = `${coupleId}/${dateId}/${uuid()}.jpg`;
  try {
    const { error } = await supabase()
      .storage.from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
  } catch (e) {
    throw new AppError(
      "UPLOAD",
      "Não foi possível enviar a foto. Verifique sua conexão e tente novamente.",
      e,
    );
  }
  return path;
}

/** Envia várias fotos com no máximo 3 simultâneas. Se uma falhar, apaga as já enviadas. */
async function uploadAll(
  coupleId: string,
  dateId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const paths: string[] = new Array(files.length);
  let next = 0;
  let done = 0;
  onProgress?.(0, files.length);
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      paths[i] = await uploadPhoto(coupleId, dateId, files[i]);
      onProgress?.(++done, files.length);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  } catch (e) {
    await removePhotos(paths.filter(Boolean));
    throw e;
  }
  return paths;
}

export async function removePhotos(paths: string[]) {
  if (!paths.length) return;
  try {
    await supabase().storage.from(BUCKET).remove(paths);
  } catch {
    /* melhor esforço: arquivo órfão não quebra nada */
  }
}

export async function signUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const data = await run(() => supabase().storage.from(BUCKET).createSignedUrls(paths, 3600));
  const out: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}

/* ------------------------------------------------------------- dates */

export async function listDates(): Promise<DateItem[]> {
  const rows: DateItem[] = await run(() => supabase().rpc("get_dates"));
  return rows.map(normalizeDate);
}

export async function getDate(id: string): Promise<DateItem> {
  const rows: DateItem[] = await run(() => supabase().rpc("get_dates", { p_date_id: id }));
  if (!rows[0]) throw new AppError("NOT_FOUND", "Esse date não existe mais.");
  return normalizeDate(rows[0]);
}

export async function getPhotos(dateId: string): Promise<DatePhoto[]> {
  return run(() =>
    supabase()
      .from("date_photos")
      .select("id, date_id, path, position")
      .eq("date_id", dateId)
      .order("position"),
  );
}

export type SaveProgress = (done: number, total: number) => void;

export async function createDate(args: {
  coupleId: string;
  input: DateInput;
  cover: File;
  extras: File[];
  wishId?: string | null;
  planId?: string | null;
  onProgress?: SaveProgress;
}): Promise<string> {
  const { coupleId, input, cover, extras, wishId, planId, onProgress } = args;
  const id = uuid();
  const [coverPath, ...extraPaths] = await uploadAll(coupleId, id, [cover, ...extras], onProgress);

  try {
    await writeDate({ id, couple_id: coupleId, ...input, cover_path: coverPath }, (row) =>
      supabase().from("dates").insert(row),
    );
  } catch (e) {
    await removePhotos([coverPath, ...extraPaths]);
    throw e;
  }

  if (extraPaths.length) {
    await run(() =>
      supabase()
        .from("date_photos")
        .insert(extraPaths.map((path, position) => ({ date_id: id, path, position }))),
    );
  }
  if (wishId) {
    await run(() => supabase().from("wishlist").update({ done_date_id: id }).eq("id", wishId));
  }
  if (planId) {
    await run(() => supabase().from("plans").update({ done_date_id: id }).eq("id", planId));
  }
  return id;
}

export async function updateDate(args: {
  coupleId: string;
  id: string;
  input: DateInput;
  oldCoverPath: string | null;
  newCover: File | null;
  newExtras: File[];
  removedPhotos: DatePhoto[];
  /** foto extra que vira capa (a capa antiga vai para o lugar dela) */
  coverFromPhoto?: DatePhoto | null;
  /** com capa nova: a capa antiga vira foto extra em vez de ser apagada */
  keepOldCover?: boolean;
  nextPosition: number;
  onProgress?: SaveProgress;
}) {
  const {
    coupleId,
    id,
    input,
    oldCoverPath,
    newCover,
    newExtras,
    removedPhotos,
    coverFromPhoto,
    keepOldCover,
    nextPosition,
    onProgress,
  } = args;
  const files = newCover ? [newCover, ...newExtras] : newExtras;
  const uploaded = await uploadAll(coupleId, id, files, onProgress);
  const swap = !newCover && coverFromPhoto && oldCoverPath ? coverFromPhoto : null;
  const coverPath = newCover ? uploaded[0] : swap ? swap.path : oldCoverPath;
  const extraPaths = newCover ? uploaded.slice(1) : uploaded;
  const keepOld = !!(newCover && oldCoverPath && keepOldCover);
  if (keepOld) extraPaths.unshift(oldCoverPath!);

  try {
    await writeDate({ ...input, cover_path: coverPath }, (row) => supabase().from("dates").update(row).eq("id", id));
  } catch (e) {
    await removePhotos(uploaded);
    throw e;
  }

  if (swap && oldCoverPath) {
    // a capa antiga ocupa a posição da foto que virou capa
    await run(() => supabase().from("date_photos").update({ path: oldCoverPath }).eq("id", swap.id));
  }
  if (extraPaths.length) {
    await run(() =>
      supabase()
        .from("date_photos")
        .insert(extraPaths.map((path, i) => ({ date_id: id, path, position: nextPosition + i }))),
    );
  }
  if (removedPhotos.length) {
    await run(() =>
      supabase()
        .from("date_photos")
        .delete()
        .in("id", removedPhotos.map((p) => p.id)),
    );
  }
  const orphans = removedPhotos.map((p) => p.path);
  if (newCover && oldCoverPath && !keepOld) orphans.push(oldCoverPath);
  await removePhotos(orphans);
}

/** Troca a capa por uma das fotos extras (a capa antiga fica no lugar dela). */
export async function setCoverFromPhoto(dateId: string, oldCoverPath: string, photo: DatePhoto) {
  await writeDate({ cover_path: photo.path, cover_x: 50, cover_y: 50 }, (row) =>
    supabase().from("dates").update(row).eq("id", dateId),
  );
  await run(() => supabase().from("date_photos").update({ path: oldCoverPath }).eq("id", photo.id));
}

export async function deleteDate(date: DateItem) {
  const photos = await getPhotos(date.id);
  await run(() => supabase().from("dates").delete().eq("id", date.id));
  await removePhotos([
    ...(date.cover_path ? [date.cover_path] : []),
    ...photos.map((p) => p.path),
  ]);
}

export async function setFavorite(id: string, favorite: boolean) {
  await run(() => supabase().from("dates").update({ favorite }).eq("id", id));
}

export async function saveRating(
  dateId: string,
  userId: string,
  score: number,
  comment: string | null,
  criteria: Criteria = {},
) {
  const c = {
    food: criteria.food ?? null,
    ambience: criteria.ambience ?? null,
    price: criteria.price ?? null,
    vibe: criteria.vibe ?? null,
  };
  await run(() =>
    supabase()
      .from("ratings")
      .upsert({ date_id: dateId, user_id: userId, score, comment, ...c }, { onConflict: "date_id,user_id" }),
  );
}

/** Guarda as coordenadas encontradas para o mapa. */
export async function saveCoords(dateId: string, lat: number, lng: number) {
  await run(() => supabase().from("dates").update({ lat, lng }).eq("id", dateId));
}

/* ------------------------------------------------- comentários e reações */

export async function listComments(dateId: string): Promise<Comment[]> {
  return run(() =>
    supabase()
      .from("date_comments")
      .select("id, date_id, user_id, body, created_at")
      .eq("date_id", dateId)
      .order("created_at"),
  );
}

export async function addComment(dateId: string, body: string): Promise<string> {
  const row: { id: string } = await run(() =>
    supabase().from("date_comments").insert({ date_id: dateId, body }).select("id").single(),
  );
  return row.id;
}

export async function deleteComment(id: string) {
  await run(() => supabase().from("date_comments").delete().eq("id", id));
}

export async function listReactions(dateId: string): Promise<Reaction[]> {
  return run(() =>
    supabase()
      .from("reactions")
      .select("id, date_id, target_kind, target_ref, user_id, emoji")
      .eq("date_id", dateId),
  );
}

export async function addReaction(r: Pick<Reaction, "date_id" | "target_kind" | "target_ref" | "emoji">) {
  await run(() => supabase().from("reactions").insert(r));
}

export async function removeReaction(id: string) {
  await run(() => supabase().from("reactions").delete().eq("id", id));
}

/* ------------------------------------------------------------ planos */

const PLAN_COLUMNS = "id, created_by, place_name, place_address, lat, lng, scheduled_at, notes, wish_id, done_date_id";

export async function listPlans(): Promise<Plan[]> {
  return run(() => supabase().from("plans").select(PLAN_COLUMNS).order("scheduled_at"));
}

export async function getPlan(id: string): Promise<Plan | null> {
  const rows: Plan[] = await run(() => supabase().from("plans").select(PLAN_COLUMNS).eq("id", id));
  return rows[0] ?? null;
}

export async function addPlan(
  coupleId: string,
  p: Pick<Plan, "place_name" | "place_address" | "lat" | "lng" | "scheduled_at" | "notes" | "wish_id">,
): Promise<string> {
  const row: { id: string } = await run(() =>
    supabase().from("plans").insert({ couple_id: coupleId, ...p }).select("id").single(),
  );
  return row.id;
}

export async function deletePlan(id: string) {
  await run(() => supabase().from("plans").delete().eq("id", id));
}

/* ---------------------------------------------------------- wishlist */

export async function listWishlist(): Promise<WishItem[]> {
  return run(() =>
    supabase()
      .from("wishlist")
      .select("*")
      .order("created_at", { ascending: false }),
  );
}

export async function addWish(
  coupleId: string,
  place_name: string,
  notes: string | null,
  place?: { address: string | null; lat: number; lng: number } | null,
): Promise<string> {
  const extra = place ? { place_address: place.address, lat: place.lat, lng: place.lng } : {};
  const row: { id: string } = await run(() =>
    supabase().from("wishlist").insert({ couple_id: coupleId, place_name, notes, ...extra }).select("id").single(),
  );
  return row.id;
}

export async function deleteWish(id: string) {
  await run(() => supabase().from("wishlist").delete().eq("id", id));
}
