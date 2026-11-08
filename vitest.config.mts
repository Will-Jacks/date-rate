import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" bloqueia import fora do servidor do Next; nos testes, vira um módulo vazio
      "server-only": path.resolve(import.meta.dirname, "tests/empty.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30_000 },
});
