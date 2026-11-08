"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DateForm, type DateFormResult } from "@/components/date-form";
import { useToast } from "@/components/toast";
import { Button, ErrorState, FullScreenLoader, PageHeader } from "@/components/ui";
import { deleteDate, updateDate } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useCurrentMe, useDate, useDates, useInvalidateDates, usePhotos, useSignedUrls } from "@/lib/hooks";

export default function EditDatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useCurrentMe();
  const toast = useToast();
  const invalidate = useInvalidateDates();
  const date = useDate(id);
  const photos = usePhotos(id);
  const allDates = useDates();
  const urls = useSignedUrls([date.data?.cover_path, ...(photos.data?.map((p) => p.path) ?? [])]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  if (date.isPending || photos.isPending) return <FullScreenLoader />;
  if (date.isError || photos.isError) {
    return (
      <ErrorState
        error={date.error ?? photos.error}
        onRetry={() => {
          date.refetch();
          photos.refetch();
        }}
      />
    );
  }
  const d = date.data;

  async function save(r: DateFormResult) {
    setSaving(true);
    try {
      await updateDate({
        coupleId: me.couple.id,
        id: d.id,
        input: r.input,
        oldCoverPath: d.cover_path,
        newCover: r.newCover,
        newExtras: r.newExtras,
        removedPhotos: r.removedPhotos,
        coverFromPhoto: r.coverFromPhoto,
        keepOldCover: r.keepOldCover,
        nextPosition: Math.max(-1, ...photos.data!.map((p) => p.position)) + 1,
        onProgress: (done, total) => setProgress(`Enviando fotos ${done}/${total}…`),
      });
      invalidate(d.id);
      toast("Alterações salvas.");
      router.replace(`/dates/${d.id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
      setSaving(false);
      setProgress(null);
    }
  }

  async function remove() {
    if (!window.confirm(`Apagar o date em “${d.place_name}”? As fotos e as notas dos dois também serão apagadas.`)) return;
    setDeleting(true);
    try {
      await deleteDate(d);
      invalidate();
      toast("Date apagado.");
      router.replace("/");
    } catch (e) {
      toast(errorMessage(e), "error");
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Editar date"
        left={
          <button onClick={() => router.back()} aria-label="Voltar" className="-ml-2 grid size-11 place-items-center text-ink">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        }
      />
      <div className="px-4 pb-32">
        <DateForm
          initial={d}
          existingCoverUrl={d.cover_path ? urls.data?.[d.cover_path] : undefined}
          hasExistingCover={!!d.cover_path}
          existingPhotos={photos.data}
          photoUrls={urls.data}
          tagSuggestions={[...new Set(allDates.data?.flatMap((x) => x.tags) ?? [])]}
          submitLabel="Salvar alterações"
          saving={saving}
          progress={progress}
          onSubmit={save}
        />
        <Button variant="danger" className="mt-6 w-full" loading={deleting} disabled={saving} onClick={remove}>
          <Trash2 className="size-4" aria-hidden /> Apagar date
        </Button>
      </div>
    </>
  );
}
