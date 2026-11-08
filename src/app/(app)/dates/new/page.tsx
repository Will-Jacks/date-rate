"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DateForm, type DateFormResult } from "@/components/date-form";
import { useToast } from "@/components/toast";
import { FullScreenLoader, PageHeader } from "@/components/ui";
import { createDate, getPlan } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, useCurrentMe, useDates, useInvalidateDates, useWishlist } from "@/lib/hooks";
import { notify } from "@/lib/push";
import type { DateInput } from "@/lib/types";

/** yyyy-mm-dd local de um timestamp */
function localDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function NewDate() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useCurrentMe();
  const toast = useToast();
  const qc = useQueryClient();
  const invalidate = useInvalidateDates();
  const dates = useDates();
  const wishlist = useWishlist();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // vindo de "Queremos ir" (?wish=&place=), de um date marcado (?plan=) ou de "visitar de novo" (?place=&address=)
  const planId = params.get("plan");
  const plan = useQuery({ queryKey: ["plan", planId], queryFn: () => getPlan(planId!), enabled: !!planId });
  const wishId = params.get("wish") ?? plan.data?.wish_id ?? null;
  const wish = wishlist.data?.find((w) => w.id === wishId);

  const initial = useMemo<Partial<DateInput>>(() => {
    const p = plan.data;
    if (p)
      return { place_name: p.place_name, place_address: p.place_address, lat: p.lat, lng: p.lng, date_on: localDay(p.scheduled_at) };
    return {
      place_name: params.get("place") ?? "",
      place_address: params.get("address") ?? wish?.place_address ?? null,
      lat: wish?.lat ?? null,
      lng: wish?.lng ?? null,
    };
  }, [plan.data, params, wish]);

  const tagSuggestions = useMemo(() => {
    const count = new Map<string, number>();
    dates.data?.forEach((d) => d.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [dates.data]);
  const near = dates.data?.find((d) => d.lat != null && d.lng != null);

  async function save({ input, newCover, newExtras }: DateFormResult) {
    if (!newCover) return;
    setSaving(true);
    try {
      const id = await createDate({
        coupleId: me.couple.id,
        input,
        cover: newCover,
        extras: newExtras,
        wishId,
        planId,
        onProgress: (done, total) => setProgress(`Enviando fotos ${done}/${total}…`),
      });
      notify({ type: "date_created", dateId: id });
      invalidate();
      if (wishId) qc.invalidateQueries({ queryKey: keys.wishlist });
      if (planId) qc.invalidateQueries({ queryKey: ["plans"] });
      toast("Date registrado! Agora dê sua nota.");
      router.replace(`/dates/${id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
      setSaving(false);
      setProgress(null);
    }
  }

  if (planId && plan.isPending) return <FullScreenLoader />;

  return (
    <>
      <PageHeader
        title="Novo date"
        left={
          <button onClick={() => router.back()} aria-label="Voltar" className="-ml-2 grid size-11 place-items-center text-ink">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        }
      />
      <div className="px-4 pb-32">
        <DateForm
          // remonta quando os dados do plano/lista chegam, para preencher o formulário
          key={`${plan.data?.id ?? ""}-${wish?.id ?? ""}`}
          initial={initial}
          tagSuggestions={tagSuggestions}
          near={near ? { lat: near.lat!, lng: near.lng! } : null}
          submitLabel="Salvar date"
          saving={saving}
          progress={progress}
          onSubmit={save}
        />
      </div>
    </>
  );
}

export default function NewDatePage() {
  return (
    <Suspense>
      <NewDate />
    </Suspense>
  );
}
