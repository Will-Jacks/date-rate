"use client";

import { Bookmark, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const path = usePathname();
  const item = (href: string, active: boolean, label: string, icon: React.ReactNode) => (
    <Link
      href={href}
      className={`flex min-w-20 flex-col items-center gap-0.5 py-1 text-xs ${active ? "text-wine" : "text-muted"}`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-center justify-around border-t border-line bg-card pt-2">
      {item("/", path === "/", "Feed", <LayoutGrid className="size-5" aria-hidden />)}
      <Link
        href="/dates/new"
        aria-label="Novo date"
        className="-mt-8 grid size-14 place-items-center rounded-full bg-wine text-white shadow-[0_6px_18px_rgba(140,47,57,.4)] active:scale-95"
      >
        <Plus className="size-7" aria-hidden />
      </Link>
      {item("/wishlist", path.startsWith("/wishlist"), "Queremos ir", <Bookmark className="size-5" aria-hidden />)}
    </nav>
  );
}
