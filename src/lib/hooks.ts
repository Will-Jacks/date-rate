"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { useSession } from "@/components/auth-provider";
import type { DateItem, Me } from "./types";

export const keys = {
  me: (uid?: string) => ["me", uid] as const,
  dates: ["dates"] as const,
  date: (id: string) => ["date", id] as const,
  photos: (id: string) => ["photos", id] as const,
  wishlist: ["wishlist"] as const,
  signed: (paths: string[]) => ["signed", ...paths] as const,
};

export function useMe() {
  const { session } = useSession();
  const user = session?.user;
  return useQuery({
    queryKey: keys.me(user?.id),
    queryFn: () => api.fetchMe(user!.id, user!.email ?? ""),
    enabled: !!user,
  });
}

/** Para páginas dentro de (app): o layout garante que o perfil e o casal existem. */
export function useCurrentMe(): Me & { couple: NonNullable<Me["couple"]> } {
  const { data } = useMe();
  if (!data?.couple) throw new Error("useCurrentMe fora do layout autenticado");
  return data as Me & { couple: NonNullable<Me["couple"]> };
}

export function useDates() {
  return useQuery({ queryKey: keys.dates, queryFn: api.listDates });
}

export function useDate(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.date(id),
    queryFn: () => api.getDate(id),
    // mostra na hora o que já veio do feed enquanto atualiza
    placeholderData: () => qc.getQueryData<DateItem[]>(keys.dates)?.find((d) => d.id === id),
  });
}

export function usePhotos(id: string) {
  return useQuery({ queryKey: keys.photos(id), queryFn: () => api.getPhotos(id) });
}

export function useWishlist() {
  return useQuery({ queryKey: keys.wishlist, queryFn: api.listWishlist });
}

/** URLs assinadas (bucket privado). Valem 1h; renovamos com 50 min. */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  const list = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  return useQuery({
    queryKey: keys.signed(list),
    queryFn: () => api.signUrls(list),
    enabled: list.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  });
}

export function useInvalidateDates() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: keys.dates });
    if (id) {
      qc.invalidateQueries({ queryKey: keys.date(id) });
      qc.invalidateQueries({ queryKey: keys.photos(id) });
    }
  };
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      api.setFavorite(id, favorite),
    onMutate: async ({ id, favorite }) => {
      await qc.cancelQueries({ queryKey: keys.dates });
      const prevList = qc.getQueryData<DateItem[]>(keys.dates);
      const prevOne = qc.getQueryData<DateItem>(keys.date(id));
      qc.setQueryData<DateItem[]>(keys.dates, (l) =>
        l?.map((d) => (d.id === id ? { ...d, favorite } : d)),
      );
      qc.setQueryData<DateItem>(keys.date(id), (d) => (d ? { ...d, favorite } : d));
      return { prevList, prevOne };
    },
    onError: (_e, { id }, ctx) => {
      qc.setQueryData(keys.dates, ctx?.prevList);
      qc.setQueryData(keys.date(id), ctx?.prevOne);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.dates });
      qc.invalidateQueries({ queryKey: keys.date(id) });
    },
  });
}

export function useComments(dateId: string) {
  return useQuery({ queryKey: ["comments", dateId], queryFn: () => api.listComments(dateId) });
}

export function useReactions(dateId: string) {
  return useQuery({ queryKey: ["reactions", dateId], queryFn: () => api.listReactions(dateId) });
}

export function usePlans() {
  return useQuery({ queryKey: ["plans"], queryFn: api.listPlans });
}
