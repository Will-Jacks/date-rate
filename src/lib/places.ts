/**
 * Busca de lugares com o Photon (OpenStreetMap), gratuito e sem chave.
 * https://photon.komoot.io — usamos com debounce e poucos resultados.
 */
import type { Category } from "./categories";
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
