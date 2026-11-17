"use client";

import { ArrowLeft, Heart, Lock, MessageCircle, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { coverPosition } from "@/components/cover";
import { ShareButton } from "@/components/date-extras";
import { scoreTone } from "@/components/rating-panel";
import { useToast } from "@/components/toast";
import { Avatar, ErrorState, Spinner } from "@/components/ui";
import { categoryInfo } from "@/lib/categories";
import { compareScores } from "@/lib/compare";
import { errorMessage } from "@/lib/errors";
import { applyFeed, feedSearch, readFeedParams } from "@/lib/feed";
import { formatCost, formatDate, formatScore } from "@/lib/format";
import { useCurrentMe, useDates, usePhotos, useSignedUrls, useToggleFavorite } from "@/lib/hooks";
import type { DateItem, Me } from "@/lib/types";

/** true quando o elemento chega perto da tela (carrega as fotos extras só então). */
function useNear<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: "800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

/** Rolagem contínua: abre no date tocado na grade e segue para os próximos. */
function Posts() {
  const me = useCurrentMe();
  const router = useRouter();
  const params = useSearchParams();
  const p = readFeedParams(params);
  const from = params.get("from");
  const dates = useDates();
  const list = useMemo(() => applyFeed(dates.data ?? [], p), [dates.data, p.filter, p.sort, p.query, p.tag]); // eslint-disable-line react-hooks/exhaustive-deps
  const covers = useSignedUrls(list.map((d) => d.cover_path));
  const scrolled = useRef(false);

  // vai direto ao date tocado (depois do Next terminar a navegação, que volta ao topo)
  useEffect(() => {
    if (scrolled.current || !from || !list.length) return;
    const go = () => {
      const el = document.getElementById(`post-${from}`);
      if (!el) return;
      const header = document.getElementById("posts-header")?.offsetHeight ?? 56;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - header, behavior: "instant" });
      scrolled.current = true;
    };
    const raf = requestAnimationFrame(() => setTimeout(go, 0));
    return () => cancelAnimationFrame(raf);
  }, [from, list.length]);

  const back = () => (window.history.length > 1 ? router.back() : router.replace(`/${feedSearch(p)}`));

  return (
    <div>
      <header id="posts-header" className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-line bg-cream/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <button onClick={back} aria-label="Voltar" className="grid size-11 place-items-center">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <h1 className="font-serif text-xl">Nossos dates</h1>
      </header>

      {dates.isPending ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : dates.isError ? (
        <ErrorState error={dates.error} onRetry={() => dates.refetch()} />
      ) : (
        <div className="flex flex-col pb-6">
          {list.map((d) => (
            <Post key={d.id} date={d} me={me} coverUrl={d.cover_path ? covers.data?.[d.cover_path] : undefined} />
          ))}
          {!list.length && <p className="py-16 text-center text-muted">Nenhum date por aqui.</p>}
        </div>
      )}
    </div>
  );
}

