"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Dices, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addPlan, deletePlan } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatWhen } from "@/lib/notify-messages";
import { notify } from "@/lib/push";
import type { Plan, WishItem } from "@/lib/types";
import { Confetti } from "./confetti";
import { PlaceSearch } from "./place-search";
import { useToast } from "./toast";
import { Button, Field, Input, Sheet, TextArea } from "./ui";

/* --------------------------------------------------------- contagem */

/** "hoje às 20h", "amanhã às 19h30", "em 3 dias", "sáb, 15/11 às 20h". */
export function countdown(iso: string, now = new Date()): { text: string; past: boolean; soon: boolean } {
  const when = new Date(iso);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(when) - day(now)) / 86_400_000);
  const hm = `${when.getHours()}h${when.getMinutes() ? String(when.getMinutes()).padStart(2, "0") : ""}`;
  const past = when.getTime() < now.getTime() - 3 * 3600_000; // 3h de tolerância
  if (past) return { text: days === -1 ? "foi ontem" : `foi há ${-days} dias`, past, soon: false };
  if (days <= 0) return { text: `hoje às ${hm}`, past, soon: true };
  if (days === 1) return { text: `amanhã às ${hm}`, past, soon: true };
  if (days < 7) return { text: `em ${days} dias`, past, soon: false };
  return { text: formatWhen(iso, Intl.DateTimeFormat().resolvedOptions().timeZone), past, soon: false };
}

/** Próximo sábado às 20h, no formato do input datetime-local. */
function defaultWhen() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(20, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T20:00`;
}

/* ------------------------------------------------------------ modal */

/* ------------------------------------------------------- marcar date */

export function PlanSheet({
  coupleId,
  wish,
  onClose,
}: {
  coupleId: string;
  wish?: WishItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [place, setPlace] = useState(wish?.place_name ?? "");
  const [address, setAddress] = useState<string | null>(wish?.place_address ?? null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    wish?.lat != null && wish?.lng != null ? { lat: wish.lat, lng: wish.lng } : null,
  );
  const [when, setWhen] = useState(defaultWhen);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!place.trim() || !when) return;
    setSaving(true);
    try {
      const planId = await addPlan(coupleId, {
        place_name: place.trim(),
        place_address: address,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        scheduled_at: new Date(when).toISOString(),
        notes: notes.trim() || null,
        wish_id: wish?.id ?? null,
      });
      notify({ type: "plan_created", planId });
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast("Date marcado! 📅");
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
      setSaving(false);
    }
  }

  return (
    <Sheet title="Marcar date" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4 pb-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Onde?</span>
          <PlaceSearch
            value={place}
            autoFocus={!wish}
            onChange={(v) => {
              setPlace(v);
              setCoords(null);
            }}
            onPick={(p) => {
              setPlace(p.name);
              setAddress(p.address);
              setCoords({ lat: p.lat, lng: p.lng });
            }}
          />
          {address && <span className="text-xs text-muted">📍 {address}</span>}
        </div>
        <Field label="Quando?">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </Field>
        <Field label="Observação" hint="Opcional: reserva, roupa, quem leva o vinho…">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} className="min-h-16" />
        </Field>
        <Button type="submit" loading={saving} disabled={!place.trim()}>
          <CalendarCheck className="size-4" aria-hidden /> Marcar
        </Button>
        <p className="text-center text-xs text-muted">Vocês recebem um lembrete no dia e, no dia seguinte, um aviso para registrar o date.</p>
      </form>
    </Sheet>
  );
}

/* -------------------------------------------------------- card do plano */

export function PlanCard({ plan, onDeleted }: { plan: Plan; onDeleted: () => void }) {
  const toast = useToast();
  const when = new Date(plan.scheduled_at);
  const c = countdown(plan.scheduled_at);
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

  async function remove() {
    if (!window.confirm(`Desmarcar o date em “${plan.place_name}”?`)) return;
    try {
      await deletePlan(plan.id);
      onDeleted();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <li className={`flex gap-3 rounded-2xl border p-3.5 ${c.soon ? "border-wine/40 bg-wine/5" : "border-line bg-card"}`}>
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-wine py-2 text-white">
        <span className="text-[11px] font-semibold tracking-wide">{months[when.getMonth()]}</span>
        <span className="font-serif text-2xl leading-none">{when.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-lg leading-tight">{plan.place_name}</p>
        <p className={`text-sm ${c.past ? "text-muted" : "font-medium text-wine"}`}>{c.text}</p>
        {plan.notes && <p className="mt-0.5 text-xs text-muted">{plan.notes}</p>}
        {(c.past || c.soon) && (
          <Link href={`/dates/new?plan=${plan.id}`} className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-wine px-3 text-sm font-semibold text-white">
            {c.past ? "Como foi? Registrar" : "Registrar date"}
          </Link>
        )}
      </div>
      <button onClick={remove} aria-label={`Desmarcar ${plan.place_name}`} className="grid size-9 shrink-0 place-items-center text-muted">
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

/* ------------------------------------------------------------ roleta */

export function Roulette({
  wishes,
  onClose,
  onPlan,
}: {
  wishes: WishItem[];
  onClose: () => void;
  onPlan: (w: WishItem) => void;
}) {
  const [index, setIndex] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WishItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function spin() {
    if (wishes.length < 2) return;
    setWinner(null);
    setSpinning(true);
    const target = Math.floor(Math.random() * wishes.length);
    // passos que desaceleram até parar no sorteado
    const steps = wishes.length * 3 + ((target - index + wishes.length) % wishes.length);
    let i = 0;
    let cur = index;
    const tick = () => {
      cur = (cur + 1) % wishes.length;
      setIndex(cur);
      navigator.vibrate?.(4);
      i++;
      if (i >= steps) {
        setSpinning(false);
        setWinner(wishes[cur]);
        navigator.vibrate?.([30, 40, 60]);
        return;
      }
      const progress = i / steps;
      timer.current = setTimeout(tick, 40 + 260 * progress ** 3);
    };
    tick();
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Sheet title="Sortear o próximo date" onClose={onClose}>
      <div className="pb-6">
        <div className="relative mx-auto mb-5 flex h-44 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#8c2f39] to-[#e0796b] px-6 text-center text-white">
          <span className="absolute left-4 top-3 text-2xl" aria-hidden>
            🎲
          </span>
          <p key={index} className={`font-serif text-3xl leading-tight ${spinning ? "" : "animate-pop"}`}>
            {wishes[index]?.place_name}
          </p>
        </div>
        {winner ? (
          <>
            <Confetti count={30} />
            <p className="mb-4 text-center text-muted">
              O destino escolheu <b className="text-ink">{winner.place_name}</b>! 💛
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={spin}>
                Sortear de novo
              </Button>
              <Button className="flex-1" onClick={() => onPlan(winner)}>
                <CalendarCheck className="size-4" aria-hidden /> Marcar
              </Button>
            </div>
          </>
        ) : (
          <Button className="w-full" loading={spinning} onClick={spin}>
            <Dices className="size-5" aria-hidden /> {spinning ? "Sorteando…" : "Girar"}
          </Button>
        )}
        <p className="mt-3 text-center text-xs text-muted">Sorteia entre os {wishes.length} lugares da lista “Queremos ir”.</p>
      </div>
    </Sheet>
  );
}
