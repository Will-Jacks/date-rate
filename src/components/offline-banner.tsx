"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Faixa discreta quando o aparelho está sem internet. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="animate-slide-down sticky top-0 z-40 flex items-center justify-center gap-2 bg-ink px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-xs font-medium text-cream"
    >
      <WifiOff className="size-3.5" aria-hidden />
      Sem internet — mostrando o que já estava salvo
    </div>
  );
}
