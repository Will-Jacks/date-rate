"use client";

import { useQueryClient } from "@tanstack/react-query";
import { SendHorizontal, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { addComment, deleteComment } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, useComments, useReactions } from "@/lib/hooks";
import { notify } from "@/lib/push";
import type { Me } from "@/lib/types";
import { ReactionBar } from "./reactions";
import { useToast } from "./toast";
import { Avatar } from "./ui";

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Conversa sobre o date: comentários com reações, em tempo real. */
export function Conversation({ dateId, me }: { dateId: string; me: Me }) {
  const qc = useQueryClient();
  const toast = useToast();
  const comments = useComments(dateId);
  const reactions = useReactions(dateId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // aberto por uma notificação de comentário (#conversa): rola até aqui
  const loaded = comments.isSuccess;
  useEffect(() => {
    if (loaded && window.location.hash === "#conversa") {
      document.getElementById("conversa")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loaded]);

  const names: Record<string, string> = { [me.userId]: me.profile.display_name };
  if (me.partner) names[me.partner.id] = me.partner.display_name;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const commentId = await addComment(dateId, body);
      setText("");
      notify({ type: "commented", commentId });
      qc.invalidateQueries({ queryKey: ["comments", dateId] });
      qc.invalidateQueries({ queryKey: keys.dates });
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Apagar este comentário?")) return;
    try {
      await deleteComment(id);
      qc.invalidateQueries({ queryKey: ["comments", dateId] });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <section id="conversa" className="mt-8 scroll-mt-20">
      <h2 className="mb-3 font-serif text-xl">Conversa</h2>

      {comments.data?.length ? (
        <ul className="mb-3 flex flex-col gap-3">
          {comments.data.map((c) => {
            const mine = c.user_id === me.userId;
            const name = names[c.user_id] ?? "Seu par";
            return (
              <li key={c.id} className="animate-page-fade flex gap-2.5">
                <Avatar name={name} tone={mine ? "wine" : "coral"} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl rounded-tl-md border border-line bg-card px-3.5 py-2.5">
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-muted">
                      <b className="font-semibold text-ink">{mine ? "Você" : name}</b>
                      <span>{timeAgo(c.created_at)}</span>
                      {mine && (
                        <button onClick={() => remove(c.id)} aria-label="Apagar comentário" className="ml-auto grid size-6 place-items-center">
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-snug">{c.body}</p>
                  </div>
                  <ReactionBar
                    dateId={dateId}
                    kind="comment"
                    targetRef={c.id}
                    reactions={reactions.data ?? []}
                    userId={me.userId}
                    names={names}
                    canAdd={!mine}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-muted">Nenhum comentário ainda. Que tal provocar um pouco? 😏</p>
      )}

      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) send(e);
          }}
          maxLength={1000}
          rows={1}
          placeholder={me.partner ? `Escreva para ${me.partner.display_name}…` : "Escreva um comentário…"}
          className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[16px] outline-none placeholder:text-muted/70 focus:border-wine focus:ring-2 focus:ring-wine/15"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Enviar comentário"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-wine text-white disabled:opacity-40"
        >
          <SendHorizontal className="size-5" aria-hidden />
        </button>
      </form>
    </section>
  );
}
