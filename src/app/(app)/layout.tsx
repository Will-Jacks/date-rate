"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { ErrorState, FullScreenLoader } from "@/components/ui";
import { useMe } from "@/lib/hooks";
import { syncPush } from "@/lib/push";
import { useRealtime } from "@/lib/realtime";

/** Área logada: exige sessão e casal formado. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const router = useRouter();
  const path = usePathname();
  // formulários têm o próprio botão fixo no rodapé
  const isForm = path === "/dates/new" || path.endsWith("/edit");
  const isDetail = path.startsWith("/dates/") && !isForm;
  const { session, loading } = useSession();
  const me = useMe();
  const noCouple = me.data && !me.data.couple;
  useRealtime(me.data);
  const userId = me.data?.userId;
  useEffect(() => {
    if (userId) syncPush();
  }, [userId]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (noCouple) router.replace("/onboarding");
  }, [loading, session, noCouple, router]);

  if (loading || !session || me.isPending || noCouple) return <FullScreenLoader />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;

  return (
    <div className={`mx-auto min-h-dvh max-w-[480px] ${isForm ? "" : "pb-28"}`}>
      <OfflineBanner />
      <div key={path} className={isDetail ? "animate-page-up" : "animate-page-fade"}>
        {children}
      </div>
      {!isForm && <BottomNav />}
    </div>
  );
}
