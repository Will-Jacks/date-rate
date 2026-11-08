"use client";

import { ArrowDownRight, ArrowUpRight, Minus, RotateCcw, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDate, formatScore } from "@/lib/format";
import { visitsOf } from "@/lib/insights";
import { renderShareCard, shareImage } from "@/lib/share-card";
import type { DateItem, Me } from "@/lib/types";
import { useToast } from "./toast";
import { Button } from "./ui";

/** Outras visitas ao mesmo lugar, com a evolução da nota. */
export function Revisits({ date, all }: { date: DateItem; all: DateItem[] }) {
  const visits = visitsOf(date, all);
  const params = new URLSearchParams({ place: date.place_name, ...(date.place_address ? { address: date.place_address } : {}) });

  const score = (d: DateItem) => d.couple_avg ?? d.my_score;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-xl">{visits.length > 1 ? `${visits.length} visitas aqui` : "Visitas"}</h2>
        <Link href={`/dates/new?${params}`} className="flex items-center gap-1.5 text-sm font-semibold text-wine">
          <RotateCcw className="size-4" aria-hidden /> Visitar de novo
        </Link>
      </div>
      {visits.length > 1 ? (
        <ol className="flex flex-col gap-2">
          {visits.map((v, i) => {
            const prev = i > 0 ? score(visits[i - 1]) : null;
            const cur = score(v);
            const trend = prev == null || cur == null ? null : cur > prev ? "up" : cur < prev ? "down" : "same";
            const isThis = v.id === date.id;
            return (
              <li key={v.id}>
                <Link
                  href={`/dates/${v.id}`}
                  aria-current={isThis ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${isThis ? "border-wine/40 bg-wine/5" : "border-line bg-card"}`}
                >
                  <span className="text-xs font-semibold text-muted">{i + 1}ª</span>
                  <span className="flex-1 text-sm">{formatDate(v.date_on)}</span>
                  {trend === "up" && <ArrowUpRight className="size-4 text-emerald-600" aria-label="melhorou" />}
                  {trend === "down" && <ArrowDownRight className="size-4 text-wine" aria-label="piorou" />}
                  {trend === "same" && <Minus className="size-4 text-muted" aria-label="igual" />}
                  <span className="w-10 text-right font-serif text-lg text-wine">{formatScore(cur)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted">Primeira vez aqui. Se voltarem, dá para comparar se o lugar melhorou ou piorou.</p>
      )}
    </section>
  );
}

/** Botão que gera o card no formato stories e abre o compartilhamento. */
export function ShareButton({ date, coverUrl, me }: { date: DateItem; coverUrl?: string; me: Me }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    const opts = { date, coverUrl, myName: me.profile.display_name, partnerName: me.partner?.display_name ?? "Par" };
    try {
      let blob: Blob;
      try {
        blob = await renderShareCard(opts);
      } catch {
        // se a foto não puder ir para o canvas, gera com o gradiente
        blob = await renderShareCard({ ...opts, coverUrl: undefined });
      }
      const r = await shareImage(blob, `date-${date.place_name.replace(/\W+/g, "-").toLowerCase()}`);
      if (r === "downloaded") toast("Imagem salva nos downloads.");
    } catch {
      toast("Não consegui gerar a imagem.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" className="w-full" loading={busy} onClick={share}>
      <Share2 className="size-4" aria-hidden /> Compartilhar card
    </Button>
  );
}
