"use server";

import { revalidatePath } from "next/cache";
import { withUser, toAction, toVoid, parseInput } from "@/lib/actions";
import { offerMessageSchema, uuid } from "@/lib/validations";
import { schedulePushDispatch } from "@/lib/notifications/service";
import * as offers from "@/services/offers";
import { getProfile } from "@/services/profiles";
import type { ActionResult } from "@/types";

export async function submitOfferAction(requestId: string, input: unknown): Promise<ActionResult> {
  return withUser("offer.submit", async ({ db }) => {
    if (!uuid.safeParse(requestId).success) return { ok: false, message: "Pedido inválido." };
    const p = parseInput(offerMessageSchema, input);
    if (!p.ok) return p.result;
    const r = await offers.submitOffer(db, requestId, p.data.message);
    if (r.ok) {
      schedulePushDispatch();
      revalidatePath(`/pedido/${requestId}`);
      revalidatePath("/minhas-ajudas");
    }
    return toVoid("offer.submit", r, "Proposta enviada!");
  });
}

export async function acceptOfferAction(offerId: string, requestId: string, helperId: string): Promise<ActionResult<{ conversationId: string }>> {
  return withUser("offer.accept", async ({ db }) => {
    if (!uuid.safeParse(offerId).success) return { ok: false, message: "Proposta inválida." };
    const r = await offers.acceptOffer(db, offerId);
    if (!r.ok) return toAction("offer.accept", r);
    schedulePushDispatch();
    revalidatePath(`/pedido/${requestId}`);
    revalidatePath("/meus-pedidos");
    revalidatePath("/mensagens");
    const helper = await getProfile(db, helperId);
    return {
      ok: true,
      data: { conversationId: r.data },
      message: `Você selecionou ${helper?.full_name.split(" ")[0] ?? "a pessoa"} para esta ajuda.`,
    };
  });
}

export async function rejectOfferAction(offerId: string, requestId: string): Promise<ActionResult> {
  return withUser("offer.reject", async ({ db }) => {
    if (!uuid.safeParse(offerId).success) return { ok: false, message: "Proposta inválida." };
    const r = await offers.rejectOffer(db, offerId);
    if (r.ok) {
      schedulePushDispatch();
      revalidatePath(`/pedido/${requestId}`);
    }
    return toAction("offer.reject", r, "Proposta recusada.");
  });
}

export async function withdrawOfferAction(offerId: string, requestId: string): Promise<ActionResult> {
  return withUser("offer.withdraw", async ({ db }) => {
    if (!uuid.safeParse(offerId).success) return { ok: false, message: "Proposta inválida." };
    const r = await offers.withdrawOffer(db, offerId);
    if (r.ok) {
      revalidatePath(`/pedido/${requestId}`);
      revalidatePath("/minhas-ajudas");
    }
    return toAction("offer.withdraw", r, "Proposta retirada.");
  });
}
