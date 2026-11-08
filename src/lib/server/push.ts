import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendNotification, setVapidDetails, WebPushError } from "web-push";
import type { PushPayload } from "@/lib/notify-messages";

/** Cliente com a chave secreta: ignora RLS. Só existe no servidor. */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let vapidReady = false;
export function pushConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!vapidReady) {
    setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@example.com", pub, priv);
    vapidReady = true;
  }
  return true;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

/** Envia para todos os aparelhos das pessoas indicadas. Apaga inscrições que expiraram. */
export async function sendToUsers(admin: SupabaseClient, userIds: string[], payload: PushPayload): Promise<number> {
  if (!userIds.length || !pushConfigured()) return 0;
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error || !data?.length) return 0;

  const body = JSON.stringify(payload);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    (data as Sub[]).map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60 * 24,
          urgency: "high",
          topic: payload.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        });
        sent++;
      } catch (e) {
        // 404/410: o aparelho cancelou ou a inscrição expirou
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.id);
        else console.error("push falhou", e instanceof WebPushError ? e.statusCode : e);
      }
    }),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  return sent;
}
