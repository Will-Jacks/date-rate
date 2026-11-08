"use client";

/**
 * Notificações push no navegador.
 * iPhone: só funciona com o app instalado na Tela de Início (iOS 16.4+).
 * Android: funciona no Chrome, instalado ou não.
 */
import { AppError } from "./errors";
import { supabase } from "./supabase";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export type NotifyEvent =
  | { type: "date_created"; dateId: string }
  | { type: "rated"; dateId: string }
  | { type: "commented"; commentId: string }
  | { type: "wish_added"; wishId: string }
  | { type: "plan_created"; planId: string }
  | { type: "partner_joined" }
  | { type: "test" };

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function vapidKey(): Uint8Array<ArrayBuffer> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new AppError("UNKNOWN", "As notificações ainda não foram configuradas no servidor (chave VAPID).");
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await supabase().rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent.slice(0, 200),
  });
  if (error) throw new AppError("UNKNOWN", "Não foi possível salvar a inscrição de notificações.", error);
}

/** Pede permissão e inscreve este aparelho. Precisa ser chamado a partir de um toque. */
export async function enablePush(): Promise<PushState> {
  const state = await getPushState();
  if (state === "needs-install" || state === "unsupported") return state;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() });
  }
  await saveSubscription(sub);
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}

/** Ao abrir o app: garante que a inscrição deste aparelho está ligada à conta atual. */
export async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await saveSubscription(sub);
  } catch {
    /* sem rede: tenta na próxima abertura */
  }
}

/** Avisa o servidor que algo aconteceu; ele notifica o par. Nunca quebra a ação principal. */
export async function notify(event: NotifyEvent): Promise<{ sent: number } | null> {
  try {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(event),
      keepalive: true,
    });
    if (!res.ok) return null;
    return (await res.json()) as { sent: number };
  } catch {
    return null;
  }
}