function Post({ date: d, me, coverUrl }: { date: DateItem; me: Me; coverUrl?: string }) {
  const [ref, near] = useNear<HTMLElement>();
  const photos = usePhotos(d.id, near);
  const extraUrls = useSignedUrls(near ? (photos.data?.map((x) => x.path) ?? []) : []);
  const favorite = useToggleFavorite();
  const toast = useToast();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [heart, setHeart] = useState(0);
  const lastTap = useRef(0);

  const slides: { key: string; url?: string; position?: string }[] = [
    { key: d.cover_path ?? "cover", url: coverUrl, position: coverPosition(d) },
    ...(photos.data ?? []).map((x) => ({ key: x.path, url: extraUrls.data?.[x.path] })),
  ];
  const partner = me.partner?.display_name ?? "Seu par";
  const toggleFav = (fav: boolean) =>
    favorite.mutate({ id: d.id, favorite: fav }, { onError: (e) => toast(errorMessage(e), "error") });

  return (
    <article ref={ref} id={`post-${d.id}`} className="border-b border-line pb-4 pt-3">
      {/* cabeçalho */}
      <div className="flex items-center gap-3 px-3 pb-3">
        <span className="flex -space-x-2">
          <Avatar name={me.profile.display_name} className="ring-2 ring-cream" />
          {me.partner && <Avatar name={me.partner.display_name} tone="coral" className="ring-2 ring-cream" />}
        </span>
        <Link href={`/dates/${d.id}`} className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">
            {d.place_name} <span className="font-normal text-muted">· {categoryInfo(d.category).label}</span>
          </span>
          <span className="text-xs text-muted">{formatDate(d.date_on)}</span>
        </Link>
        <Link href={`/dates/${d.id}`} aria-label="Ver detalhes e opções" className="grid size-9 place-items-center text-muted">
          <MoreHorizontal className="size-5" aria-hidden />
        </Link>
      </div>

      {/* fotos: deslizar para o lado, dois toques favorita */}
      <div className="relative">
        <div
          ref={track}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          onClick={() => {
            const now = Date.now();
            if (now - lastTap.current < 300) {
              if (!d.favorite) toggleFav(true);
              setHeart((h) => h + 1);
              navigator.vibrate?.(15);
            }
            lastTap.current = now;
          }}
          className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto"
          style={{ backgroundImage: coverUrl ? undefined : categoryInfo(d.category).gradient }}
        >
          {slides.map((s) => (
            <div key={s.key} className="relative size-full shrink-0 snap-center bg-skeleton">
              {s.url && <img src={s.url} alt="" loading="lazy" className="size-full object-cover" style={{ objectPosition: s.position }} />}
            </div>
          ))}
        </div>
        {slides.length > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
            {index + 1}/{slides.length}
          </span>
        )}
        {heart > 0 && (
          <div key={heart} className="pointer-events-none absolute inset-0 grid place-items-center">
            <Heart className="animate-heart size-24 fill-white text-white drop-shadow-lg" aria-hidden />
          </div>
        )}
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-1 pt-2">
          {slides.map((s, i) => (
            <span key={s.key} className={`size-1.5 rounded-full ${i === index ? "bg-wine" : "bg-line"}`} />
          ))}
        </div>
      )}

      {/* ações + nota do casal */}
      <div className="flex items-center px-1.5 pt-1">
        <button
          onClick={() => toggleFav(!d.favorite)}
          aria-label={d.favorite ? "Remover dos favoritos" : "Favoritar"}
          aria-pressed={d.favorite}
          className="grid size-10 place-items-center"
        >
          <Heart className={`size-6 ${d.favorite ? "fill-coral text-coral" : ""}`} aria-hidden />
        </button>
        <Link href={`/dates/${d.id}#conversa`} aria-label="Conversa" className="grid size-10 place-items-center">
          <MessageCircle className="size-6" aria-hidden />
        </Link>
        <ShareButton date={d} coverUrl={coverUrl} me={me} compact />
        <span className="ml-auto pr-2">
          {d.couple_avg != null ? (
            <span className="font-serif text-2xl" style={{ color: scoreTone(Math.round(d.couple_avg)) }}>
              {formatScore(d.couple_avg)}
            </span>
          ) : (
            d.my_score == null && d.partner_rated && <Lock className="size-5 text-muted" aria-label="Nota escondida" />
          )}
        </span>
      </div>

      {/* notas */}
      <div className="px-3 text-sm">
        <Scores date={d} partner={partner} />
        {d.quote && <p className="mt-1.5 font-serif text-[17px] italic leading-snug">“{d.quote}”</p>}
        {d.tags.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-x-2">
            {d.tags.map((t) => (
              <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="font-medium text-wine">
                #{t}
              </Link>
            ))}
          </p>
        )}
        {d.comments_count > 0 && (
          <Link href={`/dates/${d.id}#conversa`} className="mt-1 block text-muted">
            {d.comments_count === 1 ? "Ver o comentário" : `Ver os ${d.comments_count} comentários`}
          </Link>
        )}
        {d.cost != null && <p className="mt-0.5 text-xs text-muted">{formatCost(d.cost)}</p>}
      </div>
    </article>
  );
}

function Scores({ date: d, partner }: { date: DateItem; partner: string }) {
  if (d.my_score != null && d.partner_score != null) {
    const v = compareScores({ mine: d.my_score, partner: d.partner_score, partnerName: partner, seed: d.id });
    return (
      <p>
        <b>Você {d.my_score}</b> · <b>{partner} {d.partner_score}</b>{" "}
        <span className="text-muted">
          {v.emoji} {v.title}
        </span>
      </p>
    );
  }
  if (d.my_score == null) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-wine/8 p-2.5">
        <span className="min-w-0 flex-1 text-[13px]">
          {d.partner_rated ? `🔒 ${partner} já avaliou — avalie para ver a nota.` : "Ninguém deu nota ainda."}
        </span>
        <Link href={`/dates/${d.id}`} className="shrink-0 rounded-lg bg-wine px-3 py-1.5 text-[13px] font-semibold text-white">
          Dar minha nota
        </Link>
      </div>
    );
  }
  return (
    <p>
      <b>Você {d.my_score}</b> <span className="text-muted">· esperando {partner} avaliar</span>
    </p>
  );
}

export default function FeedPostsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      }
    >
      <Posts />
    </Suspense>
  );
}
