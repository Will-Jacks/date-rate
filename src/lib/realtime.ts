"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/toast";
import { listDates } from "./api";
import { keys } from "./hooks";
import { supabase } from "./supabase";
import type { DateItem, Me } from "./types";

/** O que mudou entre duas versões do feed, do ponto de vista de quem está usando. */
export function diffDates(prev: DateItem[], next: DateItem[], me: Me) {
  const before = new Map(prev.map((d) => [d.id, d]));
  const partner = me.partner?.display_name ?? "Seu par";
  const news: { text: string; href: string }[] = [];

  for (const d of next) {
    const old = before.get(d.id);
    if (!old) {
      if (d.created_by !== me.userId) {
        news.push({ text: `📸 ${partner} registrou um date: ${d.place_name}`, href: `/dates/${d.id}` });
      }
      continue;
    }
    if (!old.partner_rated && d.partner_rated) {
      news.push({
        text:
          d.my_score == null
            ? `💌 ${partner} avaliou ${d.place_name}! Avalie também para ver a nota.`
            : `💌 ${partner} avaliou ${d.place_name}! Toque para ver.`,
        href: `/dates/${d.id}`,
      });
    }
  }
  return news;
}

/**
 * Escuta o Supabase Realtime e mantém o app atualizado sozinho:
 * novos dates, notas do par, edições, lista "Queremos ir" e entrada do par.
 */
export function useRealtime(me: Me | undefined) {
  const qc = useQueryClient();
  const toast = useToast();
  const meRef = useRef(me);
  const coupleId = me?.couple?.id;

  useEffect(() => {
    meRef.current = me;
  });

  useEffect(() => {
    if (!coupleId) return;
    const sb = supabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    // garante uma lista "anterior" para comparar, mesmo abrindo fora do feed
    qc.prefetchQuery({ queryKey: keys.dates, queryFn: listDates });

    // Vários eventos chegam juntos (ex.: date + fotos); agrupa em uma atualização.
    const refreshDates = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const prev = qc.getQueryData<DateItem[]>(keys.dates);
        try {
          const next = await qc.fetchQuery({ queryKey: keys.dates, queryFn: listDates, staleTime: 0 });
          const current = meRef.current;
          if (prev && current) diffDates(prev, next, current).forEach((n) => toast(n.text, "news", n.href));
        } catch {
          /* sem rede: a próxima atualização resolve */
        }
        qc.invalidateQueries({ queryKey: ["date"] });
        qc.invalidateQueries({ queryKey: ["photos"] });
      }, 400);
    };

    const channel = sb
      .channel(`couple-${coupleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dates", filter: `couple_id=eq.${coupleId}` }, refreshDates)
      // DELETE não pode ser filtrado por coluna no Realtime
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "dates" }, refreshDates)
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlist", filter: `couple_id=eq.${coupleId}` }, () =>
        qc.invalidateQueries({ queryKey: keys.wishlist }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `couple_id=eq.${coupleId}` }, () =>
        qc.invalidateQueries({ queryKey: ["me"] }),
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      sb.removeChannel(channel);
    };
  }, [coupleId, qc, toast]);
}
