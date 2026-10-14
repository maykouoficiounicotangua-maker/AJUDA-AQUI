import "server-only";
import webpush from "web-push";
import { isPushConfigured, serverEnv } from "@/lib/env";
import type { PushPayload } from "./payload";

type PushEvent =
  | "push_send_started" | "push_send_success" | "push_send_failed"
  | "push_subscription_created" | "push_subscription_removed" | "push_subscription_invalidated"
  | "push_permission_denied";

/** Log estruturado. Só IDs e códigos — nunca chaves VAPID, `auth`/`p256dh` nem conteúdo da mensagem. */
export function logPush(event: PushEvent, fields: Record<string, unknown> = {}) {
  const safe = { ...fields };
  delete (safe as Record<string, unknown>).auth;
  delete (safe as Record<string, unknown>).p256dh;
  delete (safe as Record<string, unknown>).privateKey;
  console.log(JSON.stringify({ level: event.endsWith("failed") ? "warn" : "info", scope: "push", event, ...safe }));
}

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!isPushConfigured()) return false;
  const e = serverEnv();
  webpush.setVapidDetails(e.vapidSubject, e.vapidPublicKey, e.vapidPrivateKey);
  configured = true;
  return true;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type SendOutcome = { ok: true } | { ok: false; gone: boolean; status?: number };

/** Envia um push. `gone` = endpoint expirado/inválido (404/410): a assinatura deve ser desativada. */
export async function sendWebPush(sub: StoredSubscription, payload: PushPayload): Promise<SendOutcome> {
  if (!ensureConfigured()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: "normal" },
    );
    return { ok: true };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return { ok: false, gone: status === 404 || status === 410, status };
  }
}
