"use client";

import { ArrowLeft, Heart, MapPin, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Cover } from "@/components/cover";
import { RatingPanel } from "@/components/rating-panel";
import { useToast } from "@/components/toast";
import { ErrorState, FullScreenLoader } from "@/components/ui";
import { categoryInfo } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { formatCost, formatDate } from "@/lib/format";
import { useCurrentMe, useDate, usePhotos, useSignedUrls, useToggleFavorite } from "@/lib/hooks";

const roundBtn =
  "grid size-10 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur active:scale-95";

export default function DatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useCurrentMe();
  const date = useDate(id);
  const photos = usePhotos(id);
  const urls = useSignedUrls([date.data?.cover_path, ...(photos.data?.map((p) => p.path) ?? [])]);
  const favorite = useToggleFavorite();
  const toast = useToast();
  const [viewer, setViewer] = useState<string | null>(null);

  if (date.isPending) return <FullScreenLoader />;
  if (date.isError) return <ErrorState error={date.error} onRetry={() => date.refetch()} />;
  const d = date.data;

  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));
  const sub = [formatDate(d.date_on), categoryInfo(d.category).label, d.cost != null ? formatCost(d.cost) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article>
      <div className="relative aspect-[4/5]">
        <Cover url={d.cover_path ? urls.data?.[d.cover_path] : undefined} category={d.category} alt={d.place_name} />
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
              className={`${roundBtn} ${d.favorite ? "text-wine" : ""}`}
              aria-label={d.favorite ? "Remover dos favoritos" : "Favoritar"}
              aria-pressed={d.favorite}
            >
              <Heart className={`size-5 ${d.favorite ? "fill-current" : ""}`} aria-hidden />
            </button>
            <Link href={`/dates/${d.id}/edit`} className={roundBtn} aria-label="Editar date">
              <Pencil className="size-5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 py-5">
        <h1 className="font-serif text-[30px] leading-tight">{d.place_name}</h1>
        <p className="mt-1 text-sm text-muted">{sub}</p>
        {d.place_address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.place_name}, ${d.place_address}`)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-wine"
          >
            <MapPin className="size-4" aria-hidden />
            {d.place_address}
          </a>
        )}

        <div className="mt-6">
          <RatingPanel key={d.id} date={d} me={me} />
        </div>

        {!!photos.data?.length && (
          <section className="mt-8">
            <h2 className="mb-3 font-serif text-xl">Fotos</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.data.map((p) => {
                const url = urls.data?.[p.path];
                return (
                  <button
                    key={p.id}
                    onClick={() => url && setViewer(url)}
                    className="aspect-square overflow-hidden rounded-lg bg-line"
                    aria-label="Ver foto"
                  >
                    {url && <img src={url} alt="" className="size-full object-cover" loading="lazy" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {viewer && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/95"
          onClick={() => setViewer(null)}
          role="dialog"
          aria-modal="true"
        >
          <img src={viewer} alt="" className="max-h-full max-w-full object-contain" />
          <button
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-white/15 text-white"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}
    </article>
  );
}
