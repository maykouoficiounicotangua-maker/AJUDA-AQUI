import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import { findHelpersToNotify } from "@/services/matching";
import { getRequest } from "@/services/requests";
import { createInAppNotification, dispatchNow } from "./service";

const MAX_NOTIFIED = 100;

/**
 * Quando um pedido é publicado: encontra ajudantes compatíveis (motor de matching) e os avisa.
 * Só a CONTAGEM é calculada antes da resposta (o solicitante vê "Encontramos N pessoas");
 * as notificações e o push saem depois da resposta, em lote, com um único disparo de push.
 * Nunca lança: falha aqui não pode desfazer a publicação.
 */
export async function notifyCompatibleHelpers(requestId: string, categoryName: string): Promise<number> {
  if (!serverEnv().serviceRoleKey) return 0;
  try {
    const admin = createAdminClient();
    const request = await getRequest(admin, requestId);
    if (!request || request.status !== "OPEN") return 0;

    const compatible = await findHelpersToNotify(admin, request, 55);
    const where = [request.city, request.neighborhood].filter(Boolean).join(" · ");
    const targets = compatible.slice(0, MAX_NOTIFIED);

    after(async () => {
      try {
        for (const helper of targets) {
          await createInAppNotification(admin, {
            userId: helper.userId,
            type: "NEW_MATCH",
            title: helper.score >= 75 ? "Pedido que combina com você" : "Novo pedido de ajuda perto de você",
            body: `${categoryName} perto de você — ${where}.`,
            url: `/pedido/${request.id}`,
            data: { request_id: request.id },
          });
        }
        await dispatchNow(admin);
      } catch (err) {
        logServerError("matching.fanout.notify", err, { requestId });
      }
    });
    return compatible.length;
  } catch (err) {
    logServerError("matching.fanout", err, { requestId });
    return 0;
  }
}
