import { buildMessage, formatWhen } from "@/lib/notify-messages";
import { adminClient, pushConfigured, sendToUsers } from "@/lib/server/push";

const TZ = "America/Sao_Paulo";

/** yyyy-mm-dd no fuso de Brasília */
function dayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/**
 * GET /api/cron/reminders — chamado 1x por dia pela Vercel (vercel.json).
 * • "Hoje tem date!" para os planos marcados para hoje
 * • "Como foi X?" no dia seguinte, se o date ainda não foi registrado
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = adminClient();
  if (!admin || !pushConfigured()) return Response.json({ error: "push_not_configured" }, { status: 503 });

  const now = new Date();
  const today = dayKey(now);
  const from = new Date(now.getTime() - 4 * 86_400_000).toISOString();
  const to = new Date(now.getTime() + 2 * 86_400_000).toISOString();

  const { data: plans, error } = await admin
    .from("plans")
    .select("id, couple_id, place_name, scheduled_at, done_date_id, today_sent_at, followup_sent_at")
    .is("done_date_id", null)
    .gte("scheduled_at", from)
    .lte("scheduled_at", to);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const p of plans ?? []) {
    const day = dayKey(new Date(p.scheduled_at));
    const { data: members } = await admin.from("profiles").select("id").eq("couple_id", p.couple_id);
    const ids = (members ?? []).map((m) => m.id as string);

    if (day === today && !p.today_sent_at) {
      sent += await sendToUsers(admin, ids, buildMessage({ type: "plan_today", place: p.place_name, when: formatWhen(p.scheduled_at) }));
      await admin.from("plans").update({ today_sent_at: now.toISOString() }).eq("id", p.id);
    } else if (day < today && !p.followup_sent_at) {
      sent += await sendToUsers(admin, ids, buildMessage({ type: "plan_followup", place: p.place_name, planId: p.id }));
      await admin.from("plans").update({ followup_sent_at: now.toISOString() }).eq("id", p.id);
    }
  }
  return Response.json({ plans: plans?.length ?? 0, sent });
}
