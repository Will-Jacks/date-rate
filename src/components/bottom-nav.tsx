"use client";

import { CalendarHeart, Heart, LayoutGrid, Map as MapIcon, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { usePlans } from "@/lib/hooks";

export function BottomNav() {
  const path = usePathname();
  const plans = usePlans();
  const [now] = useState(Date.now);
  // bolinha em "Planos" quando há date marcado para hoje/amanhã
  const soon = (plans.data ?? []).some((p) => {
    const ms = new Date(p.scheduled_at).getTime() - now;
    return !p.done_date_id && ms > -6 * 3600_000 && ms < 36 * 3600_000;
  });

  const item = (href: string, active: boolean, label: string, icon: React.ReactNode, dot = false) => (
    <Link
      href={href}
      className={`relative flex min-w-14 flex-1 flex-col items-center gap-0.5 py-1 text-[11px] ${active ? "text-wine" : "text-muted"}`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
      {dot && <span className="absolute right-[calc(50%-14px)] top-0.5 size-2 rounded-full bg-coral ring-2 ring-card" aria-label="date em breve" />}
    </Link>
  );

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-center justify-around border-t border-line bg-card px-1 pt-2">
      {item("/", path === "/", "Feed", <LayoutGrid className="size-5" aria-hidden />)}
      {item("/map", path.startsWith("/map"), "Mapa", <MapIcon className="size-5" aria-hidden />)}
      <div className="flex flex-1 justify-center">
        <Link
          href="/dates/new"
          aria-label="Novo date"
          className="-mt-8 grid size-14 place-items-center rounded-full bg-wine text-white shadow-[0_6px_18px_rgba(140,47,57,.4)] active:scale-95"
        >
          <Plus className="size-7" aria-hidden />
        </Link>
      </div>
      {item("/wishlist", path.startsWith("/wishlist"), "Planos", <CalendarHeart className="size-5" aria-hidden />, soon)}
      {item("/profile", path.startsWith("/profile"), "Nós", <Heart className="size-5" aria-hidden />)}
    </nav>
  );
}
