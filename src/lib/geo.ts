/**
 * Localização atual (navegador). Guardamos a última posição conhecida para
 * abrir o mapa e enviesar a busca de lugares sem pedir o GPS toda hora.
 */
export type LatLng = { lat: number; lng: number };

const KEY = "date-rate:last-location";

export function cachedLocation(): LatLng | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as LatLng | null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch {
    return null;
  }
}

/** Pede a posição atual (o navegador pergunta na primeira vez). Resolve null se negar ou falhar. */
export function locate(timeout = 10_000): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const v = { lat: p.coords.latitude, lng: p.coords.longitude };
        try {
          localStorage.setItem(KEY, JSON.stringify(v));
        } catch {
          /* sem armazenamento: só não fica salvo */
        }
        resolve(v);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout, maximumAge: 10 * 60_000 },
    );
  });
}
