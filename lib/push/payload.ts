import { pushActionFor, safeInternalUrl, type NotificationType } from "@/lib/notifications/catalog";

/** Contrato do payload enviado ao Service Worker. NUNCA incluir endereço, telefone, tokens ou dado sensível. */
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  notificationId?: string;
  type?: NotificationType;
  tag?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, unknown>;
}

const MAX_TITLE = 80;
const MAX_BODY = 160;

export function buildPushPayload(n: {
  id?: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string | null;
  data?: Record<string, unknown>;
}): PushPayload {
  const action = pushActionFor(n.type);
  return {
    title: n.title.slice(0, MAX_TITLE),
    body: n.body.slice(0, MAX_BODY),
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    url: safeInternalUrl(n.url),
    notificationId: n.id,
    type: n.type,
    // agrupa notificações do mesmo tipo/recurso para não empilhar
    tag: n.id ? `${n.type}:${String(n.data?.["request_id"] ?? n.data?.["conversation_id"] ?? n.id)}` : n.type,
    actions: action ? [action] : undefined,
    // só IDs de recursos — o SW não recebe conteúdo sensível
    data: n.data ? pickSafeData(n.data) : undefined,
  };
}

const SAFE_KEYS = ["request_id", "conversation_id", "offer_id"];
function pickSafeData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([k, v]) => SAFE_KEYS.includes(k) && typeof v === "string"));
}
