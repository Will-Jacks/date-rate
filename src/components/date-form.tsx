"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { CATEGORIES, type Category } from "@/lib/categories";
import { todayISO } from "@/lib/format";
import type { DateInput, DatePhoto } from "@/lib/types";
import { Button, Field, Input } from "./ui";

const MAX_EXTRAS = 8;

const schema = z.object({
  place_name: z.string().trim().min(1, "Diga onde foi o date.").max(120, "Nome longo demais."),
  place_address: z.string().trim().max(300).transform((v) => v || null),
  date_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  category: z.enum(CATEGORIES.map((c) => c.value) as [Category, ...Category[]]),
  cost: z
    .string()
    .trim()
    .transform((v) => {
      if (!v) return null;
      // "1.234,56" (pt-BR) ou "120.50"
      const n = v.replace(/^R\$\s*/, "");
      return Number(n.includes(",") ? n.replace(/\./g, "").replace(",", ".") : n);
    })
    .refine((v) => v == null || (Number.isFinite(v) && v >= 0 && v < 1e8), "Valor inválido."),
});

export type DateFormResult = {
  input: DateInput;
  newCover: File | null;
  newExtras: File[];
  removedPhotos: DatePhoto[];
};

/** URL local para pré-visualizar um arquivo, liberada ao desmontar. */
function useObjectUrls(files: File[]) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

export function DateForm({
  initial,
  existingCoverUrl,
  hasExistingCover = false,
  existingPhotos = [],
  photoUrls = {},
  submitLabel,
  saving,
  progress,
  onSubmit,
}: {
  initial?: Partial<DateInput>;
  existingCoverUrl?: string;
  hasExistingCover?: boolean;
  existingPhotos?: DatePhoto[];
  photoUrls?: Record<string, string>;
  submitLabel: string;
  saving: boolean;
  progress: string | null;
  onSubmit: (r: DateFormResult) => void;
}) {
  const [placeName, setPlaceName] = useState(initial?.place_name ?? "");
  const [address, setAddress] = useState(initial?.place_address ?? "");
  const [dateOn, setDateOn] = useState(initial?.date_on ?? todayISO());
  const [category, setCategory] = useState<Category>(initial?.category ?? "jantar");
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost).replace(".", ",") : "");
  const [cover, setCover] = useState<File[]>([]);
  const [extras, setExtras] = useState<File[]>([]);
  const [removed, setRemoved] = useState<DatePhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const coverInput = useRef<HTMLInputElement>(null);
  const extrasInput = useRef<HTMLInputElement>(null);
  const [coverPreview] = useObjectUrls(cover);
  const extraPreviews = useObjectUrls(extras);

  const keptPhotos = existingPhotos.filter((p) => !removed.some((r) => r.id === p.id));
  const slotsLeft = MAX_EXTRAS - keptPhotos.length - extras.length;
  const coverUrl = coverPreview ?? existingCoverUrl;
  const hasCover = cover.length > 0 || hasExistingCover;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ place_name: placeName, place_address: address, date_on: dateOn, category, cost });
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
    }
    if (!hasCover) errs.cover = "Escolha uma foto de capa.";
    setErrors(errs);
    if (!parsed.success || Object.keys(errs).length) return;
    onSubmit({
      input: parsed.data,
      newCover: cover[0] ?? null,
      newExtras: extras,
      removedPhotos: removed,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {/* Capa */}
      <div>
        <button
          type="button"
          onClick={() => coverInput.current?.click()}
          className={`relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border-2 border-dashed ${
            errors.cover ? "border-wine" : "border-line"
          } bg-card`}
        >
          {coverUrl ? (
            <>
              <img src={coverUrl} alt="Capa" className="size-full object-cover" />
              <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-wine">
                Trocar capa
              </span>
            </>
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-2 text-muted">
              <ImagePlus className="size-10" aria-hidden />
              <span className="font-medium">Foto de capa</span>
              <span className="text-xs">Toque para escolher da galeria ou tirar uma foto</span>
            </span>
          )}
        </button>
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setCover([f]);
            e.target.value = "";
          }}
        />
        {errors.cover && <p className="mt-1.5 text-sm text-wine">{errors.cover}</p>}
      </div>

      <Field label="Onde foi?">
        <Input
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          placeholder="Ex.: Mangai"
          maxLength={120}
          aria-invalid={!!errors.place_name}
        />
        {errors.place_name && <span className="text-sm text-wine">{errors.place_name}</span>}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quando?">
          <Input type="date" value={dateOn} onChange={(e) => setDateOn(e.target.value)} max="2100-12-31" />
          {errors.date_on && <span className="text-sm text-wine">{errors.date_on}</span>}
        </Field>
        <Field label="Quanto gastaram?">
          <Input
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="R$ (opcional)"
          />
          {errors.cost && <span className="text-sm text-wine">{errors.cost}</span>}
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Tipo de date</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors ${
                category === c.value ? "border-wine bg-wine text-white" : "border-line bg-card text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Endereço" hint="Opcional. Vira um link para o mapa.">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, bairro, cidade" maxLength={300} />
      </Field>

      {/* Fotos extras */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Mais fotos</span>
        <div className="grid grid-cols-4 gap-2">
          {keptPhotos.map((p) => (
            <Thumb key={p.id} src={photoUrls[p.path]} onRemove={() => setRemoved((r) => [...r, p])} />
          ))}
          {extraPreviews.map((src, i) => (
            <Thumb key={src} src={src} onRemove={() => setExtras((x) => x.filter((_, j) => j !== i))} />
          ))}
          {slotsLeft > 0 && (
            <button
              type="button"
              onClick={() => extrasInput.current?.click()}
              className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line bg-card text-muted"
              aria-label="Adicionar fotos"
            >
              <ImagePlus className="size-6" aria-hidden />
            </button>
          )}
        </div>
        <input
          ref={extrasInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, slotsLeft));
            if (files.length) setExtras((x) => [...x, ...files]);
            e.target.value = "";
          }}
        />
        <span className="text-xs text-muted">Até {MAX_EXTRAS} fotos além da capa.</span>
      </div>

      <Button type="submit" loading={saving} className="mt-2">
        {saving && progress ? progress : submitLabel}
      </Button>
    </form>
  );
}

function Thumb({ src, onRemove }: { src?: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-line">
      {src && <img src={src} alt="" className="size-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover foto"
        className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
