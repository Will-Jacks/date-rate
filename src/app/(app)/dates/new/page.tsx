"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DateForm, type DateFormResult } from "@/components/date-form";
import { useToast } from "@/components/toast";
import { PageHeader } from "@/components/ui";
import { createDate } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, useCurrentMe, useInvalidateDates } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";

function NewDate() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useCurrentMe();
  const toast = useToast();
  const qc = useQueryClient();
  const invalidate = useInvalidateDates();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // vindo da lista "Queremos ir"
  const wishId = params.get("wish");
  const place = params.get("place") ?? "";

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
        onProgress: (done, total) => setProgress(`Enviando fotos ${done}/${total}…`),
      });
      invalidate();
      if (wishId) qc.invalidateQueries({ queryKey: keys.wishlist });
      toast("Date registrado! Agora dê sua nota.");
      router.replace(`/dates/${id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
      setSaving(false);
      setProgress(null);
    }
  }

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
        <DateForm initial={{ place_name: place }} submitLabel="Salvar date" saving={saving} progress={progress} onSubmit={save} />
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
