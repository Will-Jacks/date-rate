"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { categoryInfo } from "@/lib/categories";
import { compareScores } from "@/lib/compare";
import { formatDate, formatScore } from "@/lib/format";
import type { DateItem } from "@/lib/types";
import { Cover } from "./cover";

export function ScoreBadge({ date, partnerName }: { date: DateItem; partnerName: string | null }) {
  // cores fixas: o selo fica sobre a foto, igual nos temas claro e escuro
  const base = "rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm backdrop-blur";
  if (date.couple_avg != null) {
    const emoji =
      date.my_score != null && date.partner_score != null
        ? compareScores({ mine: date.my_score, partner: date.partner_score, partnerName: "", seed: date.id }).emoji
        : null;
    return (
      <span className={`${base} flex items-center gap-1 bg-white/92 text-[#8c2f39]`}>
        <Heart className="size-3.5 fill-current" aria-hidden />
        {formatScore(date.couple_avg)}
        {emoji && <span className="ml-0.5">{emoji}</span>}
      </span>
    );
  }
  if (date.my_score == null) return <span className={`${base} bg-[#8c2f39] text-white`}>Falta sua nota</span>;
  return (
    <span className={`${base} bg-white/92 text-[#6b5d56]`}>
      {partnerName ? `Esperando ${partnerName}` : "Esperando seu par"}
    </span>
  );
}

export function DateCard({
  date,
  coverUrl,
  partnerName,
  onFavorite,
}: {
  date: DateItem;
  coverUrl?: string;
  partnerName: string | null;
  onFavorite: (favorite: boolean) => void;
}) {
  const router = useRouter();
  const lastTap = useRef(0);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [heartKey, setHeartKey] = useState(0);
  const href = `/dates/${date.id}`;

  // toque simples abre; toque duplo favorita (como no Instagram)
  const onClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (openTimer.current) clearTimeout(openTimer.current);
      lastTap.current = 0;
      setHeartKey((k) => k + 1);
      if (!date.favorite) onFavorite(true);
      return;
    }
    lastTap.current = now;
    openTimer.current = setTimeout(() => router.push(href), 280);
  };

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`${date.place_name}, ${formatDate(date.date_on)}`}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
      onMouseEnter={() => router.prefetch(href)}
      className="relative aspect-[4/5] cursor-pointer select-none overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(43,29,26,.12)] transition-transform active:scale-[.98]"
    >
      <Cover url={coverUrl} category={date.category} alt="" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 via-40% to-transparent to-65%" />

      <div className="absolute right-3.5 top-3.5 flex items-center gap-2">
        {date.favorite && (
          <span className="grid size-8 place-items-center rounded-full bg-white/92 text-[#8c2f39] shadow-sm" aria-label="Favorito">
            <Heart className="size-4 fill-current" aria-hidden />
          </span>
        )}
        <ScoreBadge date={date} partnerName={partnerName} />
      </div>

      {heartKey > 0 && (
        <div key={heartKey} className="pointer-events-none absolute inset-0 grid place-items-center">
          <Heart className="animate-heart size-28 fill-white text-white drop-shadow-lg" aria-hidden />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <h2 className="mb-2 font-serif text-[32px] leading-[1.05]">{date.place_name}</h2>
        <div className="flex flex-wrap items-center gap-2.5 text-[13px] opacity-95">
          <span>{formatDate(date.date_on)}</span>
          <span className="rounded-full bg-white/18 px-2.5 py-1 backdrop-blur-sm">
            {categoryInfo(date.category).label}
          </span>
        </div>
      </div>
    </article>
  );
}
