"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Vamos avaliar nossos dates juntos? Entra no Date Rate e usa o código ${code}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text, url: window.location.origin });
        return;
      } catch {
        /* cancelado: cai na cópia */
      }
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de clipboard: o código continua visível */
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
      <span className="font-mono text-3xl font-semibold tracking-[0.25em] text-wine">{code}</span>
      <button
        onClick={share}
        className="flex min-h-11 items-center gap-1.5 rounded-xl bg-cream px-3 text-sm font-semibold text-wine"
      >
        {copied ? <Check className="size-4" aria-hidden /> : canShare ? <Share2 className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copiado" : canShare ? "Enviar" : "Copiar"}
      </button>
    </div>
  );
}
