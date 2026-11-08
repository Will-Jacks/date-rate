/**
 * Acesso ao Supabase. Toda falha sai como AppError (mensagem amigável);
 * os componentes nunca chamam o Supabase diretamente, só via hooks.ts.
 */
import { AppError, toAppError } from "./errors";
import { uuid } from "./format";
import { compressImage } from "./images";
import { BUCKET, supabase } from "./supabase";
import type { Couple, DateInput, DateItem, DatePhoto, Me, Profile, WishItem } from "./types";

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
  };
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
        .select("id, name, invite_code")
        .eq("id", profile.couple_id!)
        .single(),
    );
  }
  return { userId, email, profile, partner, couple };
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
  onProgress?: SaveProgress;
}): Promise<string> {
  const { coupleId, input, cover, extras, wishId, onProgress } = args;
  const id = uuid();
  const [coverPath, ...extraPaths] = await uploadAll(coupleId, id, [cover, ...extras], onProgress);

  try {
    await run(() =>
      supabase()
        .from("dates")
        .insert({ id, couple_id: coupleId, ...input, cover_path: coverPath }),
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
  nextPosition: number;
  onProgress?: SaveProgress;
}) {
  const { coupleId, id, input, oldCoverPath, newCover, newExtras, removedPhotos, nextPosition, onProgress } = args;
  const files = newCover ? [newCover, ...newExtras] : newExtras;
  const uploaded = await uploadAll(coupleId, id, files, onProgress);
  const coverPath = newCover ? uploaded[0] : oldCoverPath;
  const extraPaths = newCover ? uploaded.slice(1) : uploaded;

  try {
    await run(() =>
      supabase().from("dates").update({ ...input, cover_path: coverPath }).eq("id", id),
    );
  } catch (e) {
    await removePhotos(uploaded);
    throw e;
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
  if (newCover && oldCoverPath) orphans.push(oldCoverPath);
  await removePhotos(orphans);
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

export async function saveRating(dateId: string, userId: string, score: number, comment: string | null) {
  await run(() =>
    supabase()
      .from("ratings")
      .upsert(
        { date_id: dateId, user_id: userId, score, comment },
        { onConflict: "date_id,user_id" },
      ),
  );
}

/* ---------------------------------------------------------- wishlist */

export async function listWishlist(): Promise<WishItem[]> {
  return run(() =>
    supabase()
      .from("wishlist")
      .select("id, place_name, notes, added_by, done_date_id, created_at")
      .order("created_at", { ascending: false }),
  );
}

export async function addWish(coupleId: string, place_name: string, notes: string | null): Promise<string> {
  const row: { id: string } = await run(() =>
    supabase().from("wishlist").insert({ couple_id: coupleId, place_name, notes }).select("id").single(),
  );
  return row.id;
}

export async function deleteWish(id: string) {
  await run(() => supabase().from("wishlist").delete().eq("id", id));
}
