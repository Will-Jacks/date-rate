"use client";

import { Check, Crosshair, ImagePlus, Move, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { Sheet } from "./ui";

export type Focus = { x: number; y: number };
export const CENTER: Focus = { x: 50, y: 50 };

const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)));

/**
 * Capa no formato do card (4:5). No modo "Ajustar", arrastar a foto muda o
 * ponto de foco (object-position), que é o que o feed, o detalhe e o card
 * para os stories usam para cortar a imagem.
 */
export function CoverEditor({
  url,
  focus,
  onFocus,
  onChange,
  invalid,
}: {
  url?: string;
  focus: Focus;
  onFocus: (f: Focus) => void;
  /** abrir a troca de capa */
  onChange: () => void;
  invalid?: boolean;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; px: number; py: number; f: Focus; ox: number; oy: number } | null>(null);

  if (!url) {
    return (
      <button
        type="button"
        onClick={onChange}
        className={`flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed ${
          invalid ? "border-wine" : "border-line"
        } bg-card text-muted`}
      >
        <ImagePlus className="size-10" aria-hidden />
        <span className="font-medium">Foto de capa</span>
        <span className="text-xs">Toque para escolher uma foto</span>
      </button>
    );
  }

  function start(e: React.PointerEvent) {
    const el = frame.current;
    const im = img.current;
    if (!adjusting || !el || !im?.naturalWidth) return;
    // quanto a foto "sobra" para fora do quadro em cada eixo (object-fit: cover)
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const scale = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    el.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      px: e.clientX,
      py: e.clientY,
      f: focus,
      ox: im.naturalWidth * scale - cw,
      oy: im.naturalHeight * scale - ch,
    };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // arrastar para a direita revela o lado esquerdo (foco diminui)
    onFocus({
      x: d.ox > 1 ? clamp(d.f.x - ((e.clientX - d.px) / d.ox) * 100) : d.f.x,
      y: d.oy > 1 ? clamp(d.f.y - ((e.clientY - d.py) / d.oy) * 100) : d.f.y,
    });
  }

  function key(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 4;
    const moves: Record<string, Focus> = {
      ArrowLeft: { x: focus.x - step, y: focus.y },
      ArrowRight: { x: focus.x + step, y: focus.y },
      ArrowUp: { x: focus.x, y: focus.y - step },
      ArrowDown: { x: focus.x, y: focus.y + step },
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onFocus({ x: clamp(m.x), y: clamp(m.y) });
  }

  return (
    <div>
      <div
        ref={frame}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={adjusting ? key : undefined}
        tabIndex={adjusting ? 0 : -1}
        role={adjusting ? "application" : undefined}
        aria-label={adjusting ? "Arraste a foto (ou use as setas) para enquadrar" : undefined}
        className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-card ${
          adjusting ? "cursor-grab touch-none ring-3 ring-wine active:cursor-grabbing" : ""
        }`}
      >
        <img
          ref={img}
          src={url}
          alt="Capa"
          draggable={false}
          className="pointer-events-none size-full select-none object-cover"
          style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
        />
        {adjusting ? (
          <>
            {/* regra dos terços, para ajudar a enquadrar */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden>
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="border border-white/30" />
              ))}
            </div>
            <span className="pointer-events-none absolute inset-x-0 top-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">
              <Move className="size-4" aria-hidden /> Arraste para enquadrar
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={onChange}
            className="absolute inset-0"
            aria-label="Trocar capa"
          />
        )}
      </div>

      <div className="mt-2 flex gap-2">
        {adjusting ? (
          <>
            <button
              type="button"
              onClick={() => onFocus(CENTER)}
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-card text-sm font-semibold"
            >
              <Crosshair className="size-4" aria-hidden /> Centralizar
            </button>
            <button
              type="button"
              onClick={() => setAdjusting(false)}
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-wine text-sm font-semibold text-white"
            >
              <Check className="size-4" aria-hidden /> Pronto
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setAdjusting(true);
                requestAnimationFrame(() => frame.current?.focus({ preventScroll: true }));
              }}
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-card text-sm font-semibold text-wine"
            >
              <Move className="size-4" aria-hidden /> Ajustar posição
            </button>
            <button
              type="button"
              onClick={onChange}
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-card text-sm font-semibold text-wine"
            >
              <RefreshCw className="size-4" aria-hidden /> Trocar capa
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export type CoverOption = { key: string; url?: string; current?: boolean };

/** Escolher a capa entre as fotos do date, ou abrir a galeria do celular. */
export function CoverChooser({
  options,
  onPick,
  onDevice,
  onClose,
}: {
  options: CoverOption[];
  onPick: (key: string) => void;
  onDevice: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Escolher capa" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Toque numa foto do date para usar como capa.</p>
      <div className="grid grid-cols-3 gap-2 pb-4">
        <button
          type="button"
          onClick={onDevice}
          className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line bg-card px-2 text-center text-xs font-medium text-muted"
        >
          <ImagePlus className="size-6" aria-hidden />
          Do celular
        </button>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => (o.current ? onClose() : onPick(o.key))}
            aria-label={o.current ? "Capa atual" : "Usar como capa"}
            aria-pressed={o.current}
            className={`relative aspect-[4/5] overflow-hidden rounded-xl bg-skeleton ${o.current ? "ring-3 ring-wine" : ""}`}
          >
            {o.url && <img src={o.url} alt="" className="size-full object-cover" />}
            {o.current && (
              <span className="absolute inset-x-1 bottom-1 rounded-full bg-wine py-0.5 text-[11px] font-semibold text-white">Capa atual</span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
