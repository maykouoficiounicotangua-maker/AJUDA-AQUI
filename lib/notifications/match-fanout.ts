import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { findCompatibleHelpers } from "@/services/matching";
import { getRequest } from "@/services/requests";
import { NotificationService } from "./service";

const MAX_NOTIFIED = 20;

/**
 * Quando um pedido é publicado: encontra ajudantes compatíveis (motor de matching) e os avisa.
 * Retorna quantas pessoas são compatíveis (somente o NÚMERO — nunca quem são — vai ao solicitante).
 * Nunca lança: falha aqui não pode desfazer a publicação.
 */
export async function notifyCompatibleHelpers(requestId: string, categoryName: string): Promise<number> {
  if (!serverEnv().serviceRoleKey) return 0;
  try {
    const admin = createAdminClient();
    const request = await getRequest(admin, requestId);
    if (!request || request.status !== "OPEN") return 0;

    const compatible = await findCompatibleHelpers(admin, request, 55);
    const where = [request.city, request.neighborhood].filter(Boolean).join(" · ");
    for (const helper of compatible.slice(0, MAX_NOTIFIED)) {
      await NotificationService.notify({
        userId: helper.userId,
        type: "NEW_MATCH",
        title: "Nova oportunidade de ajuda",
        body: `${categoryName} perto de você — ${where}.`,
        url: `/pedido/${request.id}`,
        data: { request_id: request.id },
      });
    }
    return compatible.length;
  } catch (err) {
    logServerError("matching.fanout", err, { requestId });
    return 0;
  }
}
