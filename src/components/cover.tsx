"use client";

import { useState } from "react";
import { categoryInfo } from "@/lib/categories";

/** object-position da capa a partir do ponto de foco salvo (0–100; padrão: centro). */
export function coverPosition(d: { cover_x?: number; cover_y?: number } | null | undefined): string {
  return `${d?.cover_x ?? 50}% ${d?.cover_y ?? 50}%`;
}

/** Foto (URL assinada) com fundo em gradiente da categoria enquanto carrega ou se faltar. */
export function Cover({
  url,
  category,
  alt,
  position,
  className = "",
}: {
  url?: string;
  category: string;
  alt: string;
  /** object-position (veja coverPosition) */
  position?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <div className={`absolute inset-0 ${className}`} style={{ backgroundImage: categoryInfo(category).gradient }}>
      {url && (
        <img
          src={url}
          alt={alt}
          onLoad={() => setLoaded(url)}
          style={position ? { objectPosition: position } : undefined}
          className={`size-full object-cover transition-opacity duration-300 ${loaded === url ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
