"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { registerServiceWorker } from "@/lib/push";
import { AuthProvider } from "./auth-provider";
import { ToastProvider } from "./toast";
import { AppError } from "@/lib/errors";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, err) =>
              count < 2 && !(err instanceof AppError && ["AUTH", "NOT_FOUND"].includes(err.code)),
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
