"use client";

import { ImagePlus, Star, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { CATEGORIES, type Category } from "@/lib/categories";
import { todayISO } from "@/lib/format";
import type { DateInput, DatePhoto } from "@/lib/types";
import { CENTER, CoverChooser, CoverEditor, type CoverOption, type Focus } from "./cover-editor";
import { PlaceSearch } from "./place-search";
import { TagInput } from "./tag-input";
import { Button, Field, Input, TextArea } from "./ui";

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
  quote: z.string().trim().max(200, "Frase longa demais (máx. 200).").transform((v) => v || null),
});

export type DateFormResult = {
  input: DateInput;
  newCover: File | null;
  newExtras: File[];
  removedPhotos: DatePhoto[];
  coverFromPhoto: DatePhoto | null;
  /** capa nova veio das fotos extras: a capa antiga vira foto extra */
  keepOldCover: boolean;
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
  tagSuggestions = [],
  near,
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
  tagSuggestions?: string[];
  near?: { lat: number; lng: number } | null;
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
  const [coverFromPhoto, setCoverFromPhoto] = useState<DatePhoto | null>(null);
  // a capa nova (arquivo) saiu das fotos extras? então a capa antiga vira extra ao salvar
  const [coverWasExtra, setCoverWasExtra] = useState(false);
  const [focus, setFocus] = useState<Focus>({ x: initial?.cover_x ?? 50, y: initial?.cover_y ?? 50 });
  const [choosing, setChoosing] = useState(false);
  const [quote, setQuote] = useState(initial?.quote ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const coverInput = useRef<HTMLInputElement>(null);
  const extrasInput = useRef<HTMLInputElement>(null);
  const [coverPreview] = useObjectUrls(cover);
  const extraPreviews = useObjectUrls(extras);

  const keptPhotos = existingPhotos.filter((p) => !removed.some((r) => r.id === p.id));
  const oldCoverBecomesExtra = cover.length > 0 && coverWasExtra && hasExistingCover;
  const slotsLeft = MAX_EXTRAS - keptPhotos.length - extras.length - (oldCoverBecomesExtra ? 1 : 0);
  const coverUrl = coverPreview ?? (coverFromPhoto ? photoUrls[coverFromPhoto.path] : existingCoverUrl);
  const hasCover = cover.length > 0 || hasExistingCover;

  /** Ao escolher outra foto do date como capa, a capa nova atual vira foto extra (não se perde). */
  function releaseCover(): File[] {
    return cover[0] ? [cover[0]] : [];
  }

  function clearCoverError() {
    setErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([k]) => k !== "cover")));
  }

  function pickFromDevice(f: File) {
    setCover([f]);
    setCoverFromPhoto(null);
    setCoverWasExtra(false);
    setFocus(CENTER);
    clearCoverError();
  }

  function pickOriginal() {
    setExtras((x) => [...x, ...releaseCover()]);
    setCover([]);
    setCoverFromPhoto(null);
    setCoverWasExtra(false);
    setFocus({ x: initial?.cover_x ?? 50, y: initial?.cover_y ?? 50 });
  }

  function pickExisting(p: DatePhoto) {
    setExtras((x) => [...x, ...releaseCover()]);
    setCover([]);
    setCoverFromPhoto(p);
    setCoverWasExtra(false);
    setFocus(CENTER);
  }

  function pickExtra(i: number) {
    const f = extras[i];
    if (!f) return;
    setExtras((x) => [...x.filter((_, j) => j !== i), ...releaseCover()]);
    setCover([f]);
    setCoverFromPhoto(null);
    setCoverWasExtra(true);
    setFocus(CENTER);
    clearCoverError();
  }

  const coverOptions: CoverOption[] = [
    ...(cover[0] ? [{ key: "new-cover", url: coverPreview, current: true }] : []),
    ...(hasExistingCover && existingCoverUrl
      ? [{ key: "original", url: existingCoverUrl, current: !cover.length && !coverFromPhoto }]
      : []),
    ...keptPhotos.map((p) => ({
      key: `photo:${p.id}`,
      url: photoUrls[p.path],
      current: !cover.length && coverFromPhoto?.id === p.id,
    })),
    ...extraPreviews.map((url, i) => ({ key: `extra:${i}`, url })),
  ];

  function pick(key: string) {
    setChoosing(false);
    if (key === "original") return pickOriginal();
    if (key.startsWith("photo:")) {
      const p = keptPhotos.find((x) => `photo:${x.id}` === key);
      if (p) pickExisting(p);
    } else if (key.startsWith("extra:")) pickExtra(Number(key.slice(6)));
  }

  function changeCover() {
    // sem outras fotos para escolher: vai direto para a galeria do celular
    if (coverOptions.some((o) => !o.current)) setChoosing(true);
    else coverInput.current?.click();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ place_name: placeName, place_address: address, date_on: dateOn, category, cost, quote });
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
    }
    if (!hasCover) errs.cover = "Escolha uma foto de capa.";
    setErrors(errs);
    if (!parsed.success || Object.keys(errs).length) return;
    onSubmit({
      input: {
        ...parsed.data,
        tags,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        cover_x: focus.x,
        cover_y: focus.y,
      },
      newCover: cover[0] ?? null,
      newExtras: extras,
      removedPhotos: removed,
      coverFromPhoto: cover.length ? null : coverFromPhoto,
      keepOldCover: oldCoverBecomesExtra,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {/* Capa */}
      <div>
        <CoverEditor url={coverUrl} focus={focus} onFocus={setFocus} onChange={changeCover} invalid={!!errors.cover} />
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFromDevice(f);
            e.target.value = "";
          }}
        />
        {errors.cover && <p className="mt-1.5 text-sm text-wine">{errors.cover}</p>}
        {choosing && (
          <CoverChooser
            options={coverOptions}
            onPick={pick}
            onDevice={() => {
              setChoosing(false);
              coverInput.current?.click();
            }}
            onClose={() => setChoosing(false)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Onde foi?</span>
        <PlaceSearch
          value={placeName}
          near={coords}
          fallbackNear={near}
          invalid={!!errors.place_name}
          onChange={(v) => {
            setPlaceName(v);
            setCoords(null); // nome digitado à mão: coordenadas antigas deixam de valer
          }}
          onPick={(p) => {
            setPlaceName(p.name);
            if (p.address) setAddress(p.address);
            setCoords({ lat: p.lat, lng: p.lng });
            if (p.category) setCategory(p.category);
          }}
        />
        {errors.place_name ? (
          <span className="text-sm text-wine">{errors.place_name}</span>
        ) : (
          <span className="text-xs text-muted">{coords ? "📍 Localização encontrada — vai aparecer no mapa." : "Digite e escolha uma sugestão para preencher o endereço."}</span>
        )}
      </div>

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

      <Field label="Frase do date" hint="Opcional. Uma frase marcante, uma piada interna…">
        <TextArea value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={200} placeholder="“Nunca mais peço o prato do dia”" className="min-h-16" />
        {errors.quote && <span className="text-sm text-wine">{errors.quote}</span>}
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Etiquetas</span>
        <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
      </div>

      {/* Fotos extras */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Mais fotos</span>
        <div className="grid grid-cols-4 gap-2">
          {keptPhotos.map((p) => (
            <Thumb
              key={p.id}
              src={photoUrls[p.path]}
              isCover={!cover.length && coverFromPhoto?.id === p.id}
              onMakeCover={
                hasExistingCover
                  ? () => (!cover.length && coverFromPhoto?.id === p.id ? pickOriginal() : pickExisting(p))
                  : undefined
              }
              onRemove={() => {
                setRemoved((r) => [...r, p]);
                if (coverFromPhoto?.id === p.id) pickOriginal();
              }}
            />
          ))}
          {extraPreviews.map((src, i) => (
            <Thumb
              key={src}
              src={src}
              onMakeCover={() => pickExtra(i)}
              onRemove={() => setExtras((x) => x.filter((_, j) => j !== i))}
            />
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
        <span className="text-xs text-muted">
          Até {MAX_EXTRAS} fotos além da capa.
          {keptPhotos.length + extras.length > 0 ? " Toque na ★ para usar uma delas como capa." : ""}
        </span>
      </div>

      {/* botão fixo no rodapé: sempre à mão, sem rolar até o fim */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-cream/90 px-4 pt-3 backdrop-blur-md">
        <Button type="submit" loading={saving} className="w-full">
          {saving && progress ? progress : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Thumb({
  src,
  onRemove,
  onMakeCover,
  isCover,
}: {
  src?: string;
  onRemove: () => void;
  onMakeCover?: () => void;
  isCover?: boolean;
}) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-xl bg-line ${isCover ? "ring-3 ring-wine" : ""}`}>
      {src && <img src={src} alt="" className="size-full object-cover" />}
      {onMakeCover && (
        <button
          type="button"
          onClick={onMakeCover}
          aria-label={isCover ? "Desfazer: não usar como capa" : "Usar como capa"}
          aria-pressed={isCover}
          className={`absolute left-1 top-1 grid size-7 place-items-center rounded-full ${isCover ? "bg-wine text-white" : "bg-black/60 text-white"}`}
        >
          <Star className={`size-3.5 ${isCover ? "fill-current" : ""}`} aria-hidden />
        </button>
      )}
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
