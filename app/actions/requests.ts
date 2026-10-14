"use server";

import { revalidatePath } from "next/cache";
import { withUser, toAction, toVoid, parseInput } from "@/lib/actions";
import { disputeSchema, requestInputSchema, uuid } from "@/lib/validations";
import { schedulePushDispatch } from "@/lib/notifications/service";
import { notifyCompatibleHelpers } from "@/lib/notifications/match-fanout";
import * as requests from "@/services/requests";
import { listCategories } from "@/services/categories";
import type { ActionResult, RequestStatus } from "@/types";

function revalidateRequestViews(id?: string) {
  revalidatePath("/inicio");
  revalidatePath("/explorar");
  revalidatePath("/meus-pedidos");
  revalidatePath("/minhas-ajudas");
  if (id) revalidatePath(`/pedido/${id}`);
}

/** Salva rascunho (cria ou atualiza). */
export async function saveRequestAction(input: unknown, existingId?: string): Promise<ActionResult<{ id: string }>> {
  return withUser("request.save", async ({ db, userId }) => {
    const p = parseInput(requestInputSchema, input);
    if (!p.ok) return p.result;
    const r = await requests.saveRequest(db, userId, p.data, existingId);
    if (!r.ok) return toAction("request.save", r);
    revalidateRequestViews(r.data);
    return { ok: true, data: { id: r.data }, message: "Rascunho salvo." };
  });
}

/** Salva e publica (DRAFT → OPEN). Em seguida avisa os ajudantes compatíveis. */
export async function publishRequestAction(input: unknown, existingId?: string): Promise<ActionResult<{ id: string; compatible: number }>> {
  return withUser("request.publish", async ({ db, userId }) => {
    const p = parseInput(requestInputSchema, input);
    if (!p.ok) return p.result;

    const saved = await requests.saveRequest(db, userId, p.data, existingId);
    if (!saved.ok) return toAction("request.publish", saved);
    const pub = await requests.publishRequest(db, saved.data);
    if (!pub.ok) return toAction("request.publish", pub);

    const categories = await listCategories(db, { includeInactive: true });
    const categoryName = categories.find((c) => c.id === p.data.categoryId)?.name ?? "Ajuda";
    const compatible = await notifyCompatibleHelpers(saved.data, categoryName);
    schedulePushDispatch();
    revalidateRequestViews(saved.data);
    return { ok: true, data: { id: saved.data, compatible }, message: "Pedido publicado com sucesso!" };
  });
}

export async function cancelRequestAction(id: string): Promise<ActionResult> {
  return withUser("request.cancel", async ({ db }) => {
    if (!uuid.safeParse(id).success) return { ok: false, message: "Pedido inválido." };
    const r = await requests.cancelRequest(db, id);
    if (r.ok) {
      schedulePushDispatch();
      revalidateRequestViews(id);
    }
    return toAction("request.cancel", r, "Pedido cancelado.");
  });
}

export async function deleteDraftAction(id: string): Promise<ActionResult> {
  return withUser("request.deleteDraft", async ({ db }) => {
    if (!uuid.safeParse(id).success) return { ok: false, message: "Pedido inválido." };
    const r = await requests.deleteDraft(db, id);
    if (r.ok) revalidateRequestViews();
    return toAction("request.deleteDraft", r, "Rascunho excluído.");
  });
}

export async function confirmStartAction(id: string): Promise<ActionResult<{ status: RequestStatus }>> {
  return withUser("request.confirmStart", async ({ db }) => {
    if (!uuid.safeParse(id).success) return { ok: false, message: "Pedido inválido." };
    const r = await requests.confirmStart(db, id);
    if (!r.ok) return toAction("request.confirmStart", r);
    schedulePushDispatch();
    revalidateRequestViews(id);
    return {
      ok: true,
      data: { status: r.data },
      message: r.data === "IN_PROGRESS" ? "Tudo certo! A ajuda está em andamento." : "Confirmado! Aguardando a outra pessoa.",
    };
  });
}

export async function markDoneAction(id: string): Promise<ActionResult<{ status: RequestStatus }>> {
  return withUser("request.markDone", async ({ db }) => {
    if (!uuid.safeParse(id).success) return { ok: false, message: "Pedido inválido." };
    const r = await requests.markDone(db, id);
    if (!r.ok) return toAction("request.markDone", r);
    schedulePushDispatch();
    revalidateRequestViews(id);
    return {
      ok: true,
      data: { status: r.data },
      message: r.data === "COMPLETED" ? "Ajuda marcada como concluída." : "Você confirmou a conclusão. Aguardando a outra pessoa.",
    };
  });
}

export async function helperWithdrawAction(id: string): Promise<ActionResult> {
  return withUser("request.withdraw", async ({ db }) => {
    if (!uuid.safeParse(id).success) return { ok: false, message: "Pedido inválido." };
    const r = await requests.helperWithdraw(db, id);
    if (r.ok) {
      schedulePushDispatch();
      revalidateRequestViews(id);
    }
    return toAction("request.withdraw", r, "Você desistiu desta ajuda.");
  });
}

export async function reportProblemAction(input: unknown): Promise<ActionResult> {
  return withUser("request.problem", async ({ db }) => {
    const p = parseInput(disputeSchema, input);
    if (!p.ok) return p.result;
    const r = await requests.reportProblem(db, p.data.requestId, p.data.reason, p.data.description);
    if (r.ok) {
      schedulePushDispatch();
      revalidateRequestViews(p.data.requestId);
    }
    return toVoid("request.problem", r, "Relato enviado. Nossa equipe vai analisar.");
  });
}
