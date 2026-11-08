import { buildMessage, formatWhen, type MessageInput } from "@/lib/notify-messages";
import { adminClient, pushConfigured, sendToUsers } from "@/lib/server/push";

/**
 * POST /api/notify — o app chama depois de uma ação (nota, date novo…).
 * O servidor confere quem é o usuário e se o item é do casal dele, monta o
 * texto a partir do banco (nunca do que o cliente mandou) e notifica o par.
 */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin || !pushConfigured()) return Response.json({ error: "push_not_configured" }, { status: 503 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data: auth } = await admin.auth.getUser(token);
  const userId = auth.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let event: { type?: string; dateId?: string; commentId?: string; wishId?: string; planId?: string };
  try {
    event = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: me } = await admin.from("profiles").select("id, couple_id, display_name").eq("id", userId).single();
  if (!me) return Response.json({ error: "no_profile" }, { status: 400 });

  // teste: manda para os aparelhos do próprio usuário
  if (event.type === "test") {
    const sent = await sendToUsers(admin, [userId], buildMessage({ type: "test" }));
    return Response.json({ sent });
  }

  if (!me.couple_id) return Response.json({ sent: 0 });
  const { data: partners } = await admin
    .from("profiles")
    .select("id")
    .eq("couple_id", me.couple_id)
    .neq("id", userId);
  const partnerIds = (partners ?? []).map((p) => p.id as string);
  if (!partnerIds.length) return Response.json({ sent: 0 });

  const actor = me.display_name as string;
  const dateOf = async (id?: string) => {
    if (!id) return null;
    const { data } = await admin.from("dates").select("id, place_name, couple_id").eq("id", id).single();
    return data && data.couple_id === me.couple_id ? data : null;
  };

  let input: MessageInput | null = null;
  switch (event.type) {
    case "date_created": {
      const d = await dateOf(event.dateId);
      if (d) input = { type: "date_created", actor, dateId: d.id, place: d.place_name };
      break;
    }
    case "rated": {
      const d = await dateOf(event.dateId);
      if (!d) break;
      const { data: theirs } = await admin
        .from("ratings")
        .select("id")
        .eq("date_id", d.id)
        .in("user_id", partnerIds)
        .limit(1);
      input = { type: "rated", actor, dateId: d.id, place: d.place_name, recipientRated: !!theirs?.length };
      break;
    }
    case "commented": {
      if (!event.commentId) break;
      const { data: c } = await admin
        .from("date_comments")
        .select("body, user_id, date_id")
        .eq("id", event.commentId)
        .single();
      const d = c && c.user_id === userId ? await dateOf(c.date_id) : null;
      if (c && d) input = { type: "commented", actor, dateId: d.id, place: d.place_name, text: c.body };
      break;
    }
    case "wish_added": {
      if (!event.wishId) break;
      const { data: w } = await admin.from("wishlist").select("place_name, couple_id").eq("id", event.wishId).single();
      if (w && w.couple_id === me.couple_id) input = { type: "wish_added", actor, place: w.place_name };
      break;
    }
    case "plan_created": {
      if (!event.planId) break;
      const { data: p } = await admin
        .from("plans")
        .select("place_name, couple_id, scheduled_at")
        .eq("id", event.planId)
        .single();
      if (p && p.couple_id === me.couple_id)
        input = { type: "plan_created", actor, place: p.place_name, when: formatWhen(p.scheduled_at) };
      break;
    }
    case "partner_joined":
      input = { type: "partner_joined", actor };
      break;
  }

  if (!input) return Response.json({ error: "unknown_event" }, { status: 400 });
  const sent = await sendToUsers(admin, partnerIds, buildMessage(input));
  return Response.json({ sent });
}
