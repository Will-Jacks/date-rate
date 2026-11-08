"use client";

import { LoaderCircle, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "@/lib/places";
import type { PlacePick } from "@/lib/types";

/**
 * Campo de nome do lugar com sugestões do OpenStreetMap.
 * Digitar livremente continua funcionando (ex.: "Em casa").
 */
export function PlaceSearch({
  value,
  onChange,
  onPick,
  near,
  placeholder = "Ex.: Mangai",
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: PlacePick) => void;
  near?: { lat: number; lng: number } | null;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [results, setResults] = useState<PlacePick[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false); // só busca quando a pessoa digitou (não ao preencher)
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typed.current || value.trim().length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchPlaces(value, { near, signal: ctrl.signal });
        setResults(r);
        setOpen(true);
      } catch {
        /* sem rede ou cancelado */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, near]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={value}
          onChange={(e) => {
            typed.current = true;
            onChange(e.target.value);
          }}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          maxLength={120}
          autoFocus={autoFocus}
          aria-invalid={invalid}
          aria-autocomplete="list"
          className="w-full rounded-xl border border-line bg-card py-3 pl-10 pr-10 text-[16px] text-ink outline-none placeholder:text-muted/70 focus:border-wine focus:ring-2 focus:ring-wine/15"
        />
        {loading && <LoaderCircle className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="animate-slide-down absolute inset-x-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-xl"
        >
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  typed.current = false;
                  onPick(r);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left active:bg-cream"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-wine" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  {r.address && <span className="block truncate text-xs text-muted">{r.address}</span>}
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 pb-1.5 pt-1 text-[10px] text-muted">© OpenStreetMap</li>
        </ul>
      )}
    </div>
  );
}
