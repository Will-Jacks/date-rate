export const CATEGORIES = [
  { value: "jantar", label: "Jantar", gradient: "linear-gradient(160deg,#f6b47a,#c2554f 55%,#3d1f2b)" },
  { value: "almoco", label: "Almoço", gradient: "linear-gradient(160deg,#f7d58b,#d98a4a 55%,#4a2a17)" },
  { value: "cafe", label: "Café", gradient: "linear-gradient(170deg,#e7c38f,#a2683d 55%,#2e1b12)" },
  { value: "bar", label: "Bar", gradient: "linear-gradient(160deg,#f0a35e,#8c2f39 60%,#1f0f14)" },
  { value: "cinema", label: "Cinema", gradient: "linear-gradient(150deg,#c9a7e0,#6b4a8c 60%,#1e1530)" },
  { value: "passeio", label: "Passeio", gradient: "linear-gradient(160deg,#b9d98f,#5d8a4e 55%,#1d2b17)" },
  { value: "viagem", label: "Viagem", gradient: "linear-gradient(200deg,#7fb7c9,#2f5d73 60%,#14232e)" },
  { value: "em_casa", label: "Em casa", gradient: "linear-gradient(160deg,#f2c6b4,#c27a6b 55%,#3b2220)" },
  { value: "show", label: "Show", gradient: "linear-gradient(150deg,#f08fb1,#8a3a7a 60%,#21102a)" },
  { value: "outro", label: "Outro", gradient: "linear-gradient(160deg,#e0c9b6,#9a7b6a 55%,#2b1d1a)" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

export function categoryInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}
