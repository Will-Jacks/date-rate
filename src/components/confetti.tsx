"use client";

import { useEffect, useState } from "react";

const COLORS = ["#8c2f39", "#e0796b", "#f6b47a", "#f2c6b4", "#ffffff", "#c4515d"];

/** Chuva de confete leve (CSS puro), some sozinha em ~3s. */
export function Confetti({ count = 46 }: { count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      dur: 1.8 + Math.random() * 1.4,
      delay: Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 120,
      spin: (Math.random() - 0.5) * 900,
      wide: Math.random() > 0.5,
    })),
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), 3600);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              width: p.wide ? 10 : 6,
              "--dur": `${p.dur}s`,
              "--delay": `${p.delay}s`,
              "--drift": `${p.drift}px`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
