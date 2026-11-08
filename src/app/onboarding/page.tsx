"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth-provider";
import { InviteCode } from "@/components/invite-code";
import { Button, ErrorState, Field, FullScreenLoader, Input } from "@/components/ui";
import { createCouple, joinCouple, signOut } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, useMe } from "@/lib/hooks";

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session, loading } = useSession();
  const me = useMe();
  const [code, setCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inCouple = !!me.data?.profile.couple_id;

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
    else if (inCouple && !createdCode) router.replace("/");
  }, [loading, session, inCouple, createdCode, router]);

  if (loading || !session || me.isPending) return <FullScreenLoader />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;

  const refreshMe = () => qc.invalidateQueries({ queryKey: keys.me(session.user.id) });

  async function create() {
    setBusy("create");
    setError(null);
    try {
      // guardamos o código antes de atualizar o perfil para não sair desta tela
      setCreatedCode(await createCouple(null));
      await refreshMe();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 6) return setError("O código tem 6 caracteres.");
    setBusy("join");
    setError(null);
    try {
      await joinCouple(code);
      await refreshMe();
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (createdCode) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-6 px-6 py-10">
        <h1 className="font-serif text-4xl text-wine">Diário criado!</h1>
        <p className="text-muted">
          Mande este código para seu par. Ao criar a conta, a pessoa escolhe <b>“Tenho um código”</b> e digita ele.
        </p>
        <InviteCode code={createdCode} />
        <Button onClick={() => router.replace("/")}>Começar</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-8 px-6 py-10">
      <div>
        <h1 className="font-serif text-4xl text-wine">Oi, {me.data?.profile.display_name}!</h1>
        <p className="mt-2 text-muted">O Date Rate é um diário a dois. Como vocês querem começar?</p>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-xl">Sou quem começa</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Crie o diário e receba um código para convidar seu par.</p>
        <Button className="w-full" loading={busy === "create"} disabled={!!busy} onClick={create}>
          Criar nosso diário
        </Button>
      </section>

      <form onSubmit={join} className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-4 font-serif text-xl">Tenho um código</h2>
        <Field label="Código de convite">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="Ex.: K7PX2M"
            className="text-center font-mono text-xl tracking-[0.3em]"
          />
        </Field>
        <Button type="submit" variant="secondary" className="mt-4 w-full" loading={busy === "join"} disabled={!!busy}>
          Entrar no diário
        </Button>
      </form>

      {error && <p className="text-center text-sm text-wine">{error}</p>}

      <button onClick={() => signOut()} className="text-sm text-muted underline">
        Sair desta conta
      </button>
    </main>
  );
}
