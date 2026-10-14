import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured, serverEnv } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { buildPushPayload } from "@/lib/push/payload";
import { logPush, sendWebPush, type StoredSubscription } from "@/lib/push/server";
import { PREFERENCE_COLUMN, preferenceGroup, type NotificationType } from "./catalog";

type Admin = ReturnType<typeof createAdminClient>;

interface PendingRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  data: Record<string, unknown> | null;
}

/**
 * Processa a fila de push (notifications.push_status = 'PENDING').
 * A notificação INTERNA já existe; aqui só tentamos entregar o push. Falhas nunca desfazem a interna.
 */
export async function dispatchPendingPush(admin: Admin, limit = 50): Promise<{ claimed: number; sent: number }> {
  const { data: claimed, error } = await admin.rpc("claim_pending_push", { p_limit: limit });
  if (error) {
    logServerError("push.claim", error);
    return { claimed: 0, sent: 0 };
  }
  const rows = (claimed as PendingRow[] | null) ?? [];
  let sent = 0;

  for (const n of rows) {
    const status = await deliver(admin, n);
    if (status === "SENT") sent++;
    await admin
      .from("notifications")
      .update({ push_status: status, push_sent_at: status === "SENT" ? new Date().toISOString() : null })
      .eq("id", n.id);
  }
  return { claimed: rows.length, sent };
}

async function deliver(admin: Admin, n: PendingRow): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  if (!isPushConfigured()) return "SKIPPED";

  // Preferências ANTES de enviar (push desligado ou grupo desligado => não envia)
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("push_enabled, pref_matches, pref_messages, pref_offers, pref_requests, pref_reviews, pref_system")
    .eq("user_id", n.user_id)
    .maybeSingle();
  const column = PREFERENCE_COLUMN[preferenceGroup(n.type)];
  const p = prefs as Record<string, boolean> | null;
  if (p && (!p.push_enabled || p[column] === false)) return "SKIPPED";

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", n.user_id)
    .eq("is_active", true);
  const subscriptions = (subs as StoredSubscription[] | null) ?? [];
  if (!subscriptions.length) return "SKIPPED";

  const payload = buildPushPayload({ id: n.id, type: n.type, title: n.title, body: n.body, url: n.url, data: n.data ?? undefined });
  logPush("push_send_started", { notificationId: n.id, userId: n.user_id, devices: subscriptions.length });

  let anyOk = false;
  for (const sub of subscriptions) {
    const res = await sendWebPush(sub, payload);
    if (res.ok) {
      anyOk = true;
      logPush("push_send_success", { notificationId: n.id, subscriptionId: sub.id });
      await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
    } else {
      logPush("push_send_failed", { notificationId: n.id, subscriptionId: sub.id, status: res.status, gone: res.gone });
      if (res.gone) {
        // endpoint expirado: desativa e não tenta mais
        await admin.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
        logPush("push_subscription_invalidated", { subscriptionId: sub.id, userId: n.user_id });
      }
    }
  }
  return anyOk ? "SENT" : "FAILED";
}

/**
 * Agenda a entrega de push para DEPOIS da resposta ao usuário (não atrasa a ação).
 * Silencioso se o serviço não estiver configurado.
 */
export function schedulePushDispatch() {
  if (!isPushConfigured() || !serverEnv().serviceRoleKey) return;
  after(async () => {
    try {
      await dispatchPendingPush(createAdminClient(), 50);
    } catch (err) {
      logServerError("push.dispatch", err);
    }
  });
}

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Fachada única: 1) cria a notificação interna (respeitando preferências) 2) agenda o push.
 * Para eventos disparados pelo servidor (ex.: fan-out de matching). Eventos de fluxo (proposta, mensagem…)
 * já criam a notificação dentro das RPCs transacionais; basta chamar schedulePushDispatch() depois.
 */
/** Só cria a notificação interna (respeitando preferências). Não agenda push — use para lotes. */
export async function createInAppNotification(admin: Admin, input: NotifyInput): Promise<string | null> {
  const { data, error } = await admin.rpc("create_notification", {
    p_user: input.userId,
    p_type: input.type,
    p_title: input.title,
    p_body: input.body,
    p_url: input.url ?? null,
    p_data: input.data ?? {},
  });
  if (error) {
    logServerError("notification.create", error, { type: input.type });
    return null;
  }
  return (data as string | null) ?? null;
}

/** Envia o push pendente imediatamente (para uso dentro de um `after()` já agendado). */
export async function dispatchNow(admin: Admin) {
  if (!isPushConfigured()) return;
  try {
    await dispatchPendingPush(admin, 100);
  } catch (err) {
    logServerError("push.dispatch", err);
  }
}

/**
 * Fachada única: 1) cria a notificação interna (respeitando preferências) 2) agenda o push.
 * Para eventos disparados pelo servidor. Eventos de fluxo (proposta, mensagem…) já criam a
 * notificação dentro das RPCs transacionais; basta chamar schedulePushDispatch() depois.
 */
export const NotificationService = {
  async notify(input: NotifyInput): Promise<string | null> {
    const id = await createInAppNotification(createAdminClient(), input);
    if (id) schedulePushDispatch();
    return id;
  },
};
