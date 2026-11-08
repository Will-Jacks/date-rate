"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Confetti } from "@/components/confetti";
import { EmptyState, FullScreenLoader } from "@/components/ui";
import { formatCost, formatScore } from "@/lib/format";
import { useCurrentMe, useDates, useSignedUrls } from "@/lib/hooks";
import { achievements, retro, retroYears } from "@/lib/insights";
import type { DateItem } from "@/lib/types";
import { coverPosition } from "@/components/cover";

const BG = [
  "from-[#8c2f39] to-[#e0796b]",
  "from-[#2f5d73] to-[#7fb7c9]",
  "from-[#4b2f6c] to-[#c9a7e0]",
  "from-[#7a4a2d] to-[#e7c38f]",
  "from-[#1d2b17] to-[#5d8a4e]",
  "from-[#21102a] to-[#f08fb1]",
];

type Slide = { key: string; render: () => React.ReactNode; photo?: string | null; position?: string };

function Big({ children }: { children: React.ReactNode }) {
  return <p className="font-serif text-[64px] font-bold leading-none">{children}</p>;
}

function Retro() {
  const me = useCurrentMe();
  const router = useRouter();
  const params = useSearchParams();
  const dates = useDates();
  const all = useMemo(() => dates.data ?? [], [dates.data]);
  const years = retroYears(all);
  const year = Number(params.get("ano")) || years[0] || new Date().getFullYear();
  const r = retro(all, year);
  const covers = useSignedUrls([r.best?.cover_path, r.worst?.cover_path, r.closest?.cover_path, r.furthest?.cover_path]);
  const [i, setI] = useState(0);

  const partner = me.partner?.display_name ?? "seu par";
  const yearDates = all.filter((d) => d.date_on.startsWith(`${year}-`));
  const medals = achievements(yearDates).filter((a) => a.done);

  const photo = (d: DateItem | null) => (d?.cover_path ? covers.data?.[d.cover_path] : null);
  const diff = (d: DateItem) => Math.abs((d.my_score ?? 0) - (d.partner_score ?? 0));

  const slides: Slide[] = [
    {
      key: "intro",
      render: () => (
        <>
          <p className="text-lg text-white/80">{me.profile.display_name} & {partner}</p>
          <Big>{year}</Big>
          <p className="mt-4 font-serif text-3xl leading-tight">o ano em dates</p>
          <p className="mt-8 text-white/70">Toque para continuar →</p>
        </>
      ),
    },
    {
      key: "count",
      render: () => (
        <>
          <p className="text-lg text-white/80">Vocês saíram juntos</p>
          <Big>{r.count}</Big>
          <p className="mt-2 font-serif text-3xl">{r.count === 1 ? "vez" : "vezes"}</p>
          {r.newPlaces > 0 && <p className="mt-6 text-lg">e conheceram <b>{r.newPlaces}</b> {r.newPlaces === 1 ? "lugar novo" : "lugares novos"} 🧭</p>}
        </>
      ),
    },
  ];
  if (r.topMonth)
    slides.push({
      key: "month",
      render: () => (
        <>
          <p className="text-lg text-white/80">O mês mais romântico foi</p>
          <p className="mt-3 font-serif text-5xl font-bold capitalize">{r.topMonth!.month}</p>
          <p className="mt-4 text-lg">com {r.topMonth!.count} {r.topMonth!.count === 1 ? "date" : "dates"} 💘</p>
          {r.topCategory && (
            <p className="mt-8 text-lg">
              O programa favorito: <b>{r.topCategory.label}</b> ({r.topCategory.count}x)
            </p>
          )}
        </>
      ),
    });
  if (r.best)
    slides.push({
      key: "best",
      photo: photo(r.best),
      position: coverPosition(r.best),
      render: () => (
        <>
          <p className="text-lg text-white/85">🏆 O melhor date do ano</p>
          <p className="mt-3 font-serif text-5xl font-bold leading-tight">{r.best!.place_name}</p>
          <p className="mt-4 text-2xl">média {formatScore(r.best!.couple_avg)}</p>
        </>
      ),
    });
  if (r.worst)
    slides.push({
      key: "worst",
      photo: photo(r.worst),
      position: coverPosition(r.worst),
      render: () => (
        <>
          <p className="text-lg text-white/85">😬 E o que não deu tão certo…</p>
          <p className="mt-3 font-serif text-5xl font-bold leading-tight">{r.worst!.place_name}</p>
          <p className="mt-4 text-2xl">média {formatScore(r.worst!.couple_avg)}</p>
        </>
      ),
    });
  if (r.closest)
    slides.push({
      key: "closest",
      photo: photo(r.closest),
      position: coverPosition(r.closest),
      render: () => (
        <>
          <p className="text-lg text-white/85">🎯 Onde vocês mais concordaram</p>
          <p className="mt-3 font-serif text-5xl font-bold leading-tight">{r.closest!.place_name}</p>
          <p className="mt-4 text-2xl">
            {r.closest!.my_score} × {r.closest!.partner_score}
          </p>
        </>
      ),
    });
  if (r.furthest)
    slides.push({
      key: "furthest",
      photo: photo(r.furthest),
      position: coverPosition(r.furthest),
      render: () => (
        <>
          <p className="text-lg text-white/85">🔥 O que mais dividiu opiniões</p>
          <p className="mt-3 font-serif text-5xl font-bold leading-tight">{r.furthest!.place_name}</p>
          <p className="mt-4 text-2xl">
            você {r.furthest!.my_score} × {partner} {r.furthest!.partner_score}
          </p>
          <p className="mt-2 text-white/80">{diff(r.furthest!)} pontos de diferença</p>
        </>
      ),
    });
  slides.push({
    key: "numbers",
    render: () => (
      <>
        <p className="text-lg text-white/80">Em números</p>
        <div className="mt-6 grid grid-cols-2 gap-6 text-left">
          <div>
            <p className="font-serif text-4xl font-bold">{formatScore(r.avg)}</p>
            <p className="text-white/80">média do casal</p>
          </div>
          <div>
            <p className="font-serif text-4xl font-bold">{r.favorites}</p>
            <p className="text-white/80">{r.favorites === 1 ? "favorito" : "favoritos"}</p>
          </div>
          <div className="col-span-2">
            <p className="font-serif text-4xl font-bold">{r.spent ? formatCost(r.spent) : "–"}</p>
            <p className="text-white/80">investidos em vocês 💸</p>
          </div>
        </div>
      </>
    ),
  });
  if (medals.length)
    slides.push({
      key: "medals",
      render: () => (
        <>
          <p className="text-lg text-white/80">Medalhas conquistadas</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {medals.slice(0, 9).map((m) => (
              <div key={m.id} className="flex w-24 flex-col items-center gap-1">
                <span className="grid size-16 place-items-center rounded-full bg-white/15 text-3xl">{m.emoji}</span>
                <span className="text-xs leading-tight">{m.title}</span>
              </div>
            ))}
          </div>
        </>
      ),
    });
  slides.push({
    key: "end",
    render: () => (
      <>
        <p className="font-serif text-4xl font-bold leading-tight">Que venha {year + 1} 💛</p>
        <p className="mt-4 text-lg text-white/85">com muitos dates novos para avaliar.</p>
        <Link href="/wishlist" className="pointer-events-auto mt-10 inline-block rounded-xl bg-white px-5 py-3 font-semibold text-[#8c2f39]">
          Planejar o próximo
        </Link>
      </>
    ),
  });

  const last = slides.length - 1;
  const cur = Math.min(i, last);

  useEffect(() => {
    const t = setTimeout(() => setI((x) => Math.min(x + 1, last)), 6000);
    return () => clearTimeout(t);
  }, [cur, last]);

  if (dates.isPending) return <FullScreenLoader />;
  if (!r.count)
    return <EmptyState art="dates" title="Ainda sem retrospectiva" text="Registrem alguns dates e voltem aqui para ver o resumo do ano." />;

  const slide = slides[cur];
  return (
    <div className={`fixed inset-0 z-50 bg-gradient-to-br ${BG[cur % BG.length]} text-white`}>
      {slide.photo && (
        <>
          <img src={slide.photo} alt="" className="absolute inset-0 size-full object-cover" style={{ objectPosition: slide.position }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />
        </>
      )}

      {/* barras de progresso */}
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {slides.map((s, k) => (
          <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              key={k === cur ? `on-${cur}` : s.key}
              className="h-full bg-white"
              style={
                k < cur
                  ? { width: "100%" }
                  : k === cur
                    ? { width: "100%", animation: "retro-progress 6s linear both" }
                    : { width: 0 }
              }
            />
          </div>
        ))}
      </div>
      <div className="absolute right-3 top-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))] z-20 flex items-center gap-2">
        {years.length > 1 && (
          <select
            value={year}
            onChange={(e) => {
              setI(0);
              router.replace(`/retro?ano=${e.target.value}`);
            }}
            className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur"
            aria-label="Ano"
          >
            {years.map((y) => (
              <option key={y} value={y} className="text-ink">
                {y}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => router.push("/profile")} aria-label="Fechar" className="grid size-10 place-items-center rounded-full bg-white/20 backdrop-blur">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* toque: esquerda volta, direita avança */}
      <button className="absolute inset-y-0 left-0 z-10 w-1/3" aria-label="Anterior" onClick={() => setI(Math.max(0, cur - 1))} />
      <button className="absolute inset-y-0 right-0 z-10 w-2/3" aria-label="Próximo" onClick={() => setI(Math.min(last, cur + 1))} />

      <div key={slide.key} className="animate-page-up relative flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="pointer-events-none relative z-20">{slide.render()}</div>
      </div>
      {slide.key === "end" && <Confetti />}
      <style>{`@keyframes retro-progress { from { transform: translateX(-100%) } to { transform: none } }`}</style>
    </div>
  );
}

export default function RetroPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Retro />
    </Suspense>
  );
}
