"use client";

import { ChevronDown, Hourglass, Lock, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { saveRating } from "@/lib/api";
import { notify } from "@/lib/push";
import { compareScores } from "@/lib/compare";
import { errorMessage } from "@/lib/errors";
import { formatScore } from "@/lib/format";
import { useInvalidateDates, useReactions } from "@/lib/hooks";
import type { Criteria, DateItem, Me } from "@/lib/types";
import { useToast } from "./toast";
import { Confetti } from "./confetti";
import { CriteriaInput, hasCriteria } from "./criteria";
import { ReactionBar } from "./reactions";
import { Avatar, Button, TextArea } from "./ui";

/** Cor de cada nota: frio nas baixas, vinho nas altas. */
export function scoreTone(n: number): string {
  if (n <= 3) return "#6f7f8f";
  if (n <= 5) return "#b08a62";
  if (n <= 7) return "#d9735f";
  if (n <= 9) return "#b5404c";
  return "#8c2f39";
}

function Box({
  who,
  avatar,
  tone = "wine",
  children,
  className = "",
}: {
  who: string;
  avatar?: string;
  tone?: "wine" | "coral";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-36 flex-col rounded-2xl border border-line bg-card p-4 ${className}`}>
      <div className="mb-2 flex items-center gap-2 text-[13px] text-muted">
        <Avatar name={avatar ?? who} tone={tone} />
        <span className="truncate">{who}</span>
      </div>
      {children}
    </div>
  );
}

function Locked({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-[13px] text-muted">
      {icon}
      {text}
    </div>
  );
}

function Score({ score, comment }: { score: number; comment: string | null }) {
  return (
    <>
      <div className="font-serif text-[40px] leading-none" style={{ color: scoreTone(score) }}>
        {score}
        <small className="font-sans text-base text-muted">/10</small>
      </div>
      {comment && <p className="mt-2 text-[13px] leading-snug">{comment}</p>}
    </>
  );
}

export function RatingPanel({ date, me }: { date: DateItem; me: Me }) {
  const toast = useToast();
  const invalidate = useInvalidateDates();
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState<number | null>(date.my_score);
  const [comment, setComment] = useState(date.my_comment ?? "");
  const [criteria, setCriteria] = useState<Criteria>(date.my_criteria ?? {});
  const [showCriteria, setShowCriteria] = useState(hasCriteria(date.my_criteria));
  const reactions = useReactions(date.id);
  const names: Record<string, string> = { [me.userId]: me.profile.display_name };
  if (me.partner) names[me.partner.id] = me.partner.display_name;
  const [saving, setSaving] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const [popKey, setPopKey] = useState(0);

  // anima quando a nota do par aparece enquanto a tela está aberta
  // (você acabou de avaliar ou o par avaliou agora, via tempo real)
  const [hadPartnerScore] = useState(date.partner_score != null);
  const revealed = justRevealed || (!hadPartnerScore && date.partner_score != null);

  const partnerName = me.partner?.display_name ?? "Seu par";
  const showForm = date.my_score == null || editing;

  async function submit() {
    if (score == null) return;
    setSaving(true);
    try {
      const wasHidden = date.my_score == null && date.partner_rated;
      await saveRating(date.id, me.userId, score, comment.trim() || null, showCriteria ? criteria : {});
      if (date.my_score == null) notify({ type: "rated", dateId: date.id });
      invalidate(date.id);
      setEditing(false);
      if (wasHidden) setJustRevealed(true);
      toast(date.partner_rated ? "Nota salva!" : `Nota salva! Agora é a vez de ${partnerName}.`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  let partnerBox: React.ReactNode;
  if (!me.partner) {
    partnerBox = (
      <Box who="Seu par" tone="coral">
        <Locked
          icon={<Hourglass className="size-7" aria-hidden />}
          text="Ainda não entrou no app."
        />
        <Link href="/profile" className="mt-1 text-center text-[13px] font-semibold text-wine">
          Ver código de convite
        </Link>
      </Box>
    );
  } else if (!date.partner_rated) {
    partnerBox = (
      <Box who={partnerName} tone="coral">
        <Locked icon={<Hourglass className="size-7" aria-hidden />} text="Ainda não avaliou" />
      </Box>
    );
  } else if (date.partner_score == null) {
    partnerBox = (
      <Box who={partnerName} tone="coral">
        <Locked icon={<Lock className="size-7" aria-hidden />} text="Já avaliou! A nota aparece quando você avaliar." />
      </Box>
    );
  } else {
    partnerBox = (
      <Box who={partnerName} tone="coral" className={revealed ? "animate-reveal" : ""}>
        <Score score={date.partner_score} comment={date.partner_comment} />
        {me.partner && (
          <ReactionBar
            dateId={date.id}
            kind="rating"
            targetRef={me.partner.id}
            reactions={reactions.data ?? []}
            userId={me.userId}
            names={names}
          />
        )}
      </Box>
    );
  }

  return (
    <section aria-label="Avaliações">
      <div className="grid grid-cols-2 gap-3">
        <Box who="Você" avatar={me.profile.display_name}>
          {date.my_score != null ? (
            <>
              <Score score={date.my_score} comment={date.my_comment} />
              {/* reações do par à sua nota (só aparecem depois da revelação) */}
              {date.partner_score != null && (
                <ReactionBar
                  dateId={date.id}
                  kind="rating"
                  targetRef={me.userId}
                  reactions={reactions.data ?? []}
                  userId={me.userId}
                  names={names}
                  canAdd={false}
                />
              )}
              {!editing && (
                <button
                  onClick={() => {
                    setScore(date.my_score);
                    setComment(date.my_comment ?? "");
                    setCriteria(date.my_criteria ?? {});
                    setShowCriteria(hasCriteria(date.my_criteria));
                    setEditing(true);
                  }}
                  className="mt-auto flex items-center gap-1 self-start pt-2 text-[13px] font-semibold text-wine"
                >
                  <Pencil className="size-3.5" aria-hidden /> Editar
                </button>
              )}
            </>
          ) : (
            <Locked icon={<Hourglass className="size-7" aria-hidden />} text="Ainda não avaliou" />
          )}
        </Box>
        {partnerBox}
      </div>

      {date.couple_avg != null && date.my_score != null && date.partner_score != null && (
        <Verdict
          date={date}
          mine={date.my_score}
          partner={date.partner_score}
          partnerName={partnerName}
          animate={revealed}
        />
      )}
      {revealed &&
        date.my_score != null &&
        date.partner_score != null &&
        (date.my_score === date.partner_score || (date.my_score >= 9 && date.partner_score >= 9)) && <Confetti />}

      {showForm && (
        <div className="mt-5 rounded-2xl border border-line bg-card p-4">
          <h3 className="mb-3 font-serif text-lg">{editing ? "Editar sua nota" : "Sua nota"}</h3>
          <div className="mb-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Nota de 1 a 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={score === n ? `${n}-${popKey}` : n}
                role="radio"
                aria-checked={score === n}
                onClick={() => {
                  setScore(n);
                  setPopKey((k) => k + 1);
                  navigator.vibrate?.(12);
                }}
                style={
                  score === n
                    ? { background: scoreTone(n), borderColor: scoreTone(n) }
                    : { color: scoreTone(n) }
                }
                className={`h-11 rounded-xl border text-base font-semibold transition-colors ${
                  score === n ? "animate-pop text-white" : "border-line bg-cream"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="Um comentário curto (opcional)"
          />
          <button
            type="button"
            onClick={() => setShowCriteria((v) => !v)}
            aria-expanded={showCriteria}
            className="mt-3 flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-medium text-wine"
          >
            Avaliar por critério (opcional)
            <ChevronDown className={`size-4 transition-transform ${showCriteria ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showCriteria && (
            <div className="animate-slide-down pb-1 pt-1">
              <CriteriaInput value={criteria} onChange={setCriteria} />
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {editing && (
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
            <Button className="flex-1" disabled={score == null} loading={saving} onClick={submit}>
              {editing ? "Salvar" : date.partner_rated ? "Avaliar e revelar" : "Avaliar"}
            </Button>
          </div>
          {!editing && (
            <p className="mt-2 text-center text-xs text-muted">
              {date.partner_rated
                ? `A nota de ${partnerName} aparece assim que você enviar a sua.`
                : `${partnerName} só vê sua nota depois de avaliar também.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Verdict({
  date,
  mine,
  partner,
  partnerName,
  animate,
}: {
  date: DateItem;
  mine: number;
  partner: number;
  partnerName: string;
  animate: boolean;
}) {
  const v = compareScores({ mine, partner, partnerName, seed: date.id });
  return (
    <div
      className={`mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-wine to-coral text-white ${animate ? "animate-reveal" : ""}`}
    >
      <div className="flex items-center gap-3 p-4">
        <span className="text-3xl" aria-hidden>
          {v.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg leading-tight">{v.title}</p>
          {v.detail && <p className="mt-0.5 text-sm text-white/85">{v.detail}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/20 bg-black/10 px-4 py-3">
        <span className="text-sm">Média do casal</span>
        <b className="font-serif text-[30px] leading-none">{formatScore(date.couple_avg)}</b>
      </div>
    </div>
  );
}
