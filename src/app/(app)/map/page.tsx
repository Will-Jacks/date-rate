"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { EmptyState, PageHeader } from "@/components/ui";
import { saveCoords } from "@/lib/api";
import { keys, useDates } from "@/lib/hooks";
import { cachedLocation } from "@/lib/geo";
import { geocode } from "@/lib/places";

// Leaflet só roda no navegador
const DatesMap = dynamic(() => import("@/components/dates-map").then((m) => m.DatesMap), {
  ssr: false,
  loading: () => <div className="skeleton size-full" />,
});

export default function MapPage() {
  const dates = useDates();
  const qc = useQueryClient();
  const [locating, setLocating] = useState(0);
  const tried = useRef(new Set<string>());

  const all = dates.data ?? [];
  const onMap = all.filter((d) => d.lat != null && d.lng != null);
  useEffect(() => {
    // dates antigos com endereço mas sem coordenadas: procuramos uma vez cada
    const missing = (dates.data ?? []).filter(
      (d) => d.lat == null && d.place_address && d.category !== "em_casa" && !tried.current.has(d.id),
    );
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const first = (dates.data ?? []).find((d) => d.lat != null && d.lng != null);
      // procura perto de onde vocês estão (ou dos outros dates), para não cair em outro país
      const near = cachedLocation() ?? (first ? { lat: first.lat!, lng: first.lng! } : null);
      for (const d of missing.slice(0, 15)) {
        if (cancelled) return;
        tried.current.add(d.id);
        setLocating((n) => n + 1);
        try {
          const hit = await geocode(d.place_name, d.place_address, near);
          if (hit) await saveCoords(d.id, hit.lat, hit.lng);
        } catch {
          /* segue para o próximo */
        }
        setLocating((n) => n - 1);
        await new Promise((r) => setTimeout(r, 1100)); // respeita o serviço gratuito
      }
      if (!cancelled) qc.invalidateQueries({ queryKey: keys.dates });
    })();
    return () => {
      cancelled = true;
    };
  }, [dates.data, qc]);

  const withoutPlace = all.length - onMap.length;

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col">
      <PageHeader
        title="Mapa"
        right={
          locating > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> localizando…
            </span>
          ) : null
        }
      />
      {dates.isSuccess && !onMap.length && !locating ? (
        <EmptyState
          art="list"
          title="Nenhum date no mapa"
          text="Ao registrar um date, escolha o lugar nas sugestões da busca para ele aparecer aqui."
        />
      ) : (
        <div className="relative mx-4 flex-1 overflow-hidden rounded-2xl border border-line">
          <DatesMap dates={all} />
        </div>
      )}
      {dates.isSuccess && withoutPlace > 0 && (
        <p className="px-4 pt-2 text-center text-xs text-muted">
          {withoutPlace} {withoutPlace === 1 ? "date sem localização" : "dates sem localização"}. Edite e escolha o lugar na busca para incluir.
        </p>
      )}
    </div>
  );
}
