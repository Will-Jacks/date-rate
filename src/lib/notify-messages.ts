/** Textos das notificações push (puro, sem acesso a banco — fácil de testar). */

export type PushPayload = { title: string; body: string; url: string; tag?: string };

export type MessageInput =
  | { type: "date_created"; actor: string; dateId: string; place: string }
  | { type: "rated"; actor: string; dateId: string; place: string; recipientRated: boolean }
  | { type: "commented"; actor: string; dateId: string; place: string; text: string }
  | { type: "wish_added"; actor: string; place: string }
  | { type: "plan_created"; actor: string; place: string; when: string }
  | { type: "partner_joined"; actor: string }
  | { type: "test" }
  | { type: "plan_today"; place: string; when: string }
  | { type: "plan_followup"; place: string; planId: string };

function clip(text: string, max = 90) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function buildMessage(m: MessageInput): PushPayload {
  switch (m.type) {
    case "date_created":
      return {
        title: `📸 ${m.actor} registrou um date`,
        body: `${m.place} — dê sua nota!`,
        url: `/dates/${m.dateId}`,
        tag: `date-${m.dateId}`,
      };
    case "rated":
      return {
        title: `💌 ${m.actor} avaliou ${m.place}`,
        body: m.recipientRated ? "As notas foram reveladas. Vem ver!" : "Avalie também para ver a nota.",
        url: `/dates/${m.dateId}`,
        tag: `rated-${m.dateId}`,
      };
    case "commented":
      return {
        title: `💬 ${m.actor} comentou em ${m.place}`,
        body: clip(m.text),
        url: `/dates/${m.dateId}#conversa`,
        tag: `comment-${m.dateId}`,
      };
    case "wish_added":
      return { title: `🔖 ${m.actor} quer ir em ${m.place}`, body: "Adicionado à lista “Queremos ir”.", url: "/wishlist" };
    case "plan_created":
      return { title: `📅 ${m.actor} marcou um date`, body: `${m.place} · ${m.when}`, url: "/wishlist#planos" };
    case "partner_joined":
      return { title: `💛 ${m.actor} entrou no diário!`, body: "Agora vocês já podem avaliar os dates juntos.", url: "/" };
    case "plan_today":
      return { title: "📅 Hoje tem date!", body: `${m.place} · ${m.when}`, url: "/wishlist#planos", tag: "plan-today" };
    case "plan_followup":
      return {
        title: `Como foi ${m.place}?`,
        body: "Registrem o date e deem suas notas 💛",
        url: `/dates/new?plan=${m.planId}`,
        tag: `followup-${m.planId}`,
      };
    case "test":
      return { title: "🔔 Notificações ativadas!", body: "Tudo certo: você vai receber os avisos do Date Rate aqui.", url: "/profile" };
  }
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "sáb, 15/11 às 20h" no fuso de Brasília. */
export function formatWhen(iso: string, timeZone = "America/Sao_Paulo"): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = WEEKDAYS[new Date(new Date(iso).toLocaleString("en-US", { timeZone })).getDay()];
  const hour = get("hour");
  const minute = get("minute");
  return `${wd}, ${get("day")}/${get("month")} às ${hour}h${minute !== "00" ? minute : ""}`;
}
