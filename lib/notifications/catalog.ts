/**
 * Catálogo CENTRAL de tipos de notificação. Espelha o CHECK de public.notifications.type
 * e o mapeamento tipo → grupo de preferência de public.create_notification.
 */
export const NOTIFICATION_TYPES = [
  "NEW_MATCH", "NEW_HELP_REQUEST", "NEW_OFFER", "OFFER_ACCEPTED", "OFFER_REJECTED", "NEW_MESSAGE",
  "REQUEST_ASSIGNED", "REQUEST_STARTED", "REQUEST_COMPLETION_PENDING", "REQUEST_COMPLETED",
  "REQUEST_CANCELLED", "REQUEST_REMINDER", "NEW_REVIEW", "REPORT_CREATED", "REPORT_UPDATED", "DISPUTE_OPENED", "SYSTEM_ALERT",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type PreferenceGroup = "matches" | "messages" | "offers" | "requests" | "reviews" | "system";

export function preferenceGroup(type: NotificationType): PreferenceGroup {
  switch (type) {
    case "NEW_MATCH":
    case "NEW_HELP_REQUEST":
      return "matches";
    case "NEW_MESSAGE":
      return "messages";
    case "NEW_OFFER":
    case "OFFER_ACCEPTED":
    case "OFFER_REJECTED":
      return "offers";
    case "REQUEST_ASSIGNED":
    case "REQUEST_STARTED":
    case "REQUEST_COMPLETION_PENDING":
    case "REQUEST_COMPLETED":
    case "REQUEST_CANCELLED":
    case "REQUEST_REMINDER":
      return "requests";
    case "NEW_REVIEW":
      return "reviews";
    default:
      return "system";
  }
}

export const PREFERENCE_COLUMN: Record<PreferenceGroup, string> = {
  matches: "pref_matches", messages: "pref_messages", offers: "pref_offers",
  requests: "pref_requests", reviews: "pref_reviews", system: "pref_system",
};

export const PREFERENCE_LABELS: { column: string; label: string; hint: string }[] = [
  { column: "pref_matches", label: "Novos pedidos compatíveis", hint: "Quando surgir uma oportunidade perto de você" },
  { column: "pref_messages", label: "Mensagens", hint: "Quando alguém enviar uma mensagem" },
  { column: "pref_offers", label: "Propostas", hint: "Propostas recebidas, aceitas ou recusadas" },
  { column: "pref_requests", label: "Atualizações de pedidos", hint: "Mudanças no andamento das ajudas" },
  { column: "pref_reviews", label: "Avaliações", hint: "Quando você receber uma avaliação" },
  { column: "pref_system", label: "Avisos importantes", hint: "Segurança e comunicados da plataforma" },
];

/** Ação exibida na notificação push (máx. 1, para não poluir). */
export function pushActionFor(type: NotificationType): { action: string; title: string } | null {
  switch (type) {
    case "NEW_MATCH":
    case "NEW_HELP_REQUEST":
      return { action: "open", title: "Ver pedido" };
    case "NEW_MESSAGE":
      return { action: "open", title: "Abrir conversa" };
    case "NEW_OFFER":
    case "OFFER_ACCEPTED":
      return { action: "open", title: "Ver proposta" };
    default:
      return null;
  }
}

/** Aceita apenas caminhos internos — evita open-redirect via payload. */
export function safeInternalUrl(url: string | null | undefined, fallback = "/notificacoes"): string {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return fallback;
  return url;
}
