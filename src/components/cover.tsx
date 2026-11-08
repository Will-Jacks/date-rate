"use client";

import { useState } from "react";
import { categoryInfo } from "@/lib/categories";

/** Foto (URL assinada) com fundo em gradiente da categoria enquanto carrega ou se faltar. */
export function Cover({
  url,
  category,
  alt,
  className = "",
}: {
  url?: string;
  category: string;
  alt: string;
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
          className={`size-full object-cover transition-opacity duration-300 ${loaded === url ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
