/** Tradução de erros técnicos/de banco para mensagens humanas. Nunca expor erro cru ao usuário. */

const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Sua sessão expirou. Entre novamente para continuar.",
  ACCOUNT_RESTRICTED: "Sua conta está com restrições e não pode realizar esta ação.",
  FORBIDDEN: "Você não tem permissão para fazer isso.",
  NOT_FOUND: "Não encontramos o que você procurava.",
  INVALID_STATE: "Esta ação não está mais disponível para este pedido.",
  INVALID_TRANSITION: "Esta ação não está mais disponível para este pedido.",
  INVALID_INPUT: "Alguns dados são inválidos. Revise e tente novamente.",
  REQUEST_NOT_OPEN: "Este pedido não está mais aberto.",
  OWN_REQUEST: "Você não pode se candidatar ao seu próprio pedido.",
  ALREADY_OFFERED: "Você já enviou uma proposta para este pedido.",
  ALREADY_REVIEWED: "Você já avaliou esta ajuda.",
  BLOCKED: "Não é possível interagir com este usuário.",
  RATE_LIMITED: "Você fez isso muitas vezes em pouco tempo. Aguarde um pouco e tente de novo.",
  DATE_IN_PAST: "Escolha uma data e um horário que ainda não passaram.",
  CATEGORY_INACTIVE: "Esta categoria não está disponível no momento.",
  HELPER_UNAVAILABLE: "Esta pessoa não está mais disponível.",
  TOO_MANY_DEVICES: "Você atingiu o limite de dispositivos com notificações ativas.",
};

export const GENERIC_ERROR = "Não conseguimos concluir esta ação agora. Tente novamente.";

/** Procura um código conhecido na mensagem de erro do Postgres/PostgREST. */
export function humanizeError(err: unknown): string {
  const raw = extractMessage(err);
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code];
  }
  if (/duplicate key|unique constraint/i.test(raw)) return "Este registro já existe.";
  if (/row-level security|permission denied/i.test(raw)) return MESSAGES.FORBIDDEN;
  if (/JWT|not authenticated/i.test(raw)) return MESSAGES.NOT_AUTHENTICATED;
  return GENERIC_ERROR;
}

function extractMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: unknown };
    return [e.message, e.details].filter((x): x is string => typeof x === "string").join(" ");
  }
  return "";
}

/** Log estruturado do lado do servidor. Detalhe técnico fica aqui, não na tela. */
export function logServerError(scope: string, err: unknown, extra: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ level: "error", scope, message: extractMessage(err), ...extra }));
}
