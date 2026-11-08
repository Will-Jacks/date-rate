"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth-provider";
import { Button, Field, FullScreenLoader, Input } from "@/components/ui";
import { requestPasswordReset, signIn, signUp } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, configError } = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [forgot, setForgot] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  if (loading || session) return <FullScreenLoader />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === "up" && !name.trim()) return setError("Diga seu nome.");
    setBusy(true);
    try {
      if (mode === "in") {
        await signIn(email.trim(), password);
      } else {
        const loggedIn = await signUp(name.trim(), email.trim(), password);
        if (!loggedIn)
          setInfo(
            "Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois entre aqui.",
          );
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      {/* topo com gradiente e o coração do ícone */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#8c2f39] via-[#b5404c] to-[#e0796b] px-6 pb-16 pt-[max(3.5rem,env(safe-area-inset-top))] text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-white/10" aria-hidden />
        <div className="relative mx-auto max-w-[420px]">
          <div className="animate-pop mb-6 grid size-16 place-items-center rounded-2xl bg-white/15 shadow-lg backdrop-blur">
            <svg viewBox="0 0 24 24" className="size-9" aria-hidden>
              <path
                d="M12 21s-8-5-8-11.2C4 6.6 6.4 4.5 9 4.5c1.4 0 2.4.7 3 1.7.6-1 1.6-1.7 3-1.7 2.6 0 5 2.1 5 5.3C20 16 12 21 12 21z"
                fill="#faf7f2"
              />
            </svg>
          </div>
          <h1 className="font-serif text-5xl leading-none">Date Rate</h1>
          <p className="mt-3 text-white/85">O diário dos nossos dates. Cada um dá sua nota — e a do outro só aparece depois.</p>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-8 w-full max-w-[420px] flex-1 rounded-t-3xl bg-cream px-6 pb-10 pt-7">

      {configError && (
        <p className="mb-6 rounded-xl border border-wine/30 bg-wine/5 p-3 text-sm text-wine">
          {configError}
        </p>
      )}

      <div
        className="mb-6 grid grid-cols-2 rounded-xl bg-line/60 p-1"
        role="tablist"
      >
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`min-h-10 rounded-lg text-sm font-semibold ${mode === m ? "bg-card text-wine shadow-sm" : "text-muted"}`}
          >
            {m === "in" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      {forgot ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setInfo(null);
            setBusy(true);
            try {
              await requestPasswordReset(email.trim());
              setInfo("Pronto! Se esse e-mail tiver conta, chega um link para criar uma senha nova. Confira também o spam.");
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-muted">Digite seu e-mail e enviaremos um link para você criar uma senha nova.</p>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </Field>
          {error && <p className="text-sm text-wine">{error}</p>}
          {info && <p className="rounded-xl bg-card p-3 text-sm">{info}</p>}
          <Button type="submit" loading={busy}>
            Enviar link
          </Button>
          <button type="button" onClick={() => setForgot(false)} className="text-sm font-semibold text-wine">
            Voltar para o login
          </button>
        </form>
      ) : (
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "up" && (
          <Field label="Seu nome">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              maxLength={40}
            />
          </Field>
        )}
        <Field label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field
          label="Senha"
          hint={mode === "up" ? "Pelo menos 6 caracteres." : undefined}
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </Field>
        {error && <p className="text-sm text-wine">{error}</p>}
        {info && <p className="rounded-xl bg-card p-3 text-sm">{info}</p>}
        <Button
          type="submit"
          loading={busy}
          disabled={!!configError}
          className="mt-2"
        >
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
        {mode === "in" && (
          <button
            type="button"
            onClick={() => {
              setForgot(true);
              setError(null);
              setInfo(null);
            }}
            className="text-sm font-semibold text-wine"
          >
            Esqueci minha senha
          </button>
        )}
      </form>
      )}
      </div>
    </main>
  );
}
