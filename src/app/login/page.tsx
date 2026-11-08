"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth-provider";
import { Button, Field, FullScreenLoader, Input } from "@/components/ui";
import { signIn, signUp } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, configError } = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
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
        if (!loggedIn) setInfo("Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois entre aqui.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6 py-10">
      <h1 className="font-serif text-5xl text-wine">Date Rate</h1>
      <p className="mb-8 mt-2 text-muted">O diário dos nossos dates.</p>

      {configError && (
        <p className="mb-6 rounded-xl border border-wine/30 bg-wine/5 p-3 text-sm text-wine">{configError}</p>
      )}

      <div className="mb-6 grid grid-cols-2 rounded-xl bg-line/60 p-1" role="tablist">
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

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "up" && (
          <Field label="Seu nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} />
          </Field>
        )}
        <Field label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <Field label="Senha" hint={mode === "up" ? "Pelo menos 6 caracteres." : undefined}>
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
        <Button type="submit" loading={busy} disabled={!!configError} className="mt-2">
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </main>
  );
}
