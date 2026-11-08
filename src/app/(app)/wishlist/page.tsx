"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Button, EmptyState, ErrorState, Input, PageHeader, Spinner } from "@/components/ui";
import { addWish, deleteWish } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, useCurrentMe, useWishlist } from "@/lib/hooks";
import type { WishItem } from "@/lib/types";

export default function WishlistPage() {
  const me = useCurrentMe();
  const wishlist = useWishlist();
  const qc = useQueryClient();
  const toast = useToast();
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: keys.wishlist });
  const nameOf = (uid: string) =>
    uid === me.userId ? "você" : (me.partner?.display_name ?? "seu par");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!place.trim()) return;
    setAdding(true);
    try {
      await addWish(me.couple.id, place.trim(), notes.trim() || null);
      setPlace("");
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

  const todo = wishlist.data?.filter((w) => !w.done_date_id) ?? [];
  const done = wishlist.data?.filter((w) => w.done_date_id) ?? [];

  return (
    <>
      <PageHeader title="Queremos ir" />

      <form onSubmit={add} className="mx-4 mb-6 flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lugar que vocês querem conhecer" maxLength={120} />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observação (opcional)" maxLength={300} />
        <Button type="submit" loading={adding} disabled={!place.trim()}>
          Adicionar à lista
        </Button>
      </form>

      {wishlist.isPending ? (
        <div className="grid place-items-center py-16">
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
                <li key={w.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-lg">{w.place_name}</p>
                    {w.notes && <p className="text-sm text-muted">{w.notes}</p>}
                    <p className="mt-0.5 text-xs text-muted">Adicionado por {nameOf(w.added_by)}</p>
                  </div>
                  <Link
                    href={`/dates/new?wish=${w.id}&place=${encodeURIComponent(w.place_name)}`}
                    className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-wine px-3 text-sm font-semibold text-white"
                  >
                    <Check className="size-4" aria-hidden /> Fomos!
                  </Link>
                  <button onClick={() => remove(w)} aria-label={`Remover ${w.place_name}`} className="grid size-10 shrink-0 place-items-center text-muted">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!!done.length && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted">Já fomos</h2>
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
    </>
  );
}
