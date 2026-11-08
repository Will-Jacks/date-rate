export type AppErrorCode =
  | "NETWORK"
  | "AUTH"
  | "VALIDATION"
  | "UPLOAD"
  | "NOT_FOUND"
  | "UNKNOWN";

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    public userMessage: string,
    public cause?: unknown,
  ) {
    super(userMessage);
  }
}

/** Mensagens conhecidas (Supabase Auth e exceções das RPCs). */
const KNOWN: [string, AppErrorCode, string][] = [
  ["already_in_couple", "VALIDATION", "Você já faz parte de um casal."],
  ["invalid_code", "VALIDATION", "Código não encontrado. Confira e tente de novo."],
  ["not_in_couple", "VALIDATION", "Você não faz parte de um casal."],
  ["couple_full", "VALIDATION", "Esse casal já tem duas pessoas."],
  ["invalid login credentials", "AUTH", "E-mail ou senha incorretos."],
  ["user already registered", "VALIDATION", "Esse e-mail já tem conta. Entre com sua senha."],
  ["email not confirmed", "AUTH", "Confirme seu e-mail antes de entrar (veja sua caixa de entrada)."],
  ["password should be", "VALIDATION", "A senha precisa ter pelo menos 6 caracteres."],
  ["signups not allowed", "AUTH", "Novos cadastros estão desativados."],
  ["rate limit", "NETWORK", "Muitas tentativas seguidas. Espere um pouco e tente de novo."],
];

export function toAppError(
  err: unknown,
  fallback = "Algo deu errado. Tente novamente.",
): AppError {
  if (err instanceof AppError) return err;
  const e = err as { message?: string; status?: number; code?: string } | null;
  const msg = String(e?.message ?? "").toLowerCase();

  for (const [key, code, text] of KNOWN) {
    if (msg.includes(key)) return new AppError(code, text, err);
  }
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("timeout")
  ) {
    return new AppError(
      "NETWORK",
      "Sem conexão com a internet. Verifique sua rede e tente novamente.",
      err,
    );
  }
  if (e?.status === 401 || msg.includes("jwt")) {
    return new AppError("AUTH", "Sua sessão expirou. Entre novamente.", err);
  }
  if (msg.includes("supabase_url") || msg.includes("configure next_public")) {
    return new AppError("UNKNOWN", String(e?.message), err);
  }
  return new AppError("UNKNOWN", fallback, err);
}

export function errorMessage(err: unknown, fallback?: string): string {
  return toAppError(err, fallback).userMessage;
}
