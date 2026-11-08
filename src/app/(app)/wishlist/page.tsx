"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Dices, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PlaceSearch } from "@/components/place-search";
import { PlanCard, PlanSheet, Roulette } from "@/components/plans";
import { useToast } from "@/components/toast";
import { Button, EmptyState, ErrorState, Input, PageHeader, Spinner } from "@/components/ui";
import { addWish, deleteWish } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, useCurrentMe, usePlans, useWishlist } from "@/lib/hooks";
import { notify } from "@/lib/push";
import type { PlacePick, WishItem } from "@/lib/types";

export default function PlansPage() {
  const me = useCurrentMe();
  const wishlist = useWishlist();
  const plans = usePlans();
  const qc = useQueryClient();
  const toast = useToast();
  const [place, setPlace] = useState("");
  const [picked, setPicked] = useState<PlacePick | null>(null);
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [sheet, setSheet] = useState<{ wish: WishItem | null } | null>(null);
  const [roulette, setRoulette] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: keys.wishlist });
  const nameOf = (uid: string) => (uid === me.userId ? "você" : (me.partner?.display_name ?? "seu par"));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!place.trim()) return;
    setAdding(true);
    try {
      const wishId = await addWish(me.couple.id, place.trim(), notes.trim() || null, picked);
      notify({ type: "wish_added", wishId });
      setPlace("");
      setPicked(null);
      setNotes("");
      refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setAdding(false);
    }
  }

  async function remove(item: WishItem) {
    if (!window.confirm(`Tirar “${item.place_name}” da lista?`)) return;
    try {
      await deleteWish(item.id);
      refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  const upcoming = (plans.data ?? []).filter((p) => !p.done_date_id);
  const todo = wishlist.data?.filter((w) => !w.done_date_id) ?? [];
  const done = wishlist.data?.filter((w) => w.done_date_id) ?? [];
  const goneFor = (w: WishItem) => new URLSearchParams({ wish: w.id, place: w.place_name }).toString();

  return (
    <>
      <PageHeader title="Planos" />

      {/* ---------------- dates marcados */}
      <section id="planos" className="scroll-mt-20 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl">Próximos dates</h2>
          <button onClick={() => setSheet({ wish: null })} className="flex min-h-10 items-center gap-1.5 text-sm font-semibold text-wine">
            <CalendarPlus className="size-4" aria-hidden /> Marcar date
          </button>
        </div>
        {plans.isPending ? (
          <div className="skeleton h-20 rounded-2xl" />
        ) : upcoming.length ? (
          <ul className="flex flex-col gap-2">
            {upcoming.map((p) => (
              <PlanCard key={p.id} plan={p} onDeleted={() => qc.invalidateQueries({ queryKey: ["plans"] })} />
            ))}
          </ul>
        ) : (
          <button
            onClick={() => setSheet({ wish: null })}
            className="w-full rounded-2xl border-2 border-dashed border-line p-5 text-center text-sm text-muted"
          >
            Nenhum date marcado. Toque para marcar o próximo 📅
          </button>
        )}
      </section>

      {/* ---------------- roleta */}
      <section className="mt-6 px-4">
        <button
          onClick={() => setRoulette(true)}
          disabled={todo.length < 2}
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-[#8c2f39] to-[#e0796b] p-4 text-left text-white shadow-[0_8px_24px_rgba(140,47,57,.25)] active:scale-[.99] disabled:opacity-50"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Dices className="size-7" aria-hidden />
          </span>
          <span>
            <span className="block font-serif text-xl leading-tight">Onde a gente vai?</span>
            <span className="text-sm text-white/85">
              {todo.length < 2 ? "Adicione 2 lugares à lista para sortear" : `Sortear entre ${todo.length} lugares da lista`}
            </span>
          </span>
        </button>
      </section>

      {/* ---------------- queremos ir */}
      <section className="mt-8">
        <h2 className="mb-3 px-4 font-serif text-xl">Queremos ir</h2>
        <form onSubmit={add} className="mx-4 mb-4 flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
          <PlaceSearch
            value={place}
            placeholder="Lugar que vocês querem conhecer"
            onChange={(v) => {
              setPlace(v);
              setPicked(null);
            }}
            onPick={(p) => {
              setPlace(p.name);
              setPicked(p);
            }}
          />
          {picked?.address && <span className="px-1 text-xs text-muted">📍 {picked.address}</span>}
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observação (opcional)" maxLength={300} />
          <Button type="submit" loading={adding} disabled={!place.trim()}>
            Adicionar à lista
          </Button>
        </form>

        {wishlist.isPending ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : wishlist.isError ? (
          <ErrorState error={wishlist.error} onRetry={() => wishlist.refetch()} />
        ) : !wishlist.data.length ? (
          <EmptyState art="list" title="Lista vazia" text="Anotem aqui os lugares que querem conhecer juntos." />
        ) : (
          <div className="flex flex-col gap-6 px-4">
            {!!todo.length && (
              <ul className="flex flex-col gap-2">
                {todo.map((w) => (
                  <li key={w.id} className="rounded-2xl border border-line bg-card p-4">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-lg">{w.place_name}</p>
                        {w.place_address && <p className="truncate text-xs text-muted">📍 {w.place_address}</p>}
                        {w.notes && <p className="text-sm text-muted">{w.notes}</p>}
                        <p className="mt-0.5 text-xs text-muted">Adicionado por {nameOf(w.added_by)}</p>
                      </div>
                      <button onClick={() => remove(w)} aria-label={`Remover ${w.place_name}`} className="grid size-9 shrink-0 place-items-center text-muted">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setSheet({ wish: w })}
                        className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-semibold"
                      >
                        <CalendarPlus className="size-4" aria-hidden /> Marcar
                      </button>
                      <Link
                        href={`/dates/new?${goneFor(w)}`}
                        className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-wine text-sm font-semibold text-white"
                      >
                        <Check className="size-4" aria-hidden /> Fomos!
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!!done.length && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-muted">Já fomos</h3>
                <ul className="flex flex-col gap-2">
                  {done.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/dates/${w.done_date_id}`}
                        className="flex items-center gap-2 rounded-2xl border border-line/70 bg-card/60 p-4 text-muted"
                      >
                        <Check className="size-4 text-wine" aria-hidden />
                        <span className="flex-1 truncate line-through decoration-wine/40">{w.place_name}</span>
                        <span className="text-xs text-wine">ver date</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </section>

      {sheet && <PlanSheet coupleId={me.couple.id} wish={sheet.wish} onClose={() => setSheet(null)} />}
      {roulette && (
        <Roulette
          wishes={todo}
          onClose={() => setRoulette(false)}
          onPlan={(w) => {
            setRoulette(false);
            setSheet({ wish: w });
          }}
        />
      )}
    </>
  );
}
