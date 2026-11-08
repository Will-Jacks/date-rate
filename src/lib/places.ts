/**
 * Busca de lugares com o Photon (OpenStreetMap), gratuito e sem chave.
 * https://photon.komoot.io — usamos com debounce e poucos resultados.
 */
import type { Category } from "./categories";
import { supabase } from "./supabase";
import type { PlacePick } from "./types";

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

/** Tipo do date sugerido a partir do tipo do lugar no OpenStreetMap. */
export function guessCategory(osmKey?: string, osmValue?: string): Category | undefined {
  const v = osmValue ?? "";
  if (["restaurant", "fast_food", "food_court"].includes(v)) return "jantar";
  if (["cafe", "bakery", "ice_cream", "confectionery"].includes(v)) return "cafe";
  if (["bar", "pub", "biergarten", "nightclub"].includes(v)) return "bar";
  if (v === "cinema") return "cinema";
  if (["theatre", "arts_centre", "concert_hall", "stadium", "music_venue"].includes(v)) return "show";
  if (["park", "garden", "beach", "viewpoint", "zoo", "aquarium", "museum", "gallery", "attraction", "mall"].includes(v))
    return "passeio";
  if (osmKey === "place" && ["city", "town", "village", "island"].includes(v)) return "viagem";
  if (["hotel", "resort", "guest_house"].includes(v)) return "viagem";
  return undefined;
}

/** Tipo do date a partir do primaryType do Google Places. */
export function guessCategoryFromGoogle(t?: string): Category | undefined {
  if (!t) return undefined;
  if (t === "cafe" || t === "bakery" || t === "ice_cream_shop" || t === "coffee_shop" || t.endsWith("dessert_shop")) return "cafe";
  if (t === "bar" || t === "pub" || t === "night_club" || t === "wine_bar") return "bar";
  if (t === "movie_theater") return "cinema";
  if (["performing_arts_theater", "concert_hall", "stadium", "event_venue", "amphitheatre"].includes(t)) return "show";
  if (t === "restaurant" || t.endsWith("_restaurant") || t === "meal_takeaway" || t === "steak_house" || t === "pizza_place") return "jantar";
  if (["park", "tourist_attraction", "museum", "art_gallery", "shopping_mall", "zoo", "aquarium", "beach", "amusement_park"].includes(t)) return "passeio";
  if (["lodging", "hotel", "resort_hotel", "inn"].includes(t)) return "viagem";
  return undefined;
}

// sem chave do Google no servidor: lembra para não tentar de novo a cada letra
let googleOff = false;

async function searchGoogle(q: string, near: { lat: number; lng: number } | null | undefined, limit: number, signal?: AbortSignal) {
  if (googleOff) return null;
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch("/api/places", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ q, lat: near?.lat, lng: near?.lng, limit }),
  });
  if (res.status === 501) {
    googleOff = true;
    return null;
  }
  if (!res.ok) return null;
  return ((await res.json()) as { places: PlacePick[] }).places;
}

export function formatAddress(p: PhotonFeature["properties"]): string | null {
  const street = [p.street, p.housenumber].filter(Boolean).join(", ");
  const parts = [street, p.district, p.city, p.state].filter(Boolean);
  // evita repetir o próprio nome do lugar como endereço
  const out = Array.from(new Set(parts)).filter((x) => x !== p.name);
  return out.length ? out.join(" · ") : p.country ?? null;
}

export function toPick(f: PhotonFeature): PlacePick {
  const [lng, lat] = f.geometry.coordinates;
  const p = f.properties;
  return {
    name: p.name ?? [p.street, p.city].filter(Boolean).join(", ") ?? "Lugar",
    address: formatAddress(p),
    lat,
    lng,
    category: guessCategory(p.osm_key, p.osm_value),
  };
}

export async function searchPlaces(
  query: string,
  opts: { near?: { lat: number; lng: number } | null; signal?: AbortSignal; limit?: number } = {},
): Promise<PlacePick[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // Google Places (mais completo); se não estiver configurado ou falhar, OpenStreetMap
  try {
    const g = await searchGoogle(q, opts.near, opts.limit ?? 6, opts.signal);
    if (g) return g;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
  }
  const params = new URLSearchParams({ q, limit: String(opts.limit ?? 6), lang: "default" });
  if (opts.near) {
    params.set("lat", String(opts.near.lat));
    params.set("lon", String(opts.near.lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: opts.signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).filter((f) => f.properties.name).map(toPick);
}

/** Melhor palpite de coordenadas para um nome + endereço (usado pelo mapa). */
export async function geocode(name: string, address: string | null, near?: { lat: number; lng: number } | null) {
  const results = await searchPlaces([name, address].filter(Boolean).join(", "), { near, limit: 1 });
  return results[0] ?? null;
}
