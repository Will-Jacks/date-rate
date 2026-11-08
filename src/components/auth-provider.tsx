"use client";

import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthState = { session: Session | null; loading: boolean; configError: string | null };

const AuthContext = createContext<AuthState>({ session: null, loading: true, configError: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<AuthState>({ session: null, loading: true, configError: null });

  useEffect(() => {
    let sb: ReturnType<typeof supabase>;
    try {
      sb = supabase();
    } catch (e) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- erro de configuração só é conhecido no navegador
      setState({ session: null, loading: false, configError: (e as Error).message });
      return;
    }
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false, configError: null });
      if (event === "SIGNED_OUT") qc.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useSession() {
  return useContext(AuthContext);
}
