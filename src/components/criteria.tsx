"use client";

import type { Criteria } from "@/lib/types";

export const CRITERIA = [
  { key: "food", label: "Comida", emoji: "🍽️" },
  { key: "ambience", label: "Ambiente", emoji: "🕯️" },
  { key: "price", label: "Preço", emoji: "💸" },
  { key: "vibe", label: "Vibe", emoji: "✨" },
] as const;

export function hasCriteria(c: Criteria | null | undefined): c is Criteria {
  return !!c && Object.values(c).some((v) => v != null);
}

/** Notas opcionais por critério: toque no número; toque de novo para limpar. */
export function CriteriaInput({ value, onChange }: { value: Criteria; onChange: (c: Criteria) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {CRITERIA.map(({ key, label, emoji }) => (
        <div key={key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>
              {emoji} {label}
            </span>
            <span className="font-semibold text-wine">{value[key] ?? "–"}</span>
          </div>
          <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label={`${label}, de 1 a 10`}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const on = value[key] != null && n <= value[key]!;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={value[key] === n}
                  aria-label={String(n)}
                  onClick={() => onChange({ ...value, [key]: value[key] === n ? undefined : n })}
                  className={`h-7 rounded-md transition-colors ${on ? "bg-wine" : "bg-line"}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Radar com os critérios dos dois (SVG puro, cores do tema). */
export function CriteriaRadar({
  mine,
  partner,
  myName,
  partnerName,
}: {
  mine: Criteria | null;
  partner: Criteria | null;
  myName: string;
  partnerName: string;
}) {
  // margem lateral maior para os rótulos ("Ambiente") não cortarem
  const size = 280;
  const c = size / 2;
  const r = 80;
  const n = CRITERIA.length;
  const point = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * (r * v) / 10, c + Math.sin(a) * (r * v) / 10] as const;
  };
  const poly = (crit: Criteria | null) =>
    crit ? CRITERIA.map((k, i) => point(i, crit[k.key] ?? 0).join(",")).join(" ") : null;

  const minePoly = poly(hasCriteria(mine) ? mine : null);
  const partnerPoly = poly(hasCriteria(partner) ? partner : null);

  return (
    <figure className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-72" role="img" aria-label="Notas por critério">
        {[2.5, 5, 7.5, 10].map((v) => (
          <polygon key={v} points={CRITERIA.map((_, i) => point(i, v).join(",")).join(" ")} fill="none" stroke="var(--line)" strokeWidth={1} />
        ))}
        {CRITERIA.map((k, i) => {
          const [x, y] = point(i, 10);
          const [lx, ly] = point(i, 12.6);
          return (
            <g key={k.key}>
              <line x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--muted)">
                {k.emoji} {k.label}
              </text>
            </g>
          );
        })}
        {partnerPoly && <polygon points={partnerPoly} fill="var(--coral)" fillOpacity={0.25} stroke="var(--coral)" strokeWidth={2} />}
        {minePoly && <polygon points={minePoly} fill="var(--wine)" fillOpacity={0.22} stroke="var(--wine)" strokeWidth={2} />}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-muted">
        {minePoly && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-wine" /> {myName}
          </span>
        )}
        {partnerPoly && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-coral" /> {partnerName}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
