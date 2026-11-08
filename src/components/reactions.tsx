"use client";

import { useQueryClient } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { addReaction, removeReaction } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Reaction } from "@/lib/types";
import { useToast } from "./toast";

export const EMOJIS = ["❤️", "😂", "😮", "🥹", "👏", "🔥", "🤔", "😤"];

/** Reações com emoji num alvo (nota do par ou comentário). */
export function ReactionBar({
  dateId,
  kind,
  targetRef,
  reactions,
  userId,
  canAdd = true,
  names,
}: {
  dateId: string;
  kind: Reaction["target_kind"];
  targetRef: string;
  reactions: Reaction[];
  userId: string;
  canAdd?: boolean;
  names: Record<string, string>;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [picker, setPicker] = useState(false);
  const mine = reactions.filter((r) => r.target_kind === kind && r.target_ref === targetRef);
  const groups = new Map<string, Reaction[]>();
  mine.forEach((r) => groups.set(r.emoji, [...(groups.get(r.emoji) ?? []), r]));

  async function toggle(emoji: string) {
    setPicker(false);
    const own = mine.find((r) => r.emoji === emoji && r.user_id === userId);
    try {
      if (own) await removeReaction(own.id);
      else await addReaction({ date_id: dateId, target_kind: kind, target_ref: targetRef, emoji });
      navigator.vibrate?.(8);
      qc.invalidateQueries({ queryKey: ["reactions", dateId] });
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  if (!groups.size && !canAdd) return null;

  return (
    <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
      {[...groups.entries()].map(([emoji, list]) => {
        const byMe = list.some((r) => r.user_id === userId);
        const who = list.map((r) => (r.user_id === userId ? "você" : (names[r.user_id] ?? "seu par"))).join(" e ");
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => canAdd && toggle(emoji)}
            title={who}
            aria-label={`${emoji} de ${who}`}
            className={`animate-pop flex h-7 items-center gap-1 rounded-full border px-2 text-sm ${
              byMe ? "border-wine/40 bg-wine/10" : "border-line bg-cream"
            }`}
          >
            {emoji}
            {list.length > 1 && <span className="text-xs text-muted">{list.length}</span>}
          </button>
        );
      })}
      {canAdd && (
        <button
          type="button"
          onClick={() => setPicker((p) => !p)}
          aria-label="Reagir"
          aria-expanded={picker}
          className="grid h-7 w-8 place-items-center rounded-full border border-line text-muted"
        >
          <SmilePlus className="size-4" aria-hidden />
        </button>
      )}
      {picker && (
        <div className="animate-slide-down absolute bottom-full left-0 z-20 mb-1.5 flex gap-0.5 rounded-full border border-line bg-card p-1 shadow-lg">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => toggle(e)} className="grid size-9 place-items-center rounded-full text-lg active:scale-125">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
