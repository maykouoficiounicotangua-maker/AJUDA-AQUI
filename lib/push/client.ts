"use client";
/** Camada única de Push no navegador. Componentes NÃO falam com a Push API diretamente. */

export type PushPermission = NotificationPermission | "unsupported";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone/iPad só recebem Web Push com o app instalado na Tela de Início (iOS 16.4+). */
export function needsIOSInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return isIOS && !standalone;
}

export function getNotificationPermission(): PushPermission {
  return isPushSupported() ? Notification.permission : "unsupported";
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** Só deve ser chamado a partir de um clique do usuário (nunca ao carregar a página). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker();
  if (!reg) return null;
  await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "not-configured" | "server" | "error"; message: string };

export async function subscribeToPush(publicKey: string): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported", message: "Este navegador não suporta notificações." };
  if (!publicKey) return { ok: false, reason: "not-configured", message: "Notificações ainda não estão disponíveis." };

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "denied", message: "Você bloqueou as notificações. Libere nas configurações do navegador." };
  }
  try {
    const reg = await registerServiceWorker();
    if (!reg) return { ok: false, reason: "error", message: "Não conseguimos preparar as notificações." };
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const subscription =
      existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, reason: "server", message: body?.message ?? "Não conseguimos ativar agora. Tente novamente." };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "error", message: "Não conseguimos ativar agora. Tente novamente." };
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const sub = await getCurrentPushSubscription();
    if (!sub) return true;
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    return true;
  } catch {
    return false;
  }
}
