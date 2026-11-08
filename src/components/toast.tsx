"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Kind = "ok" | "error" | "news";
type Toast = { id: number; text: string; kind: Kind; href?: string };
type Show = (text: string, kind?: Kind, href?: string) => void;

const ToastContext = createContext<Show>(() => {});

const STYLES: Record<Kind, string> = {
  ok: "bg-wine text-white",
  error: "bg-ink text-white",
  news: "bg-card text-ink border border-line",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<Show>(
    (text, kind = "ok", href) => {
      const id = ++nextId.current;
      setToasts((t) => [...t, { id, text, kind, href }]);
      setTimeout(() => dismiss(id), kind === "news" ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-[480px] flex-col gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
      >
        {toasts.map((t) => {
          const cls = `animate-slide-down rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${STYLES[t.kind]}`;
          return t.href ? (
            <Link key={t.id} href={t.href} onClick={() => dismiss(t.id)} className={`pointer-events-auto block ${cls}`}>
              {t.text}
            </Link>
          ) : (
            <div key={t.id} className={cls}>
              {t.text}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
