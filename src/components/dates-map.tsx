"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { categoryInfo } from "@/lib/categories";
import { formatDate, formatScore } from "@/lib/format";
import type { DateItem } from "@/lib/types";
import { scoreTone } from "./rating-panel";

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Mapa com um pino por date (cor = nota do casal). Leaflet + OpenStreetMap, sem chave. */
export function DatesMap({ dates }: { dates: DateItem[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([-14.2, -51.9], 4); // Brasil, até ter pinos
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map.current);
        L.control.zoom({ position: "bottomright" }).addTo(map.current);
      }
      const m = map.current;
      m.eachLayer((layer) => {
        if ((layer as unknown as { options?: { pane?: string } }).options?.pane === "markerPane") m.removeLayer(layer);
      });

      const points = dates.filter((d) => d.lat != null && d.lng != null);
      const bounds: [number, number][] = [];
      for (const d of points) {
        const score = d.couple_avg ?? d.my_score;
        const color = score != null ? scoreTone(Math.round(score)) : "#8a7b74";
        const icon = L.divIcon({
          className: "",
          iconSize: [40, 48],
          iconAnchor: [20, 46],
          popupAnchor: [0, -44],
          html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))">
            <div style="width:38px;height:38px;border-radius:50%;background:${color};border:3px solid #fff;display:grid;place-items:center;color:#fff;font:700 14px system-ui">${score != null ? escape(formatScore(score)) : "♥"}</div>
            <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #fff;margin-top:-2px"></div>
          </div>`,
        });
        const marker = L.marker([d.lat!, d.lng!], { icon, title: d.place_name }).addTo(m);
        const popup = document.createElement("button");
        popup.style.cssText = "all:unset;cursor:pointer;display:block;min-width:140px";
        popup.innerHTML = `<b style="font-size:15px">${escape(d.place_name)}</b><br><span style="color:#8a7b74;font-size:12px">${escape(
          `${formatDate(d.date_on)} · ${categoryInfo(d.category).label}`,
        )}</span><br><span style="color:#8c2f39;font-weight:600;font-size:13px">Ver date →</span>`;
        popup.onclick = () => router.push(`/dates/${d.id}`);
        marker.bindPopup(popup);
        bounds.push([d.lat!, d.lng!]);
      }
      if (bounds.length === 1) m.setView(bounds[0], 15);
      else if (bounds.length > 1) m.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    })();
    return () => {
      cancelled = true;
    };
  }, [dates, router]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={el} className="size-full" />;
}
