"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, Camera, Grid3x3, Heart, Lock, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { coverPosition } from "@/components/cover";
import { countdown } from "@/components/plans";
import { useToast } from "@/components/toast";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { setCouplePhoto } from "@/lib/api";
import { categoryInfo } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { applyFeed, feedSearch, readFeedParams, SORTS, type FeedParams, type Filter, type Sort } from "@/lib/feed";
import { formatScore } from "@/lib/format";
import { keys, useCurrentMe, useDates, usePlans, useSignedUrls, useWishlist } from "@/lib/hooks";
import { normalizePlace, onThisDay, weeklyStreak } from "@/lib/insights";
import type { DateItem } from "@/lib/types";

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="skeleton aspect-[4/5]" />
      ))}
    </div>
  );
}

/** Perfil do casal: foto, números, destaques e a grade de capas (estilo Instagram). */
function Profile() {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = readFeedParams(params);
  // a busca fica num estado local (digitar não espera a URL atualizar)
  const [query, setQuery] = useState(fromUrl.query);
  const p: FeedParams = { ...fromUrl, query };
  const dates = useDates();
  const covers = useSignedUrls(dates.data?.map((d) => d.cover_path) ?? []);
  const [searching, setSearching] = useState(!!p.query);

  const all = useMemo(() => dates.data ?? [], [dates.data]);
  const list = useMemo(() => applyFeed(all, p), [all, p.filter, p.sort, p.query, p.tag]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = all.filter((d) => d.my_score == null).length;

  const setParams = (next: Partial<FeedParams>) => router.replace(`/album${feedSearch({ ...p, ...next })}`, { scroll: false });

  return (
    <>
      <PageHeader
        title="Nosso álbum"
        right={
          <button
            onClick={() => {
              if (searching && query) {
                setQuery("");
                setParams({ query: "" });
              }
              setSearching((s) => !s);
            }}
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
            value={p.query}
            onChange={(e) => {
              setQuery(e.target.value);
              setParams({ query: e.target.value });
            }}
            placeholder="Lugar, frase, #etiqueta…"
            className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-[16px] outline-none focus:border-wine"
            aria-label="Buscar dates"
          />
          <label className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted">
            <ArrowDownUp className="size-4" aria-hidden />
            <select
              value={p.sort}
              onChange={(e) => setParams({ sort: e.target.value as Sort })}
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

      <ProfileHeader dates={all} />
      <Highlights dates={all} coverUrls={covers.data ?? {}} />

      {/* abas */}
      <div className="mt-2 flex border-b border-line" role="tablist">
        {(
          [
            ["todos", <Grid3x3 key="g" className="size-5" aria-hidden />, "Todos"],
            ["pendentes", <Lock key="l" className="size-5" aria-hidden />, pending ? `Falta sua nota (${pending})` : "Falta sua nota"],
            ["favoritos", <Heart key="h" className="size-5" aria-hidden />, "Favoritos"],
          ] as [Filter, React.ReactNode, string][]
        ).map(([value, icon, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={p.filter === value}
            aria-label={label}
            onClick={() => setParams({ filter: value })}
            className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold ${
              p.filter === value ? "text-ink" : "text-muted"
            }`}
          >
            {icon}
            {value === "pendentes" && pending > 0 && <span className="rounded-full bg-coral px-1.5 text-[10px] text-white">{pending}</span>}
            {p.filter === value && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-ink" />}
          </button>
        ))}
      </div>

      {(p.tag || p.sort !== "recentes") && (
        <div className="flex gap-2 px-4 pt-3">
          {p.tag && (
            <button
              onClick={() => setParams({ tag: null })}
              className="flex min-h-8 items-center gap-1 rounded-full bg-wine px-3 text-[13px] font-medium text-white"
            >
              #{p.tag} <X className="size-3.5" aria-hidden />
            </button>
          )}
          {p.sort !== "recentes" && (
            <span className="flex min-h-8 items-center rounded-full bg-line/60 px-3 text-[13px] text-muted">
              {SORTS.find(([v]) => v === p.sort)?.[1]}
            </span>
          )}
        </div>
      )}

      <div className="pt-0.5">
        {dates.isPending ? (
          <GridSkeleton />
        ) : dates.isError ? (
          <ErrorState error={dates.error} onRetry={() => dates.refetch()} />
        ) : !all.length ? (
          <EmptyState
            art="dates"
            title="Nenhum date ainda"
            text="Toque no + para registrar o primeiro. A capa aparece aqui na grade."
            action={
              <Link href="/dates/new" className="mt-2 rounded-xl bg-wine px-5 py-3 font-semibold text-white">
                Registrar date
              </Link>
            }
          />
        ) : !list.length ? (
          <EmptyState
            art={p.filter === "favoritos" ? "favorites" : p.query || p.tag ? "list" : "done"}
            title={p.query || p.tag ? "Nada encontrado" : p.filter === "favoritos" ? "Sem favoritos" : "Tudo avaliado!"}
            text={
              p.query || p.tag
                ? "Tente outra palavra ou limpe os filtros."
                : p.filter === "favoritos"
                  ? "Toque duas vezes numa foto para favoritar."
                  : "Você já deu nota para todos os dates."
            }
          />
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {list.map((d) => (
              <GridItem key={d.id} date={d} url={d.cover_path ? covers.data?.[d.cover_path] : undefined} href={`/feed${feedSearch(p, { from: d.id })}`} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function GridItem({ date: d, url, href }: { date: DateItem; url?: string; href: string }) {
  const locked = d.my_score == null && d.partner_rated;
  return (
    <Link
      href={href}
      aria-label={d.place_name}
      className="relative block aspect-[4/5] overflow-hidden bg-skeleton"
      style={{ backgroundImage: url ? undefined : categoryInfo(d.category).gradient }}
    >
      {url && <img src={url} alt="" loading="lazy" className="size-full object-cover" style={{ objectPosition: coverPosition(d) }} />}
      {d.favorite && <Heart className="absolute right-1.5 top-1.5 size-4 fill-white text-white drop-shadow" aria-label="Favorito" />}
      <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur">
        {d.couple_avg != null ? (
          formatScore(d.couple_avg)
        ) : locked ? (
          <Lock className="size-3" aria-label="Nota escondida" />
        ) : d.my_score != null ? (
          <>
            {d.my_score}
            <span className="font-normal opacity-75">·você</span>
          </>
        ) : (
          <span className="font-medium">sem nota</span>
        )}
      </span>
    </Link>
  );
}

/** Foto do casal + números + atalhos. */
function ProfileHeader({ dates }: { dates: DateItem[] }) {
  const me = useCurrentMe();
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const photo = useSignedUrls([me.couple.photo_path]);
  const photoUrl = me.couple.photo_path ? photo.data?.[me.couple.photo_path] : undefined;

  const scored = dates.filter((d) => d.couple_avg != null);
  const avg = scored.length ? scored.reduce((s, d) => s + d.couple_avg!, 0) / scored.length : null;
  const places = new Set(dates.map((d) => normalizePlace(d.place_name))).size;
  const { current: streak } = weeklyStreak(dates);
  const names = [me.profile.display_name, me.partner?.display_name].filter(Boolean).join(" & ");

  async function change(file: File) {
    setUploading(true);
    try {
      await setCouplePhoto(me.couple.id, file, me.couple.photo_path);
      await qc.invalidateQueries({ queryKey: keys.me(me.userId) });
      toast("Foto do casal atualizada 💞");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="px-4 pb-2">
      <div className="flex items-center gap-5">
        <button
          onClick={() => input.current?.click()}
          aria-label="Trocar foto do casal"
          className="relative size-[88px] shrink-0 rounded-full bg-gradient-to-tr from-[#f6b47a] via-[#e0796b] to-[#8c2f39] p-[3px]"
        >
          <span className="grid size-full place-items-center overflow-hidden rounded-full border-[3px] border-cream bg-card">
            {photoUrl ? (
              <img src={photoUrl} alt="Nós dois" className="size-full object-cover" />
            ) : (
              <span className="text-3xl" aria-hidden>
                💞
              </span>
            )}
          </span>
          <span className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full border-2 border-cream bg-wine text-white">
            {uploading ? <span className="size-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Camera className="size-3.5" aria-hidden />}
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void change(f);
            e.target.value = "";
          }}
        />
        <dl className="grid flex-1 grid-cols-3 text-center">
          {(
            [
              [String(dates.length), dates.length === 1 ? "date" : "dates"],
              [avg != null ? formatScore(Math.round(avg * 10) / 10) : "–", "média"],
              [String(places), places === 1 ? "lugar" : "lugares"],
            ] as const
          ).map(([value, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="font-serif text-2xl leading-tight">{value}</dd>
              <dd className="text-xs text-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-3 font-semibold">{names} 💞</p>
      {streak > 0 && <p className="text-sm text-muted">🔥 {streak} {streak === 1 ? "semana seguida" : "semanas seguidas"} com date</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/profile" className="flex min-h-9 items-center justify-center rounded-lg bg-line/70 text-sm font-semibold">
          Nós
        </Link>
        <Link href="/dates/new" className="flex min-h-9 items-center justify-center gap-1 rounded-lg bg-wine text-sm font-semibold text-white">
          <Plus className="size-4" aria-hidden /> Novo date
        </Link>
      </div>
    </section>
  );
}

/** Destaques redondos: dates marcados, "num dia como hoje" e a lista "Queremos ir". */
function Highlights({ dates, coverUrls }: { dates: DateItem[]; coverUrls: Record<string, string> }) {
  const plans = usePlans();
  const wishlist = useWishlist();

  type H = { key: string; href: string; label: string; emoji?: string; img?: string; ring?: boolean; fav?: boolean };
  const items: H[] = [];
  // favoritos primeiro: um por lugar (o date mais recente daquele lugar)
  const seen = new Set<string>();
  for (const d of dates.filter((x) => x.favorite).sort((a, b) => b.date_on.localeCompare(a.date_on))) {
    const place = normalizePlace(d.place_name);
    if (seen.has(place)) continue;
    seen.add(place);
    items.push({
      key: `f-${d.id}`,
      href: `/feed?from=${d.id}`,
      label: d.place_name,
      img: d.cover_path ? coverUrls[d.cover_path] : undefined,
      emoji: "♥",
      ring: true,
      fav: true,
    });
  }
  for (const pl of (plans.data ?? []).filter((x) => !x.done_date_id).slice(0, 3)) {
    const c = countdown(pl.scheduled_at);
    items.push({
      key: `p-${pl.id}`,
      href: c.past ? `/dates/new?plan=${pl.id}` : "/wishlist#planos",
      label: c.past ? "Como foi?" : c.text,
      emoji: "📅",
      ring: true,
    });
  }
  for (const m of onThisDay(dates).slice(0, 2)) {
    items.push({
      key: `m-${m.id}`,
      href: `/dates/${m.id}`,
      label: `Há ${m.yearsAgo} ${m.yearsAgo === 1 ? "ano" : "anos"}`,
      img: m.cover_path ? coverUrls[m.cover_path] : undefined,
      emoji: "🕰️",
      ring: true,
    });
  }
  for (const w of (wishlist.data ?? []).filter((x) => !x.done_date_id).slice(0, 8)) {
    items.push({ key: `w-${w.id}`, href: "/wishlist", label: w.place_name, emoji: "📍" });
  }

  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 py-3">
      <Link href="/wishlist" className="flex w-16 shrink-0 flex-col items-center gap-1">
        <span className="grid size-16 place-items-center rounded-full border-2 border-dashed border-line text-muted">
          <Plus className="size-6" aria-hidden />
        </span>
        <span className="w-full truncate text-center text-[11px]">Planos</span>
      </Link>
      {items.map((h) => (
        <Link key={h.key} href={h.href} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span
            className={`relative grid size-16 place-items-center rounded-full p-[2.5px] ${
              h.ring ? "bg-gradient-to-tr from-[#f6b47a] via-[#e0796b] to-[#8c2f39]" : "bg-line"
            }`}
          >
            <span className="grid size-full place-items-center overflow-hidden rounded-full border-2 border-cream bg-card text-2xl">
              {h.img ? <img src={h.img} alt="" className="size-full object-cover" /> : <span aria-hidden>{h.emoji}</span>}
            </span>
            {h.fav && (
              <span className="absolute bottom-0 right-0 grid size-5 place-items-center rounded-full border-2 border-cream bg-coral text-white">
                <Heart className="size-2.5 fill-current" aria-label="Favorito" />
              </span>
            )}
          </span>
          <span className="w-full truncate text-center text-[11px]">{h.label}</span>
        </Link>
      ))}
    </div>
  );
}

export default function ProfileGridPage() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <Profile />
    </Suspense>
  );
}
