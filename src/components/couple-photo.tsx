"use client";

import { useCurrentMe, useSignedUrls } from "@/lib/hooks";

/** Foto do casal (a mesma do Álbum). Sem foto: 💞 num círculo. */
export function CouplePhoto({ size = "md", className = "" }: { size?: "sm" | "md"; className?: string }) {
  const me = useCurrentMe();
  const path = me.couple.photo_path;
  const urls = useSignedUrls([path]);
  const url = path ? urls.data?.[path] : undefined;
  const box = size === "sm" ? "size-8 text-sm" : "size-12 text-xl";
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-line ${box} ${className}`} aria-hidden>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : "💞"}
    </span>
  );
}
