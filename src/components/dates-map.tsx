"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { Expand, LoaderCircle, LocateFixed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { categoryInfo } from "@/lib/categories";
import { formatDate, formatScore } from "@/lib/format";
import { cachedLocation, locate, type LatLng } from "@/lib/geo";
import type { DateItem } from "@/lib/types";
import { scoreTone } from "./rating-panel";

type L = typeof import("leaflet");

const BRAZIL: [number, number] = [-14.2, -51.9];
const CITY_ZOOM = 13;

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const pinsOf = (dates: DateItem[]) => dates.filter((d) => d.lat != null && d.lng != null);

/**
 * Mapa com um pino por date (cor = nota do casal). Leaflet + OpenStreetMap, sem chave.
 * Abre na localização atual (se a pessoa permitir); "Ver todos" enquadra os dates.
 */
export function DatesMap({ dates }: { dates: DateItem[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const lib = useRef<L | null>(null);
  const pins = useRef<LayerGroup | null>(null);
  const me = useRef<Marker | null>(null);
  const moved = useRef(false); // a pessoa já mexeu no mapa: não recentralizar sozinho
  const datesRef = useRef(dates);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const router = useRouter();

  function showMe(loc: LatLng) {
    const Lf = lib.current;
    const m = map.current;
    if (!Lf || !m) return;
    const icon = Lf.divIcon({
      className: "",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      html: `<div style="width:22px;height:22px;border-radius:50%;background:#2f80ed;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,128,237,.22),0 2px 6px rgba(0,0,0,.3)"></div>`,
    });
    if (me.current) me.current.setLatLng([loc.lat, loc.lng]);
    else me.current = Lf.marker([loc.lat, loc.lng], { icon, title: "Você está aqui", zIndexOffset: -100, keyboard: false }).addTo(m);
  }

  function fitAll(animate = true) {
    const m = map.current;
    const points = pinsOf(datesRef.current).map((d) => [d.lat!, d.lng!] as [number, number]);
    if (!m || !points.length) return;
    if (points.length === 1) m.setView(points[0], 15, { animate });
    else m.fitBounds(points, { padding: [48, 48], maxZoom: 15, animate });
  }

  /** O Leaflet ignora setView durante uma animação de zoom: espera ela acabar. */
  function whenIdle(fn: () => void) {
    const m = map.current as (LeafletMap & { _animatingZoom?: boolean }) | null;
    if (m?._animatingZoom) m.once("zoomend", fn);
    else fn();
  }

  async function goToMe(userAsked: boolean) {
    setLocating(true);
    const loc = await locate();
    setLocating(false);
    if (!loc || !map.current) {
      if (userAsked) window.alert("Não foi possível pegar sua localização. Confira se o app tem permissão de localização.");
      return;
    }
    showMe(loc);
    if (userAsked || !moved.current)
      whenIdle(() => map.current?.setView([loc.lat, loc.lng], Math.max(map.current.getZoom(), CITY_ZOOM)));
  }

  // cria o mapa uma vez
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lf = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      lib.current = Lf;
      const last = cachedLocation();
      const points = pinsOf(datesRef.current);
      const m = Lf.map(el.current, { zoomControl: false, attributionControl: true });
      map.current = m;
      // começa onde a pessoa estava da última vez; sem isso, nos dates; sem dates, no Brasil
      if (last) m.setView([last.lat, last.lng], CITY_ZOOM);
      else if (points.length) fitAll(false);
      else m.setView(BRAZIL, 4);
      Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(m);
      Lf.control.zoom({ position: "bottomright" }).addTo(m);
      m.on("dragstart", () => (moved.current = true));
      pins.current = Lf.layerGroup().addTo(m);
      if (last) showMe(last);
      setReady(true);
      void goToMe(false);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pins.current = null;
      me.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cria o mapa uma única vez
  }, []);

  // pinos: redesenha quando os dates mudam (sem mexer no enquadramento)
  useEffect(() => {
    datesRef.current = dates;
    const Lf = lib.current;
    const group = pins.current;
    if (!ready || !Lf || !group) return;
    group.clearLayers();
    for (const d of pinsOf(dates)) {
      const score = d.couple_avg ?? d.my_score;
      const color = score != null ? scoreTone(Math.round(score)) : "#8a7b74";
      const icon = Lf.divIcon({
        className: "",
        iconSize: [40, 48],
        iconAnchor: [20, 46],
        popupAnchor: [0, -44],
        html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))">
          <div style="width:38px;height:38px;border-radius:50%;background:${color};border:3px solid #fff;display:grid;place-items:center;color:#fff;font:700 14px system-ui">${score != null ? escape(formatScore(score)) : "♥"}</div>
          <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #fff;margin-top:-2px"></div>
        </div>`,
      });
      const marker = Lf.marker([d.lat!, d.lng!], { icon, title: d.place_name });
      const popup = document.createElement("button");
      popup.style.cssText = "all:unset;cursor:pointer;display:block;min-width:140px";
      popup.innerHTML = `<b style="font-size:15px">${escape(d.place_name)}</b><br><span style="color:#8a7b74;font-size:12px">${escape(
        `${formatDate(d.date_on)} · ${categoryInfo(d.category).label}`,
      )}</span><br><span style="color:#8c2f39;font-weight:600;font-size:13px">Ver date →</span>`;
      popup.onclick = () => router.push(`/dates/${d.id}`);
      marker.bindPopup(popup);
      group.addLayer(marker);
    }
  }, [dates, ready, router]);

  const btn =
    "pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-card/95 px-3.5 text-sm font-semibold text-ink shadow-md backdrop-blur active:scale-95";

  return (
    <div className="relative size-full">
      <div ref={el} className="size-full" />
      {ready && (
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex gap-2">
          <button type="button" onClick={() => void goToMe(true)} className={btn} aria-label="Ir para minha localização">
            {locating ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4 text-wine" aria-hidden />}
            Perto de mim
          </button>
          {pinsOf(dates).length > 0 && (
            <button
              type="button"
              onClick={() => {
                moved.current = true;
                fitAll();
              }}
              className={btn}
            >
              <Expand className="size-4 text-wine" aria-hidden />
              Ver todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
