"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InviteCode } from "@/components/invite-code";
import { useToast } from "@/components/toast";
import { Button, Field, Input, PageHeader } from "@/components/ui";
import { signOut, updateDisplayName } from "@/lib/api";
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
      <PageHeader
        title="Perfil"
        left={
          <button onClick={() => router.back()} aria-label="Voltar" className="-ml-2 grid size-11 place-items-center text-ink">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        }
      />
      <div className="flex flex-col gap-6 px-4">
        <section className="grid grid-cols-2 gap-2">
          {stats.map(([label, value], i) => (
            <div key={label} className={`rounded-2xl border border-line bg-card p-4 ${i === 0 ? "col-span-2" : ""}`}>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 truncate font-serif text-2xl text-wine">{value}</p>
            </div>
          ))}
        </section>

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
