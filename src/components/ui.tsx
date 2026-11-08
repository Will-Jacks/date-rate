"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
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

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      <p className="text-sm text-muted">{text}</p>
      {action}
    </div>
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
