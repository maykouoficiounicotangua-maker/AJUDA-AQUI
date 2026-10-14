"use server";

import { revalidatePath } from "next/cache";
import { withUser, toAction, toVoid, parseInput } from "@/lib/actions";
import { chatMessageSchema, reportSchema, reviewSchema, uuid } from "@/lib/validations";
import { schedulePushDispatch } from "@/lib/notifications/service";
import * as social from "@/services/social";
import * as chat from "@/services/conversations";
import type { MessageRow } from "@/services/conversations";
import type { ActionResult } from "@/types";

export async function sendMessageAction(conversationId: string, input: unknown): Promise<ActionResult<MessageRow>> {
  return withUser("chat.send", async ({ db, userId }) => {
    if (!uuid.safeParse(conversationId).success) return { ok: false, message: "Conversa inválida." };
    const p = parseInput(chatMessageSchema, input);
    if (!p.ok) return p.result;
    const r = await chat.sendMessage(db, conversationId, userId, p.data.content);
    if (r.ok) schedulePushDispatch();
    return toAction("chat.send", r);
  });
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  await withUser("chat.read", async ({ db, userId }) => {
    if (uuid.safeParse(conversationId).success) await chat.markConversationRead(db, conversationId, userId);
    return { ok: true } as ActionResult;
  });
  revalidatePath("/mensagens");
}

export async function submitReviewAction(requestId: string, input: unknown): Promise<ActionResult> {
  return withUser("review.submit", async ({ db }) => {
    if (!uuid.safeParse(requestId).success) return { ok: false, message: "Pedido inválido." };
    const p = parseInput(reviewSchema, input);
    if (!p.ok) return p.result;
    const r = await social.submitReview(db, requestId, p.data);
    if (r.ok) {
      schedulePushDispatch();
      revalidatePath(`/pedido/${requestId}`);
      revalidatePath("/perfil");
    }
    return toVoid("review.submit", r, "Avaliação enviada. Obrigado!");
  });
}

export async function blockUserAction(blockedId: string): Promise<ActionResult> {
  return withUser("block.add", async ({ db, userId }) => {
    if (!uuid.safeParse(blockedId).success || blockedId === userId) return { ok: false, message: "Usuário inválido." };
    const r = await social.blockUser(db, userId, blockedId);
    if (r.ok) {
      revalidatePath("/mensagens");
      revalidatePath("/explorar");
      revalidatePath(`/usuario/${blockedId}`);
    }
    return toAction("block.add", r, "Usuário bloqueado. Vocês não poderão mais interagir.");
  });
}

export async function unblockUserAction(blockedId: string): Promise<ActionResult> {
  return withUser("block.remove", async ({ db, userId }) => {
    if (!uuid.safeParse(blockedId).success) return { ok: false, message: "Usuário inválido." };
    const r = await social.unblockUser(db, userId, blockedId);
    if (r.ok) revalidatePath(`/usuario/${blockedId}`);
    return toAction("block.remove", r, "Usuário desbloqueado.");
  });
}

export async function reportUserAction(input: unknown): Promise<ActionResult> {
  return withUser("report.submit", async ({ db }) => {
    const p = parseInput(reportSchema, input);
    if (!p.ok) return p.result;
    const r = await social.submitReport(db, p.data);
    if (r.ok) schedulePushDispatch();
    return toVoid("report.submit", r, "Denúncia enviada. Nossa equipe vai analisar.");
  });
}

export async function toggleFavoriteAction(type: "REQUEST" | "CATEGORY" | "USER", id: string): Promise<ActionResult<{ favorited: boolean }>> {
  return withUser("favorite.toggle", async ({ db, userId }) => {
    if (!uuid.safeParse(id).success) return { ok: false, message: "Item inválido." };
    const r = await social.toggleFavorite(db, userId, { type, id });
    if (!r.ok) return toAction("favorite.toggle", r);
    revalidatePath("/favoritos");
    return { ok: true, data: { favorited: r.data }, message: r.data ? "Adicionado aos favoritos." : "Removido dos favoritos." };
  });
}
