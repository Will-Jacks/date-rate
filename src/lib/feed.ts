/**
 * Filtros do perfil (grade) guardados na URL, para a rolagem contínua
 * mostrar os mesmos dates, na mesma ordem.
 */
import { normalizePlace } from "./insights";
import type { DateItem } from "./types";

export type Filter = "todos" | "pendentes" | "favoritos";
export type Sort = "recentes" | "antigos" | "melhores" | "piores";

export const SORTS: [Sort, string][] = [
  ["recentes", "Mais recentes"],
  ["antigos", "Mais antigos"],
  ["melhores", "Maior nota"],
  ["piores", "Menor nota"],
];

export type FeedParams = { filter: Filter; sort: Sort; query: string; tag: string | null };

export function readFeedParams(sp: { get(k: string): string | null }): FeedParams {
  const f = sp.get("f");
  const s = sp.get("s");
  return {
    filter: f === "pendentes" || f === "favoritos" ? f : "todos",
    sort: SORTS.some(([v]) => v === s) ? (s as Sort) : "recentes",
    query: sp.get("q") ?? "",
    tag: sp.get("tag"),
  };
}

/** Query string sem os valores padrão. */
export function feedSearch(p: FeedParams, extra: Record<string, string> = {}): string {
  const out = new URLSearchParams(extra);
  if (p.filter !== "todos") out.set("f", p.filter);
  if (p.sort !== "recentes") out.set("s", p.sort);
  if (p.query) out.set("q", p.query);
  if (p.tag) out.set("tag", p.tag);
  const s = out.toString();
  return s ? `?${s}` : "";
}

const scoreOf = (d: DateItem) => d.couple_avg ?? d.my_score ?? -1;

export function applyFeed(all: DateItem[], p: FeedParams): DateItem[] {
  const q = normalizePlace(p.query);
  const out = all.filter((d) => {
    if (p.filter === "pendentes" && d.my_score != null) return false;
    if (p.filter === "favoritos" && !d.favorite) return false;
    if (p.tag && !d.tags.includes(p.tag)) return false;
    if (q) {
      const hay = normalizePlace([d.place_name, d.place_address, d.quote, d.tags.join(" ")].filter(Boolean).join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const by = {
    recentes: (a: DateItem, b: DateItem) => b.date_on.localeCompare(a.date_on) || b.created_at.localeCompare(a.created_at),
    antigos: (a: DateItem, b: DateItem) => a.date_on.localeCompare(b.date_on) || a.created_at.localeCompare(b.created_at),
    melhores: (a: DateItem, b: DateItem) => scoreOf(b) - scoreOf(a),
    piores: (a: DateItem, b: DateItem) => {
      const x = scoreOf(a) < 0 ? 99 : scoreOf(a);
      const y = scoreOf(b) < 0 ? 99 : scoreOf(b);
      return x - y;
    },
  }[p.sort];
  return [...out].sort(by);
}
