"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { Button, Field, FullScreenLoader, Input } from "@/components/ui";
import { updatePassword } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

/** Aberta pelo link do e-mail "Esqueci minha senha": o Supabase já entra com a sessão de recuperação. */
export default function ResetPage() {
  const router = useRouter();
  const toast = useToast();
  const { session, loading } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);

  // o link traz o token na URL; damos um instante para o Supabase processar
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (loading || (!session && !waited)) return <FullScreenLoader />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== confirm) return setError("As senhas não são iguais.");
    setBusy(true);
    try {
      await updatePassword(password);
      toast("Senha alterada! 🔐");
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-6 px-6 py-10">
      <h1 className="font-serif text-4xl text-wine">Nova senha</h1>
      {session ? (
        <form onSubmit={save} className="flex flex-col gap-4">
          <p className="text-sm text-muted">Conta: {session.user.email}</p>
          <Field label="Nova senha" hint="Pelo menos 6 caracteres.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
          </Field>
          <Field label="Repita a senha">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          {error && <p className="text-sm text-wine">{error}</p>}
          <Button type="submit" loading={busy}>
            Salvar senha
          </Button>
        </form>
      ) : (
        <>
          <p className="text-muted">Esse link expirou ou já foi usado. Peça um novo na tela de login.</p>
          <Button onClick={() => router.replace("/login")}>Ir para o login</Button>
        </>
      )}
    </main>
  );
}
