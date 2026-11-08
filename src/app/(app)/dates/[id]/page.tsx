"use client";

import { ArrowLeft, Heart, Images, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Conversation } from "@/components/conversation";
import { Cover } from "@/components/cover";
import { CriteriaRadar, hasCriteria } from "@/components/criteria";
import { Revisits, ShareButton } from "@/components/date-extras";
import { Gallery } from "@/components/gallery";
import { RatingPanel } from "@/components/rating-panel";
import { useToast } from "@/components/toast";
import { DetailSkeleton, ErrorState } from "@/components/ui";
import { categoryInfo } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { formatCost, formatDate } from "@/lib/format";
import { useCurrentMe, useDate, useDates, usePhotos, useSignedUrls, useToggleFavorite } from "@/lib/hooks";

// botões de vidro escuro: legíveis sobre qualquer foto, no tema claro ou escuro
const roundBtn =
  "grid size-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md active:scale-95";

export default function DatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useCurrentMe();
  const date = useDate(id);
  const photos = usePhotos(id);
  const all = useDates();
  const urls = useSignedUrls([date.data?.cover_path, ...(photos.data?.map((p) => p.path) ?? [])]);
  const favorite = useToggleFavorite();
  const toast = useToast();
  const [viewer, setViewer] = useState<number | null>(null);

  if (date.isPending) return <DetailSkeleton />;
  if (date.isError) return <ErrorState error={date.error} onRetry={() => date.refetch()} />;
  const d = date.data;

  // capa + fotos extras, na ordem da galeria
  const galleryPaths = [d.cover_path, ...(photos.data?.map((p) => p.path) ?? [])].filter(
    (p): p is string => !!p && !!urls.data?.[p],
  );
  const galleryUrls = galleryPaths.map((p) => urls.data![p]);
  const openAt = (path: string | null) => {
    const i = path ? galleryPaths.indexOf(path) : -1;
    if (i >= 0) setViewer(i);
  };

  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));
  const sub = [formatDate(d.date_on), categoryInfo(d.category).label, d.cost != null ? formatCost(d.cost) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article>
      <div className="relative h-[55dvh] min-h-72 overflow-hidden">
        <button className="absolute inset-0" onClick={() => openAt(d.cover_path)} aria-label="Ver fotos em tela cheia">
          <Cover url={d.cover_path ? urls.data?.[d.cover_path] : undefined} category={d.category} alt={d.place_name} />
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 via-45% to-black/25" />

        <div className="absolute inset-x-0 top-0 flex justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button onClick={back} className={roundBtn} aria-label="Voltar">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() =>
                favorite.mutate(
                  { id: d.id, favorite: !d.favorite },
                  { onError: (e) => toast(errorMessage(e), "error") },
                )
              }
              className={roundBtn}
              aria-label={d.favorite ? "Remover dos favoritos" : "Favoritar"}
              aria-pressed={d.favorite}
            >
              <Heart className={`size-5 ${d.favorite ? "fill-coral text-coral" : ""}`} aria-hidden />
            </button>
            <Link href={`/dates/${d.id}/edit`} className={roundBtn} aria-label="Editar date">
              <Pencil className="size-5" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white">
          {galleryUrls.length > 1 && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
              <Images className="size-3.5" aria-hidden /> {galleryUrls.length} fotos
            </span>
          )}
          <h1 className="font-serif text-[34px] leading-[1.05]">{d.place_name}</h1>
          <p className="mt-1.5 text-sm text-white/85">{sub}</p>
        </div>
      </div>

      <div className="px-4 py-5">
        {d.place_address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.place_name}, ${d.place_address}`)}`}
            target="_blank"
            rel="noreferrer"
            className="mb-5 inline-flex items-center gap-1 text-sm text-wine"
          >
            <MapPin className="size-4" aria-hidden />
            {d.place_address}
          </a>
        )}

        {d.quote && (
          <blockquote className="mb-5 border-l-4 border-coral pl-4 font-serif text-xl italic leading-snug">“{d.quote}”</blockquote>
        )}
        {d.tags.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {d.tags.map((t) => (
              <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="rounded-full bg-wine/10 px-2.5 py-1 text-sm font-medium text-wine">
                #{t}
              </Link>
            ))}
          </div>
        )}

        <RatingPanel key={d.id} date={d} me={me} />

        {(hasCriteria(d.my_criteria) || hasCriteria(d.partner_criteria)) && (
          <section className="mt-6 rounded-2xl border border-line bg-card p-4">
            <h2 className="mb-2 font-serif text-lg">Por critério</h2>
            <CriteriaRadar
              mine={d.my_criteria}
              partner={d.partner_criteria}
              myName="Você"
              partnerName={me.partner?.display_name ?? "Seu par"}
            />
          </section>
        )}

        {!!photos.data?.length && (
          <section className="mt-8">
            <h2 className="mb-3 font-serif text-xl">Fotos</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.data.map((p) => {
                const url = urls.data?.[p.path];
                return (
                  <button
                    key={p.id}
                    onClick={() => openAt(p.path)}
                    className="aspect-square overflow-hidden rounded-lg bg-skeleton"
                    aria-label="Ver foto"
                  >
                    {url && <img src={url} alt="" className="size-full object-cover" loading="lazy" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <Conversation dateId={d.id} me={me} />

        {all.data && <Revisits date={d} all={all.data} />}

        <div className="mt-8">
          <ShareButton date={d} coverUrl={d.cover_path ? urls.data?.[d.cover_path] : undefined} me={me} />
        </div>
      </div>

      {viewer != null && <Gallery urls={galleryUrls} start={viewer} onClose={() => setViewer(null)} />}
    </article>
  );
}
