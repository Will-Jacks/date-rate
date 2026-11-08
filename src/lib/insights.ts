/**
 * Cálculos sobre a lista de dates (puro, testável):
 * medalhas, sequência semanal, orçamento, revisitas, "num dia como hoje"
 * e a retrospectiva do ano.
 */
import { categoryInfo } from "./categories";
import type { DateItem } from "./types";

/* ------------------------------------------------------------ utilidades */

/** "Café  Mangai " → "cafe mangai" (para achar o mesmo lugar). */
export function normalizePlace(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Segunda-feira da semana (chave yyyy-mm-dd). */
function weekKey(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const dow = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dow);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

const both = (d: DateItem) => d.my_score != null && d.partner_score != null;
const diffOf = (d: DateItem) => Math.abs((d.my_score ?? 0) - (d.partner_score ?? 0));

/* ------------------------------------------------------------- sequência */

/** Semanas seguidas com pelo menos um date (a semana atual sem date não quebra a sequência). */
export function weeklyStreak(dates: DateItem[], today = new Date()): { current: number; best: number } {
  const weeks = new Set(dates.map((d) => weekKey(parseDay(d.date_on))));
  if (!weeks.size) return { current: 0, best: 0 };

  const step = (key: string, n: number) => {
    const d = parseDay(key);
    d.setDate(d.getDate() + 7 * n);
    return weekKey(d);
  };

  let cursor = weekKey(today);
  if (!weeks.has(cursor)) cursor = step(cursor, -1);
  let current = 0;
  while (weeks.has(cursor)) {
    current++;
    cursor = step(cursor, -1);
  }

  const sorted = [...weeks].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of sorted) {
    run = prev && step(prev, 1) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return { current, best: Math.max(best, current) };
}

/* -------------------------------------------------------------- orçamento */

export function monthSpending(dates: DateItem[], today = new Date()) {
  const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const list = dates.filter((d) => d.date_on.startsWith(prefix));
  return { total: list.reduce((s, d) => s + (d.cost ?? 0), 0), count: list.length };
}

/* --------------------------------------------------------------- revisitas */

/** Outras visitas ao mesmo lugar, da mais antiga para a mais nova. */
export function visitsOf(date: DateItem, dates: DateItem[]): DateItem[] {
  const key = normalizePlace(date.place_name);
  return dates
    .filter((d) => normalizePlace(d.place_name) === key)
    .sort((a, b) => a.date_on.localeCompare(b.date_on) || a.created_at.localeCompare(b.created_at));
}

/* ------------------------------------------------------ num dia como hoje */

export function onThisDay(dates: DateItem[], today = new Date()): (DateItem & { yearsAgo: number })[] {
  const md = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dates
    .filter((d) => d.date_on.slice(5) === md && Number(d.date_on.slice(0, 4)) < today.getFullYear())
    .map((d) => ({ ...d, yearsAgo: today.getFullYear() - Number(d.date_on.slice(0, 4)) }))
    .sort((a, b) => a.yearsAgo - b.yearsAgo);
}

/* --------------------------------------------------------------- medalhas */

export type Achievement = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  done: boolean;
};

