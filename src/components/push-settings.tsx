"use client";

import { Bell, BellOff, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { disablePush, enablePush, getPushState, isIOS, notify, type PushState } from "@/lib/push";
import { useToast } from "./toast";
import { Button } from "./ui";

function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return [state, setState] as const;
}

function InstallSteps() {
  return (
    <ol className="mt-3 flex flex-col gap-2 text-sm">
      <li className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-wine text-xs font-bold text-white">1</span>
        No Safari, toque em <Share className="inline size-4 text-wine" aria-label="Compartilhar" /> <b>Compartilhar</b>
      </li>
      <li className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-wine text-xs font-bold text-white">2</span>
        Escolha <SquarePlus className="inline size-4 text-wine" aria-hidden /> <b>Adicionar à Tela de Início</b>
      </li>
      <li className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-wine text-xs font-bold text-white">3</span>
        Abra o Date Rate pelo ícone novo e ative aqui
      </li>
    </ol>
  );
}

/** Cartão do perfil: ligar/desligar notificações neste aparelho. */
export function PushSettings() {
  const toast = useToast();
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<PushState>) {
    setBusy(true);
    try {
      const next = await fn();
      setState(next);
      if (next === "on") {
        const r = await notify({ type: "test" });
        toast(r?.sent ? "Notificações ativadas! Enviamos um teste 🔔" : "Notificações ativadas neste aparelho.");
      }
      if (next === "denied") toast("As notificações foram bloqueadas neste aparelho.", "error");
    } catch (e) {
      toast(errorMessage(e, "Não foi possível ativar as notificações."), "error");
    } finally {
      setBusy(false);
    }
  }

  if (state == null) return null;

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        {state === "on" ? <Bell className="size-5 text-wine" aria-hidden /> : <BellOff className="size-5 text-muted" aria-hidden />}
        <h2 className="font-serif text-lg">Notificações</h2>
        {state === "on" && <span className="ml-auto rounded-full bg-wine/10 px-2.5 py-0.5 text-xs font-semibold text-wine">Ativas</span>}
      </div>

      {state === "needs-install" && (
        <>
          <p className="mt-2 text-sm text-muted">No iPhone, as notificações só funcionam com o app instalado na Tela de Início.</p>
          <InstallSteps />
        </>
      )}
      {state === "unsupported" && (
        <p className="mt-2 text-sm text-muted">Este navegador não suporta notificações. No Android, use o Chrome.</p>
      )}
      {state === "denied" && (
        <p className="mt-2 text-sm text-muted">
          {isIOS()
            ? "Elas estão bloqueadas. Vá em Ajustes → Notificações → Date Rate e permita."
            : "Elas estão bloqueadas. Toque no cadeado ao lado do endereço → Notificações → Permitir, e recarregue."}
        </p>
      )}
      {state === "off" && (
        <>
          <p className="mt-2 text-sm text-muted">Receba um aviso quando seu par avaliar, registrar um date ou comentar — mesmo com o app fechado.</p>
          <Button className="mt-3 w-full" loading={busy} onClick={() => run(enablePush)}>
            <Bell className="size-4" aria-hidden /> Ativar notificações
          </Button>
        </>
      )}
      {state === "on" && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            loading={busy}
            onClick={async () => {
              const r = await notify({ type: "test" });
              toast(r?.sent ? "Teste enviado 🔔" : "Não consegui enviar o teste. Confira a configuração do servidor.", r?.sent ? "ok" : "error");
            }}
          >
            Enviar teste
          </Button>
          <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => run(disablePush)}>
            Desativar
          </Button>
        </div>
      )}
    </section>
  );
}

const DISMISS_KEY = "dr-push-prompt-dismissed";

/** Convite discreto no topo do feed até a pessoa ativar ou dispensar. */
export function PushPrompt({ partnerName }: { partnerName: string | null }) {
  const [state, setState] = usePushState();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no navegador
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || !state || state === "on" || state === "unsupported" || state === "denied") return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ok */
    }
  };

  return (
    <div className="animate-page-fade relative mx-4 mb-4 rounded-2xl border border-line bg-card p-4 pr-10">
      <button onClick={dismiss} aria-label="Dispensar" className="absolute right-2 top-2 grid size-8 place-items-center text-muted">
        <X className="size-4" aria-hidden />
      </button>
      <p className="font-serif text-lg leading-tight">🔔 Saiba na hora quando {partnerName ?? "seu par"} avaliar</p>
      {state === "needs-install" ? (
        <>
          <p className="mt-1 text-sm text-muted">No iPhone, primeiro instale o app:</p>
          <InstallSteps />
        </>
      ) : (
        <Button
          className="mt-3 w-full"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const next = await enablePush();
              setState(next);
              if (next === "on") {
                await notify({ type: "test" });
                toast("Notificações ativadas! 🔔");
              }
            } catch (e) {
              toast(errorMessage(e, "Não foi possível ativar as notificações."), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Ativar notificações
        </Button>
      )}
    </div>
  );
}
