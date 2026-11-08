"use client";

import { ArrowDownUp, CalendarHeart, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DateCard } from "@/components/date-card";
import { countdown } from "@/components/plans";
import { PushPrompt } from "@/components/push-settings";
import { useToast } from "@/components/toast";
import { EmptyState, ErrorState, FeedSkeleton, PageHeader } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { formatScore } from "@/lib/format";
import { useCurrentMe, useDates, usePlans, useSignedUrls, useToggleFavorite } from "@/lib/hooks";
import { normalizePlace, onThisDay } from "@/lib/insights";
import type { DateItem } from "@/lib/types";

type Filter = "todos" | "pendentes" | "favoritos";
type Sort = "recentes" | "antigos" | "melhores" | "piores";

const SORTS: [Sort, string][] = [
  ["recentes", "Mais recentes"],
  ["antigos", "Mais antigos"],
  ["melhores", "Maior nota"],
  ["piores", "Menor nota"],
];

const scoreOf = (d: DateItem) => d.couple_avg ?? d.my_score ?? -1;

function Feed() {
  const me = useCurrentMe();
  const router = useRouter();
  const params = useSearchParams();
  const dates = useDates();
  const plans = usePlans();
  const covers = useSignedUrls(dates.data?.map((d) => d.cover_path) ?? []);
  const favorite = useToggleFavorite();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("todos");
  const [sort, setSort] = useState<Sort>("recentes");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const tag = params.get("tag");

  const partnerName = me.partner?.display_name ?? null;
  const all = useMemo(() => dates.data ?? [], [dates.data]);
  const pending = all.filter((d) => d.my_score == null).length;

  const list = useMemo(() => {
    const q = normalizePlace(query);
    const out = all.filter((d) => {
      if (filter === "pendentes" && d.my_score != null) return false;
      if (filter === "favoritos" && !d.favorite) return false;
      if (tag && !d.tags.includes(tag)) return false;
      if (q) {
        const hay = normalizePlace([d.place_name, d.place_address, d.quote, d.tags.join(" ")].filter(Boolean).join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const by = {
      recentes: (a: DateItem, b: DateItem) => b.date_on.localeCompare(a.date_on),
      antigos: (a: DateItem, b: DateItem) => a.date_on.localeCompare(b.date_on),
      melhores: (a: DateItem, b: DateItem) => scoreOf(b) - scoreOf(a),
      piores: (a: DateItem, b: DateItem) => {
        const x = scoreOf(a) < 0 ? 99 : scoreOf(a);
        const y = scoreOf(b) < 0 ? 99 : scoreOf(b);
        return x - y;
      },
    }[sort];
    return [...out].sort(by);
  }, [all, filter, tag, query, sort]);

  const memories = onThisDay(all);
  const nextPlan = (plans.data ?? []).find((p) => !p.done_date_id);
  const nextCountdown = nextPlan ? countdown(nextPlan.scheduled_at) : null;
  const filtering = filter !== "todos" || !!tag || !!query;

  return (
    <>
      <PageHeader
        title="Date Rate"
        right={
          <button
            onClick={() => setSearching((s) => !s)}
            aria-label={searching ? "Fechar busca" : "Buscar"}
            aria-expanded={searching}
            className="grid size-11 place-items-center rounded-full text-muted"
          >
            {searching ? <X className="size-5" aria-hidden /> : <Search className="size-5" aria-hidden />}
          </button>
        }
      />

      {searching && (
        <div className="animate-slide-down flex gap-2 px-4 pb-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lugar, frase, #etiqueta…"
            className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-[16px] outline-none focus:border-wine"
            aria-label="Buscar dates"
          />
          <label className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted">
            <ArrowDownUp className="size-4" aria-hidden />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="absolute inset-0 opacity-0"
              aria-label="Ordenar"
            >
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <PushPrompt partnerName={partnerName} />

      {/* próximo date marcado */}
      {nextPlan && nextCountdown && (
        <Link
          href={nextCountdown.past ? `/dates/new?plan=${nextPlan.id}` : "/wishlist#planos"}
          className="animate-page-fade mx-4 mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#8c2f39] to-[#e0796b] p-4 text-white shadow-[0_8px_24px_rgba(140,47,57,.25)]"
        >
          <CalendarHeart className="size-8 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-white/80">
              {nextCountdown.past ? "Como foi?" : "Próximo date"}
            </span>
            <span className="block truncate font-serif text-xl leading-tight">{nextPlan.place_name}</span>
            <span className="text-sm text-white/90">{nextCountdown.past ? "Toque para registrar e dar as notas" : nextCountdown.text}</span>
          </span>
        </Link>
      )}

      {/* num dia como hoje */}
      {memories.slice(0, 1).map((m) => (
        <Link
          key={m.id}
          href={`/dates/${m.id}`}
          className="animate-page-fade mx-4 mb-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-card"
        >
          <div className="relative size-20 shrink-0 bg-skeleton">
            {m.cover_path && covers.data?.[m.cover_path] && (
              <img src={covers.data[m.cover_path]} alt="" className="size-full object-cover" />
            )}
          </div>
          <span className="min-w-0 flex-1 py-2 pr-3">
            <span className="block text-xs font-semibold uppercase tracking-wide text-wine">
              🕰️ Há {m.yearsAgo} {m.yearsAgo === 1 ? "ano" : "anos"}, neste dia
            </span>
            <span className="block truncate font-serif text-lg">{m.place_name}</span>
            {m.couple_avg != null && <span className="text-sm text-muted">Média do casal: {formatScore(m.couple_avg)}</span>}
          </span>
        </Link>
      ))}

      {!!all.length && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {tag && (
            <button
              onClick={() => router.replace("/")}
              className="flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-wine bg-wine px-3.5 text-[13px] font-medium text-white"
            >
              #{tag} <X className="size-3.5" aria-hidden />
            </button>
          )}
          {(
            [
              ["todos", "Todos"],
              ["pendentes", pending ? `Falta sua nota (${pending})` : "Falta sua nota"],
              ["favoritos", "Favoritos"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium ${
                filter === value ? "border-wine bg-wine text-white" : "border-line bg-card text-ink"
              }`}
            >
              {label}
            </button>
          ))}
          {sort !== "recentes" && (
            <span className="flex min-h-9 shrink-0 items-center rounded-full bg-line/60 px-3 text-[13px] text-muted">
              {SORTS.find(([v]) => v === sort)?.[1]}
            </span>
          )}
        </div>
      )}

      {dates.isPending ? (
        <FeedSkeleton />
      ) : dates.isError ? (
        <ErrorState error={dates.error} onRetry={() => dates.refetch()} />
      ) : !all.length ? (
        <EmptyState
          art="dates"
          title="Nenhum date ainda"
          text="Toque no + para registrar o primeiro. A capa vira um card aqui no feed."
          action={
            <Link href="/dates/new" className="mt-2 rounded-xl bg-wine px-5 py-3 font-semibold text-white">
              Registrar date
            </Link>
          }
        />
      ) : !list.length ? (
        <EmptyState
          art={filter === "favoritos" ? "favorites" : query || tag ? "list" : "done"}
          title={query || tag ? "Nada encontrado" : filter === "favoritos" ? "Sem favoritos" : "Tudo avaliado!"}
          text={
            query || tag
              ? "Tente outra palavra ou limpe os filtros."
              : filter === "favoritos"
                ? "Toque duas vezes num card para favoritar."
                : "Você já deu nota para todos os dates."
          }
        />
      ) : (
        <main className="flex flex-col gap-[18px] px-4 pt-1">
          {filtering && (
            <p className="-mb-2 text-xs text-muted">
              {list.length} {list.length === 1 ? "date" : "dates"}
            </p>
          )}
          {list.map((d) => (
            <DateCard
              key={d.id}
              date={d}
              coverUrl={d.cover_path ? covers.data?.[d.cover_path] : undefined}
              partnerName={partnerName}
              onFavorite={(fav) =>
                favorite.mutate({ id: d.id, favorite: fav }, { onError: (e) => toast(errorMessage(e), "error") })
              }
            />
          ))}
        </main>
      )}
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <Feed />
    </Suspense>
  );
}
