/**
 * Máquina de estados do pedido. ESPELHA public.request_transition_allowed (SQL).
 * O banco é a fonte da verdade; aqui servimos a UI (quais ações mostrar) e os testes.
 * tests/unit/state-machine.test.ts compara esta tabela com as RPCs.
 */
import type { HelpRequest, RequestStatus } from "@/types";

export const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  DRAFT: ["PUBLISHED", "OPEN", "CANCELLED"],
  PUBLISHED: ["OPEN", "CANCELLED"],
  OPEN: ["ASSIGNED", "CANCELLED", "EXPIRED"],
  ASSIGNED: ["AWAITING_CONFIRMATION", "OPEN", "CANCELLED"],
  AWAITING_CONFIRMATION: ["IN_PROGRESS", "OPEN", "CANCELLED"],
  IN_PROGRESS: ["COMPLETION_PENDING", "DISPUTED", "CANCELLED"],
  COMPLETION_PENDING: ["COMPLETED", "DISPUTED"],
  DISPUTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export const canTransition = (from: RequestStatus, to: RequestStatus) => TRANSITIONS[from].includes(to);
export const isTerminal = (s: RequestStatus) => TRANSITIONS[s].length === 0;

export const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  OPEN: "Aberto",
  ASSIGNED: "Ajudante escolhido",
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  IN_PROGRESS: "Em andamento",
  COMPLETION_PENDING: "Conclusão pendente",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  DISPUTED: "Em análise",
};

/** Tom visual (nunca só cor: sempre acompanha o texto do status). */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";
export const STATUS_TONE: Record<RequestStatus, StatusTone> = {
  DRAFT: "neutral", PUBLISHED: "info", OPEN: "info", ASSIGNED: "warning", AWAITING_CONFIRMATION: "warning",
  IN_PROGRESS: "info", COMPLETION_PENDING: "warning", COMPLETED: "success", CANCELLED: "neutral",
  EXPIRED: "neutral", DISPUTED: "danger",
};

export type ViewerRole = "requester" | "helper" | "other";

export function viewerRole(req: Pick<HelpRequest, "requester_id" | "selected_helper_id">, userId: string | null): ViewerRole {
  if (userId && req.requester_id === userId) return "requester";
  if (userId && req.selected_helper_id === userId) return "helper";
  return "other";
}

export type RequestAction =
  | "edit" | "publish" | "cancel" | "offer" | "confirm_start" | "mark_done" | "report_problem" | "review" | "withdraw";

/** Quais ações a UI pode oferecer. A autorização real é do banco; isto só evita botões inúteis. */
export function availableActions(
  req: Pick<HelpRequest, "status" | "requester_id" | "selected_helper_id" | "requester_confirmed_start" | "helper_confirmed_start" | "requester_confirmed_done" | "helper_confirmed_done">,
  userId: string | null,
  opts: { hasOffer?: boolean; hasReviewed?: boolean } = {},
): RequestAction[] {
  if (!userId) return [];
  const role = viewerRole(req, userId);
  const out: RequestAction[] = [];
  const s = req.status;

  if (role === "requester") {
    if (s === "DRAFT") out.push("edit", "publish", "cancel");
    if (s === "OPEN") out.push("edit", "cancel");
    if (["ASSIGNED", "AWAITING_CONFIRMATION", "IN_PROGRESS"].includes(s)) out.push("cancel");
  }
  if (role === "other" && s === "OPEN" && !opts.hasOffer) out.push("offer");

  if (role === "requester" || role === "helper") {
    const confirmedStart = role === "requester" ? req.requester_confirmed_start : req.helper_confirmed_start;
    const confirmedDone = role === "requester" ? req.requester_confirmed_done : req.helper_confirmed_done;
    if ((s === "ASSIGNED" || s === "AWAITING_CONFIRMATION") && !confirmedStart) out.push("confirm_start");
    if ((s === "IN_PROGRESS" || s === "COMPLETION_PENDING") && !confirmedDone) out.push("mark_done");
    if (s === "IN_PROGRESS" || s === "COMPLETION_PENDING") out.push("report_problem");
    if (s === "COMPLETED" && !opts.hasReviewed) out.push("review");
  }
  if (role === "helper" && (s === "ASSIGNED" || s === "AWAITING_CONFIRMATION")) out.push("withdraw");
  return out;
}