export function achievements(dates: DateItem[], today = new Date()): Achievement[] {
  const places = new Set(dates.map((d) => normalizePlace(d.place_name)));
  const categories = new Set(dates.map((d) => d.category));
  const rated = dates.filter(both);
  const travels = dates.filter((d) => d.category === "viagem").length;
  const placeCounts = new Map<string, number>();
  dates.forEach((d) => placeCounts.set(normalizePlace(d.place_name), (placeCounts.get(normalizePlace(d.place_name)) ?? 0) + 1));
  const maxVisits = Math.max(0, ...placeCounts.values());

  // maior sequência de dates seguidos (em ordem) com notas a até 1 ponto de distância
  const chrono = [...rated].sort((a, b) => a.date_on.localeCompare(b.date_on));
  let tune = 0;
  let bestTune = 0;
  for (const d of chrono) {
    tune = diffOf(d) <= 1 ? tune + 1 : 0;
    bestTune = Math.max(bestTune, tune);
  }

  const streak = weeklyStreak(dates, today).best;
  const make = (a: Omit<Achievement, "done" | "progress"> & { progress: number }): Achievement => ({
    ...a,
    progress: Math.min(a.progress, a.target),
    done: a.progress >= a.target,
  });

  return [
    make({ id: "first", emoji: "🌱", title: "Primeiro date", description: "Registrar o primeiro date", progress: dates.length, target: 1 }),
    make({ id: "ten", emoji: "🔟", title: "Dez dates", description: "Registrar 10 dates", progress: dates.length, target: 10 }),
    make({ id: "quarter", emoji: "🥂", title: "Bodas de papel", description: "Registrar 25 dates", progress: dates.length, target: 25 }),
    make({ id: "explorer", emoji: "🧭", title: "Exploradores", description: "Conhecer 10 lugares diferentes", progress: places.size, target: 10 }),
    make({ id: "variety", emoji: "🎨", title: "Variedade", description: "Ter dates de 5 tipos diferentes", progress: categories.size, target: 5 }),
    make({ id: "match", emoji: "🎯", title: "Sintonia", description: "Dar exatamente a mesma nota", progress: rated.some((d) => diffOf(d) === 0) ? 1 : 0, target: 1 }),
    make({ id: "tune3", emoji: "💞", title: "Almas gêmeas", description: "3 dates seguidos com notas a até 1 ponto", progress: bestTune, target: 3 }),
    make({ id: "perfect", emoji: "🏆", title: "Nota máxima", description: "Os dois darem 10", progress: rated.some((d) => d.my_score === 10 && d.partner_score === 10) ? 1 : 0, target: 1 }),
    make({ id: "debate", emoji: "🔥", title: "Debate acalorado", description: "Discordar por 5 pontos ou mais", progress: rated.some((d) => diffOf(d) >= 5) ? 1 : 0, target: 1 }),
    make({ id: "travel", emoji: "✈️", title: "Viajantes", description: "Fazer 3 viagens juntos", progress: travels, target: 3 }),
    make({ id: "regulars", emoji: "🔁", title: "Clientes da casa", description: "Voltar 3 vezes ao mesmo lugar", progress: maxVisits, target: 3 }),
    make({ id: "free", emoji: "🪙", title: "Melhor coisa da vida é de graça", description: "Um date que não custou nada", progress: dates.some((d) => d.cost === 0) ? 1 : 0, target: 1 }),
    make({ id: "streak4", emoji: "📆", title: "Um mês sem falhar", description: "4 semanas seguidas com date", progress: streak, target: 4 }),
    make({ id: "talkers", emoji: "💬", title: "Papo bom", description: "Comentar em 5 dates", progress: dates.filter((d) => d.comments_count > 0).length, target: 5 }),
  ];
}

/* ---------------------------------------------------------- retrospectiva */

export type Retro = {
  year: number;
  count: number;
  spent: number;
  avg: number | null;
  best: DateItem | null;
  worst: DateItem | null;
  closest: DateItem | null;
  furthest: DateItem | null;
  topCategory: { label: string; count: number } | null;
  topMonth: { month: string; count: number } | null;
  newPlaces: number;
  favorites: number;
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function retroYears(dates: DateItem[]): number[] {
  return [...new Set(dates.map((d) => Number(d.date_on.slice(0, 4))))].sort((a, b) => b - a);
}

export function retro(dates: DateItem[], year: number): Retro {
  const list = dates.filter((d) => d.date_on.startsWith(`${year}-`));
  const rated = list.filter((d) => d.couple_avg != null);
  const byAvg = [...rated].sort((a, b) => (b.couple_avg ?? 0) - (a.couple_avg ?? 0));
  const byDiff = [...list.filter(both)].sort((a, b) => diffOf(a) - diffOf(b));

  const cats = new Map<string, number>();
  const months = new Map<number, number>();
  list.forEach((d) => {
    cats.set(d.category, (cats.get(d.category) ?? 0) + 1);
    const m = Number(d.date_on.slice(5, 7)) - 1;
    months.set(m, (months.get(m) ?? 0) + 1);
  });
  const topCat = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
  const topMonth = [...months.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

  const before = new Set(dates.filter((d) => d.date_on < `${year}-01-01`).map((d) => normalizePlace(d.place_name)));
  const newPlaces = new Set(list.map((d) => normalizePlace(d.place_name)).filter((p) => !before.has(p))).size;

  return {
    year,
    count: list.length,
    spent: list.reduce((s, d) => s + (d.cost ?? 0), 0),
    avg: rated.length ? rated.reduce((s, d) => s + (d.couple_avg ?? 0), 0) / rated.length : null,
    best: byAvg[0] ?? null,
    worst: byAvg.length > 1 ? byAvg[byAvg.length - 1] : null,
    closest: byDiff[0] ?? null,
    furthest: byDiff.length > 1 && diffOf(byDiff[byDiff.length - 1]) > 0 ? byDiff[byDiff.length - 1] : null,
    topCategory: topCat ? { label: categoryInfo(topCat[0]).label, count: topCat[1] } : null,
    topMonth: topMonth ? { month: MONTHS[topMonth[0]], count: topMonth[1] } : null,
    newPlaces,
    favorites: list.filter((d) => d.favorite).length,
  };
}
