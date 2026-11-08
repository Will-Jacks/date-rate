"use client";

import { ChevronLeft, ChevronRight, ImageUp, LoaderCircle, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Galeria em tela cheia: deslizar entre as fotos (scroll-snap), contador e teclado. */
export function Gallery({
  urls,
  start,
  onClose,
  onMakeCover,
}: {
  urls: string[];
  start: number;
  onClose: () => void;
  /** se definido, mostra "Usar como capa" nas fotos que não são a capa (a capa é a 1ª) */
  onMakeCover?: (index: number) => Promise<void>;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
  }, [start]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  });

  function go(step: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: (index + step) * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="animate-page-fade fixed inset-0 z-50 bg-black" role="dialog" aria-modal="true" aria-label="Fotos">
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto"
      >
        {urls.map((url, i) => (
          <div key={url} className="grid size-full shrink-0 snap-center place-items-center" onClick={onClose}>
            <img
              src={url}
              alt={`Foto ${i + 1} de ${urls.length}`}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
          {index + 1}/{urls.length}
        </span>
        <button
          onClick={onClose}
          className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur"
          aria-label="Fechar"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {onMakeCover && index > 0 && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onMakeCover(index);
            } finally {
              setBusy(false);
            }
          }}
          className="absolute inset-x-0 bottom-0 z-10 mx-auto mb-[max(2.75rem,calc(env(safe-area-inset-bottom)+1.75rem))] flex h-11 w-fit items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-[#8c2f39] shadow-lg backdrop-blur disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ImageUp className="size-4" aria-hidden />}
          Usar como capa
        </button>
      )}

      {urls.length > 1 && (
        <>
          {index > 0 && (
            <button
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white sm:grid"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          )}
          {index < urls.length - 1 && (
            <button
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white sm:grid"
              aria-label="Próxima foto"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {urls.map((u, i) => (
              <span key={u} className={`size-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/35"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
