const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11-02" → "02 nov 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Data de hoje no fuso local, em yyyy-mm-dd. */
export function todayISO(): string {
  const now = new Date();
  const off = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - off).toISOString().slice(0, 10);
}

export function formatScore(n: number | null | undefined): string {
  if (n == null) return "–";
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function formatCost(n: number | null | undefined): string {
  if (n == null) return "";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** UUID v4 que funciona também fora de HTTPS (ex.: testando pelo IP da rede). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* contexto inseguro: usa o fallback */
    }
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
