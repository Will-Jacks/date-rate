"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Flame, Pencil, Wallet } from "lucide-react";
import { useState } from "react";
import { setBudget } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatCost } from "@/lib/format";
import { keys } from "@/lib/hooks";
import { achievements, monthSpending, weeklyStreak } from "@/lib/insights";
import type { DateItem, Me } from "@/lib/types";
import { useToast } from "./toast";
import { Button, Input } from "./ui";

/** Sequência de semanas seguidas com date. */
export function StreakCard({ dates }: { dates: DateItem[] }) {
  const { current, best } = weeklyStreak(dates);
  return (
    <section className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4">
      <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${current ? "bg-gradient-to-br from-[#e0796b] to-[#8c2f39] text-white" : "bg-line text-muted"}`}>
        <Flame className="size-7" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-serif text-2xl leading-tight">
          {current} {current === 1 ? "semana seguida" : "semanas seguidas"}
        </p>
        <p className="text-sm text-muted">
          {current ? "com pelo menos um date. Não deixem a chama apagar! 🔥" : "Marquem um date esta semana para começar uma sequência."}
          {best > current ? ` Recorde: ${best}.` : ""}
        </p>
      </div>
    </section>
  );
}

/** Orçamento do mês: gasto atual × limite definido pelo casal. */
export function BudgetCard({ dates, me }: { dates: DateItem[]; me: Me & { couple: NonNullable<Me["couple"]> } }) {
  const qc = useQueryClient();
  const toast = useToast();
  const budget = me.couple.monthly_budget;
  const { total, count } = monthSpending(dates);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budget != null ? String(budget).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);

  const pct = budget ? Math.min(100, (total / budget) * 100) : 0;
  const over = budget != null && total > budget;
  const month = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const title = `Orçamento de ${month}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const raw = value.trim();
    const n = raw ? Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw) : null;
    if (n != null && (!Number.isFinite(n) || n < 0)) return toast("Valor inválido.", "error");
    setSaving(true);
    try {
      await setBudget(me.couple.id, n);
      await qc.invalidateQueries({ queryKey: keys.me(me.userId) });
      setEditing(false);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <Wallet className="size-5 text-wine" aria-hidden />
        <h2 className="font-serif text-lg">{title}</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="ml-auto flex items-center gap-1 text-sm font-semibold text-wine">
            <Pencil className="size-3.5" aria-hidden /> {budget != null ? "Editar" : "Definir"}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-3 flex gap-2">
          <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Limite por mês (R$)" autoFocus />
          <Button type="submit" loading={saving}>
            Salvar
          </Button>
        </form>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            <b className={`font-serif text-2xl ${over ? "text-wine" : "text-ink"}`}>{formatCost(total) || "R$ 0,00"}</b>
            {budget != null && <> de {formatCost(budget)}</>} · {count} {count === 1 ? "date" : "dates"}
          </p>
          {budget != null && (
            <>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={`h-full rounded-full transition-all ${over ? "bg-wine" : pct > 80 ? "bg-coral" : "bg-gradient-to-r from-[#b5404c] to-[#e0796b]"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {over ? `Passaram ${formatCost(total - budget)} do limite 😅` : `Ainda dá para gastar ${formatCost(budget - total)} este mês.`}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Grade de medalhas (conquistadas coloridas, as outras com progresso). */
export function Medals({ dates }: { dates: DateItem[] }) {
  const list = achievements(dates);
  const done = list.filter((a) => a.done).length;
  const [open, setOpen] = useState<string | null>(null);
  const sel = list.find((a) => a.id === open);

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-lg">Medalhas</h2>
        <span className="text-sm text-muted">
          {done}/{list.length}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {list.map((a) => (
          <button
            key={a.id}
            onClick={() => setOpen(open === a.id ? null : a.id)}
            aria-pressed={open === a.id}
            className="flex flex-col items-center gap-1"
            aria-label={`${a.title}: ${a.done ? "conquistada" : `${a.progress} de ${a.target}`}`}
          >
            <span
              className={`relative grid size-14 place-items-center rounded-full text-2xl ${
                a.done ? "bg-gradient-to-br from-[#f6b47a] to-[#e0796b] shadow-md" : "bg-line grayscale"
              } ${open === a.id ? "ring-2 ring-wine ring-offset-2 ring-offset-card" : ""}`}
            >
              <span className={a.done ? "" : "opacity-40"}>{a.emoji}</span>
              {!a.done && a.target > 1 && (
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
                  <circle cx="28" cy="28" r="26" fill="none" stroke="var(--wine)" strokeWidth="3" strokeDasharray={`${(a.progress / a.target) * 163} 163`} strokeLinecap="round" />
                </svg>
              )}
            </span>
            <span className={`line-clamp-2 text-center text-[11px] leading-tight ${a.done ? "text-ink" : "text-muted"}`}>{a.title}</span>
          </button>
        ))}
      </div>
      {sel && (
        <p className="animate-slide-down mt-3 rounded-xl bg-cream p-3 text-sm">
          <b>
            {sel.emoji} {sel.title}
          </b>{" "}
          — {sel.description}. {sel.done ? "Conquistada! 🎉" : `Progresso: ${sel.progress}/${sel.target}.`}
        </p>
      )}
    </section>
  );
}
