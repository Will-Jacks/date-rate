"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, useState } from "react";
import { AppError } from "@/lib/errors";
import { registerServiceWorker } from "@/lib/push";
import { AuthProvider } from "./auth-provider";
import { ToastProvider } from "./toast";

const DAY = 24 * 60 * 60 * 1000;
// o que vale a pena guardar no aparelho para abrir sem internet
const PERSISTED = new Set(["me", "dates", "date", "photos", "wishlist", "plans", "comments", "reactions", "signed"]);

/** Sem localStorage (modo privado, servidor): não guarda nada. */
const noopPersister = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
};

function makePersister() {
  if (typeof window === "undefined") return noopPersister;
  try {
    window.localStorage.getItem("date-rate-cache");
    return createSyncStoragePersister({ storage: window.localStorage, key: "date-rate-cache", throttleTime: 1500 });
  } catch {
    return noopPersister;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: DAY,
            // sem internet, mostra o que está guardado em vez de ficar carregando
            networkMode: "offlineFirst",
            retry: (count, err) => count < 2 && !(err instanceof AppError && ["AUTH", "NOT_FOUND"].includes(err.code)),
          },
          mutations: { retry: false },
        },
      }),
  );
  const [persister] = useState(makePersister);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  const content = (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 7 * DAY,
        buster: "v2",
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === "success" && PERSISTED.has(String(q.queryKey[0])),
        },
      }}
    >
      {content}
    </PersistQueryClientProvider>
  );
}
