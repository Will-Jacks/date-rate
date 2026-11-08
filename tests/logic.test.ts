import { describe, expect, it } from "vitest";
import { compareScores } from "@/lib/compare";
import { formatCost, formatDate, formatScore } from "@/lib/format";
import { achievements, monthSpending, normalizePlace, onThisDay, retro, visitsOf, weeklyStreak } from "@/lib/insights";
import { buildMessage } from "@/lib/notify-messages";
import { guessCategory, guessCategoryFromGoogle } from "@/lib/places";
import type { DateItem } from "@/lib/types";

let seq = 0;
function date(p: Partial<DateItem>): DateItem {
  seq++;
  return {
    id: `d${seq}`,
    created_by: "a",
    place_name: `Lugar ${seq}`,
    place_address: null,
    date_on: "2026-01-01",
    category: "jantar",
    cost: null,
    cover_path: null,
    favorite: false,
    created_at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}Z`,
    quote: null,
    tags: [],
    lat: null,
    lng: null,
    my_score: null,
    my_comment: null,
    my_criteria: null,
    partner_rated: false,
    partner_score: null,
    partner_comment: null,
    partner_criteria: null,
    couple_avg: null,
    comments_count: 0,
    ...p,
  };
}
const rated = (mine: number, partner: number, p: Partial<DateItem> = {}) =>
  date({ my_score: mine, partner_score: partner, partner_rated: true, couple_avg: (mine + partner) / 2, ...p });

describe("formatação", () => {
  it("datas, notas e reais em pt-BR", () => {
    expect(formatDate("2026-11-02")).toBe("02 nov 2026");
    expect(formatScore(8.5)).toBe("8,5");
    expect(formatScore(null)).toBe("–");
    expect(formatCost(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
});

describe("frases da revelação", () => {
  const v = (a: number, b: number) => compareScores({ mine: a, partner: b, partnerName: "Bia", seed: "x" });
  it("casos especiais vêm antes da diferença", () => {
    expect(v(10, 10).emoji).toBe("🏆");
    expect(v(2, 3).emoji).toBe("😅");
  });
  it("faixas por diferença e quem gostou mais", () => {
    expect(v(7, 7).emoji).toBe("🎯");
    expect(v(8, 7)).toMatchObject({ emoji: "💞", detail: "Você gostou mais, por 1 ponto." });
    expect(v(5, 8).detail).toBe("Bia gostou mais: 3 pontos de diferença.");
    expect(v(4, 9).emoji).toBe("👀");
    expect(v(2, 9).emoji).toBe("😂");
  });
  it("a mesma data sempre mostra a mesma variação", () => {
    expect(compareScores({ mine: 7, partner: 7, partnerName: "B", seed: "abc" }).title).toBe(
      compareScores({ mine: 7, partner: 7, partnerName: "B", seed: "abc" }).title,
    );
  });
});

describe("insights", () => {
  it("normaliza nomes de lugares", () => {
    expect(normalizePlace("  Café  Mangai! ")).toBe("cafe mangai");
  });

  it("sequência semanal (a semana atual vazia não quebra)", () => {
    const today = new Date(2026, 10, 12); // qua, 12/11/2026
    const list = [date({ date_on: "2026-11-03" }), date({ date_on: "2026-10-28" }), date({ date_on: "2026-10-20" }), date({ date_on: "2026-09-01" })];
    expect(weeklyStreak(list, today)).toEqual({ current: 3, best: 3 });
    expect(weeklyStreak([], today)).toEqual({ current: 0, best: 0 });
  });

  it("gasto do mês", () => {
    const list = [date({ date_on: "2026-11-02", cost: 100 }), date({ date_on: "2026-11-20", cost: 50.5 }), date({ date_on: "2026-10-30", cost: 999 })];
    expect(monthSpending(list, new Date(2026, 10, 25))).toEqual({ total: 150.5, count: 2 });
  });

  it("revisitas pelo nome normalizado, em ordem", () => {
    const a = date({ place_name: "Mangai", date_on: "2026-05-01" });
    const b = date({ place_name: "mangai ", date_on: "2026-01-01" });
    const c = date({ place_name: "Outro" });
    expect(visitsOf(a, [a, b, c]).map((d) => d.id)).toEqual([b.id, a.id]);
  });

  it("num dia como hoje (só anos anteriores)", () => {
    const list = [date({ date_on: "2025-11-08" }), date({ date_on: "2026-11-08" }), date({ date_on: "2024-11-08" })];
    expect(onThisDay(list, new Date(2026, 10, 8)).map((d) => d.yearsAgo)).toEqual([1, 2]);
  });

  it("medalhas", () => {
    const list = [rated(7, 7), rated(8, 8, { category: "viagem" }), rated(9, 8, { category: "cinema" }), rated(2, 9, { cost: 0 })];
    const got = Object.fromEntries(achievements(list, new Date(2026, 0, 2)).map((a) => [a.id, a]));
    expect(got.first.done).toBe(true);
    expect(got.match.done).toBe(true);
    expect(got.tune3.done).toBe(true);
    expect(got.debate.done).toBe(true);
    expect(got.free.done).toBe(true);
    expect(got.ten).toMatchObject({ done: false, progress: 4, target: 10 });
  });

  it("retrospectiva do ano", () => {
    const list = [
      rated(10, 9, { place_name: "Top", date_on: "2026-03-10" }),
      rated(2, 9, { place_name: "Briga", date_on: "2026-03-20", cost: 80 }),
      rated(6, 6, { place_name: "Igual", date_on: "2026-07-01", cost: 20 }),
      rated(5, 5, { place_name: "Antigo", date_on: "2025-01-01" }),
    ];
    const r = retro(list, 2026);
    expect(r.count).toBe(3);
    expect(r.spent).toBe(100);
    expect(r.best?.place_name).toBe("Top");
    expect(r.worst?.place_name).toBe("Briga");
    expect(r.closest?.place_name).toBe("Igual");
    expect(r.furthest?.place_name).toBe("Briga");
    expect(r.topMonth).toEqual({ month: "março", count: 2 });
    expect(r.newPlaces).toBe(3);
  });
});

describe("notificações", () => {
  it("texto da nota depende de quem recebe já ter avaliado", () => {
    const base = { type: "rated" as const, actor: "Bia", dateId: "d1", place: "Mangai" };
    expect(buildMessage({ ...base, recipientRated: false })).toMatchObject({
      title: "💌 Bia avaliou Mangai",
      body: "Avalie também para ver a nota.",
      url: "/dates/d1",
    });
    expect(buildMessage({ ...base, recipientRated: true }).body).toContain("reveladas");
  });
  it("comentário é cortado e leva direto para a conversa", () => {
    const m = buildMessage({ type: "commented", actor: "Will", dateId: "d1", place: "X", text: "a".repeat(200) });
    expect(m.body.length).toBeLessThanOrEqual(90);
    expect(m.url).toBe("/dates/d1#conversa");
  });
});

describe("busca de lugares", () => {
  it("sugere o tipo de date pelo tipo do lugar", () => {
    expect(guessCategory("amenity", "restaurant")).toBe("jantar");
    expect(guessCategory("amenity", "cinema")).toBe("cinema");
    expect(guessCategory("leisure", "park")).toBe("passeio");
    expect(guessCategory("shop", "shoes")).toBeUndefined();
    expect(guessCategoryFromGoogle("brazilian_restaurant")).toBe("jantar");
    expect(guessCategoryFromGoogle("night_club")).toBe("bar");
    expect(guessCategoryFromGoogle("movie_theater")).toBe("cinema");
    expect(guessCategoryFromGoogle("car_wash")).toBeUndefined();
  });
});
