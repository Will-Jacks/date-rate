import { guessCategoryFromGoogle } from "@/lib/places";
import { adminClient } from "@/lib/server/push";

/**
 * POST /api/places — busca de lugares no Google Places (Text Search, API nova).
 * A chave fica só no servidor; só usuários logados podem buscar.
 * Sem GOOGLE_PLACES_API_KEY responde 501 e o app volta para o OpenStreetMap.
 */
export async function POST(req: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 501 });

  const admin = adminClient();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!admin || !token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { q?: string; lat?: number; lng?: number; limit?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const q = String(body.q ?? "").trim().slice(0, 120);
  if (q.length < 3) return Response.json({ places: [] });
  const near = Number.isFinite(body.lat) && Number.isFinite(body.lng);

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.primaryType",
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: Math.min(Math.max(Number(body.limit) || 6, 1), 10),
      ...(near && { locationBias: { circle: { center: { latitude: body.lat, longitude: body.lng }, radius: 30000 } } }),
    }),
  });
  if (!res.ok) {
    console.error("places", res.status, (await res.text()).slice(0, 300));
    return Response.json({ error: "upstream" }, { status: 502 });
  }
  type GPlace = {
    displayName?: { text?: string };
    formattedAddress?: string;
    shortFormattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
  };
  const json = (await res.json()) as { places?: GPlace[] };
  const places = (json.places ?? [])
    .filter((p) => p.displayName?.text && p.location)
    .map((p) => ({
      name: p.displayName!.text!,
      address: p.shortFormattedAddress ?? p.formattedAddress ?? null,
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      category: guessCategoryFromGoogle(p.primaryType),
    }));
  return Response.json({ places });
}
