"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DateCard } from "@/components/date-card";
import { useToast } from "@/components/toast";
import { EmptyState, ErrorState, PageHeader, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useCurrentMe, useDates, useSignedUrls, useToggleFavorite } from "@/lib/hooks";

type Filter = "todos" | "pendentes" | "favoritos";

export default function FeedPage() {
  const me = useCurrentMe();
  const dates = useDates();
  const covers = useSignedUrls(dates.data?.map((d) => d.cover_path) ?? []);
  const favorite = useToggleFavorite();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("todos");

  const partnerName = me.partner?.display_name ?? null;
  const pending = dates.data?.filter((d) => d.my_score == null).length ?? 0;
  const list =
    dates.data?.filter((d) =>
      filter === "pendentes" ? d.my_score == null : filter === "favoritos" ? d.favorite : true,
    ) ?? [];

  return (
    <>
      <PageHeader
        title="Date Rate"
        right={
          <Link
            href="/profile"
            className="flex min-h-11 items-center gap-1.5 rounded-full pl-2 text-[13px] text-muted"
            aria-label="Perfil"
          >
            <span className="max-w-36 truncate">
              {me.profile.display_name}
              {partnerName ? ` & ${partnerName}` : ""}
            </span>
            <UserRound className="size-5" aria-hidden />
          </Link>
        }
      />

      {!!dates.data?.length && (
        <div className="flex gap-2 px-4 pb-3">
          {(
            [
              ["todos", "Todos"],
              ["pendentes", pending ? `Falta sua nota (${pending})` : "Falta sua nota"],
              ["favoritos", "Favoritos"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`min-h-9 rounded-full border px-3.5 text-[13px] font-medium ${
                filter === value ? "border-wine bg-wine text-white" : "border-line bg-card text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {dates.isPending ? (
        <div className="grid place-items-center py-24">
          <Spinner />
        </div>
      ) : dates.isError ? (
        <ErrorState error={dates.error} onRetry={() => dates.refetch()} />
      ) : !dates.data.length ? (
        <EmptyState
          title="Nenhum date ainda"
          text="Toque no + para registrar o primeiro. A capa vira um card aqui no feed."
          action={
            <Link href="/dates/new" className="mt-2 rounded-xl bg-wine px-5 py-3 font-semibold text-white">
              Registrar date
            </Link>
          }
        />
      ) : !list.length ? (
        <EmptyState
          title={filter === "favoritos" ? "Sem favoritos" : "Tudo avaliado!"}
          text={
            filter === "favoritos"
              ? "Toque duas vezes num card para favoritar."
              : "Você já deu nota para todos os dates."
          }
        />
      ) : (
        <main className="flex flex-col gap-[18px] px-4 pt-1">
          {list.map((d) => (
            <DateCard
              key={d.id}
              date={d}
              coverUrl={d.cover_path ? covers.data?.[d.cover_path] : undefined}
              partnerName={partnerName}
              onFavorite={(fav) =>
                favorite.mutate(
                  { id: d.id, favorite: fav },
                  { onError: (e) => toast(errorMessage(e), "error") },
                )
              }
            />
          ))}
        </main>
      )}
    </>
  );
}
