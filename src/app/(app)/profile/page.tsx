"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogOut, Map as MapIcon, Sparkles, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InviteCode } from "@/components/invite-code";
import { PushSettings } from "@/components/push-settings";
import { useToast } from "@/components/toast";
import { BudgetCard, Medals, StreakCard } from "@/components/us-widgets";
import { Avatar, Button, Field, Input, PageHeader } from "@/components/ui";
import { leaveCouple, signOut, updateDisplayName } from "@/lib/api";
import { categoryInfo } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { formatCost, formatScore } from "@/lib/format";
import { keys, useCurrentMe, useDates } from "@/lib/hooks";

export default function ProfilePage() {
  const router = useRouter();
  const me = useCurrentMe();
  const dates = useDates();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(me.profile.display_name);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    const code = me.couple.invite_code;
    const ok = window.confirm(
      `Sair do casal?

Você deixa de ver os dates deste diário e poderá entrar em outro com um novo código. ` +
        `Nada é apagado: para voltar, use o código ${code}.`,
    );
    if (!ok) return;
    setLeaving(true);
    try {
      await leaveCouple();
      qc.clear();
      router.replace("/onboarding");
    } catch (err) {
      toast(errorMessage(err), "error");
      setLeaving(false);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateDisplayName(me.userId, name.trim());
      await qc.invalidateQueries({ queryKey: keys.me(me.userId) });
      toast("Nome atualizado.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  // Estatísticas simples a partir do feed
  const list = dates.data ?? [];
  const rated = list.filter((d) => d.couple_avg != null);
  const avg = rated.length ? rated.reduce((s, d) => s + d.couple_avg!, 0) / rated.length : null;
  const best = rated.reduce<(typeof rated)[number] | null>((b, d) => (!b || d.couple_avg! > b.couple_avg! ? d : b), null);
  const spent = list.reduce((s, d) => s + (d.cost ?? 0), 0);
  const catCount = new Map<string, number>();
  list.forEach((d) => catCount.set(d.category, (catCount.get(d.category) ?? 0) + 1));
  const topCat = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const stats: [string, string][] = [
    ["Dates", String(list.length)],
    ["Média do casal", formatScore(avg)],
    ["Melhor date", best ? best.place_name : "–"],
    ["Tipo favorito", topCat ? categoryInfo(topCat).label : "–"],
    ["Total gasto", spent ? formatCost(spent) : "–"],
  ];

  return (
    <>
      <PageHeader title="Nós" />
      <div className="flex flex-col gap-5 px-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <Avatar name={me.profile.display_name} big className="ring-2 ring-cream" />
            {me.partner && <Avatar name={me.partner.display_name} tone="coral" big className="ring-2 ring-cream" />}
          </div>
          <p className="font-serif text-xl leading-tight">
            {me.profile.display_name}
            {me.partner ? ` & ${me.partner.display_name}` : ""}
          </p>
        </div>

        <Link
          href="/retro"
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#4b2f6c] via-[#8c2f39] to-[#e0796b] p-4 text-white shadow-[0_8px_24px_rgba(75,47,108,.3)]"
        >
          <Sparkles className="size-7 shrink-0" aria-hidden />
          <span className="flex-1">
            <span className="block font-serif text-xl leading-tight">Retrospectiva {new Date().getFullYear()}</span>
            <span className="text-sm text-white/85">O ano de vocês em dates</span>
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>

        <section className="grid grid-cols-2 gap-2">
          {stats.map(([label, value], i) => (
            <div key={label} className={`rounded-2xl border border-line bg-card p-4 ${i === 0 ? "col-span-2" : ""}`}>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 truncate font-serif text-2xl text-wine">{value}</p>
            </div>
          ))}
        </section>

        <StreakCard dates={list} />
        <BudgetCard dates={list} me={me} />
        <Medals dates={list} />

        <Link href="/map" className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
          <MapIcon className="size-5 text-wine" aria-hidden />
          <span className="flex-1 font-medium">Mapa dos nossos dates</span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>

        <h2 className="mt-2 font-serif text-xl">Ajustes</h2>
        <PushSettings />

        <form onSubmit={saveName} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <Field label="Seu nome" hint={me.email}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </Field>
          <Button type="submit" variant="secondary" loading={saving} disabled={name.trim() === me.profile.display_name || !name.trim()}>
            Salvar nome
          </Button>
        </form>

        <section className="rounded-2xl border border-line bg-card p-4">
          {me.partner ? (
            <p>
              Diário de <b>{me.profile.display_name}</b> & <b>{me.partner.display_name}</b> 💛
            </p>
          ) : (
            <>
              <h2 className="font-serif text-lg">Convide seu par</h2>
              <p className="mb-3 mt-1 text-sm text-muted">
                A pessoa cria uma conta, escolhe “Tenho um código” e digita:
              </p>
              <InviteCode code={me.couple.invite_code} />
            </>
          )}
          <button
            onClick={leave}
            disabled={leaving}
            className="mt-4 flex min-h-10 items-center gap-1.5 text-sm font-semibold text-muted disabled:opacity-50"
          >
            <UserMinus className="size-4" aria-hidden />
            {leaving ? "Saindo…" : "Sair do casal"}
          </button>
        </section>

        <Button
          variant="danger"
          onClick={async () => {
            try {
              await signOut();
              router.replace("/login");
            } catch (e) {
              toast(errorMessage(e), "error");
            }
          }}
        >
          <LogOut className="size-4" aria-hidden /> Sair
        </Button>
      </div>
    </>
  );
}
