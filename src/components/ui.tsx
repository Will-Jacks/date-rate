"use client";

import { LoaderCircle, RefreshCw, X } from "lucide-react";
import { useEffect } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { errorMessage } from "@/lib/errors";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

const VARIANTS = {
  primary: "bg-wine text-white active:bg-wine-dark disabled:opacity-40",
  secondary: "bg-card text-ink border border-line active:bg-cream disabled:opacity-40",
  ghost: "text-wine active:bg-wine/5 disabled:opacity-40",
  danger: "text-wine border border-wine/30 bg-card active:bg-wine/5 disabled:opacity-40",
};

export function Button({ variant = "primary", loading, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <LoaderCircle className={`size-6 animate-spin text-wine ${className}`} aria-label="Carregando" />;
}

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner className="size-8" />
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <p className="text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden /> Tentar novamente
        </Button>
      )}
    </div>
  );
}

export type Illustration = "dates" | "list" | "done" | "favorites";

/** Ilustrações simples em linha, na cor do tema. */
function Art({ kind }: { kind: Illustration }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 120 100" className="h-28 w-32 text-wine" aria-hidden>
      <circle cx="60" cy="52" r="44" fill="currentColor" opacity=".08" />
      {kind === "dates" && (
        <g {...common}>
          <rect x="30" y="22" width="44" height="56" rx="6" transform="rotate(-8 52 50)" opacity=".45" />
          <rect x="44" y="24" width="44" height="56" rx="6" transform="rotate(6 66 52)" fill="var(--card)" />
          <path d="M66 46c-3-5-11-3-9 3 1 4 9 9 9 9s8-5 9-9c2-6-6-8-9-3z" fill="currentColor" stroke="none" />
          <path d="M52 68h26" opacity=".5" />
        </g>
      )}
      {kind === "list" && (
        <g {...common}>
          <rect x="36" y="18" width="48" height="64" rx="6" fill="var(--card)" />
          <path d="M46 36h28M46 48h28M46 60h18" opacity=".55" />
          <path d="M84 70l6 6 12-14" />
          <circle cx="32" cy="30" r="3" fill="currentColor" stroke="none" opacity=".5" />
        </g>
      )}
      {kind === "done" && (
        <g {...common}>
          <circle cx="60" cy="50" r="24" fill="var(--card)" />
          <path d="M49 50l8 8 15-17" />
          <path d="M24 30l4 4M96 28l-4 4M28 76l4-3M94 74l-4-3" opacity=".5" />
        </g>
      )}
      {kind === "favorites" && (
        <g {...common}>
          <path d="M60 78S34 62 34 43c0-9 7-15 14-15 5 0 9 3 12 7 3-4 7-7 12-7 7 0 14 6 14 15 0 19-26 35-26 35z" fill="var(--card)" />
          <path d="M52 48c2 2 4 3 8 3s6-1 8-3" opacity=".6" />
        </g>
      )}
    </svg>
  );
}

export function EmptyState({
  title,
  text,
  action,
  art = "dates",
}: {
  title: string;
  text: string;
  action?: ReactNode;
  art?: Illustration;
}) {
  return (
    <div className="animate-page-fade flex flex-col items-center gap-3 px-8 py-12 text-center">
      <Art kind={art} />
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      <p className="text-sm text-muted">{text}</p>
      {action}
    </div>
  );
}

/** Cards cinza no formato do feed enquanto carrega. */
export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-[18px] px-4 pt-1" aria-label="Carregando" role="status">
      {[0, 1].map((i) => (
        <div key={i} className="skeleton relative aspect-[4/5] overflow-hidden rounded-2xl">
          <div className="absolute bottom-5 left-5 flex flex-col gap-2.5">
            <div className="h-8 w-48 rounded-lg bg-card/50" />
            <div className="h-4 w-28 rounded-md bg-card/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Carregando">
      <div className="skeleton h-[55dvh] min-h-72" />
      <div className="grid grid-cols-2 gap-3 px-4 pt-6">
        <div className="skeleton h-36 rounded-2xl" />
        <div className="skeleton h-36 rounded-2xl" />
      </div>
    </div>
  );
}

/** Círculo com as iniciais do nome. */
export function Avatar({
  name,
  tone = "wine",
  big = false,
  className = "",
}: {
  name: string;
  tone?: "wine" | "coral";
  big?: boolean;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${big ? "size-11 text-sm" : "size-7 text-[11px]"} ${
        tone === "wine" ? "bg-wine" : "bg-coral"
      } ${className}`}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

const fieldCls =
  "w-full rounded-xl border border-line bg-card px-4 py-3 text-[16px] text-ink placeholder:text-muted/70 outline-none focus:border-wine focus:ring-2 focus:ring-wine/15";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldCls} min-h-20 resize-none ${props.className ?? ""}`} />;
}

export function PageHeader({ title, left, right }: { title: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-cream/85 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
      {left}
      <h1 className="flex-1 truncate font-serif text-[28px] leading-tight text-wine">{title}</h1>
      {right}
    </header>
  );
}

/** Painel que sobe de baixo (no celular) ou modal centralizado (no computador). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="animate-page-up pb-safe max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-cream px-5 pt-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center rounded-full bg-line/60">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
