"use client";

import { X } from "lucide-react";
import { useState } from "react";

const MAX_TAGS = 12;

/** "Primeira Vez!" → "primeiravez" */
export function cleanTag(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

/** Etiquetas livres (#aniversário, #chuva…). Enter, vírgula ou espaço confirmam. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const t = cleanTag(raw);
    if (t && !value.includes(t) && value.length < MAX_TAGS) onChange([...value, t]);
    setDraft("");
  };

  const unused = suggestions.filter((s) => !value.includes(s)).slice(0, 8);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-card px-2.5 py-2 focus-within:border-wine focus-within:ring-2 focus-within:ring-wine/15">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-wine/10 py-1 pl-2.5 pr-1 text-sm font-medium text-wine">
            #{t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remover #${t}`} className="grid size-5 place-items-center">
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        {value.length < MAX_TAGS && (
          <input
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              if (/[,\s]$/.test(v)) add(v);
              else setDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => draft && add(draft)}
            placeholder={value.length ? "" : "aniversario, chuva, primeiravez…"}
            className="min-w-24 flex-1 bg-transparent px-1 py-1 text-[16px] outline-none placeholder:text-muted/70"
            aria-label="Adicionar etiqueta"
          />
        )}
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
              +#{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
