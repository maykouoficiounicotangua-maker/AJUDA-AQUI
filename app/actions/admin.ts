"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser, toAction, parseInput } from "@/lib/actions";
import { categorySchema, uuid } from "@/lib/validations";
import { schedulePushDispatch } from "@/lib/notifications/service";
import { getCurrentProfile, isAdminProfile } from "@/lib/auth/session";
import * as admin from "@/services/admin";
import type { Db } from "@/services/db";
import type { ActionResult } from "@/types";

/** Camada extra no servidor (além das RPCs `_require_admin` e da RLS): nega rápido quem não é admin. */
async function withAdmin<T = void>(scope: string, fn: (db: Db) => Promise<ActionResult<T>>) {
  return withUser<T>(scope, async ({ db }) => {
    if (!isAdminProfile(await getCurrentProfile())) return { ok: false, message: "Você não tem permissão para fazer isso." };
    return fn(db);
  });
}

const reason = z.string().max(500).optional();

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED" | "BLOCKED", why?: string): Promise<ActionResult> {
  return withAdmin("admin.userStatus", async (db) => {
    if (!uuid.safeParse(userId).success || !reason.safeParse(why).success) return { ok: false, message: "Dados inválidos." };
    const r = await admin.setUserStatus(db, userId, status, why);
    if (r.ok) revalidatePath("/admin/usuarios");
    const msg = status === "ACTIVE" ? "Usuário reativado." : status === "SUSPENDED" ? "Usuário suspenso." : "Usuário bloqueado.";
    return toAction("admin.userStatus", r, msg);
  });
}

export async function cancelRequestAsAdminAction(requestId: string, why?: string): Promise<ActionResult> {
  return withAdmin("admin.requestCancel", async (db) => {
    if (!uuid.safeParse(requestId).success) return { ok: false, message: "Pedido inválido." };
    const r = await admin.setRequestStatus(db, requestId, "CANCELLED", why);
    if (r.ok) {
      schedulePushDispatch();
      revalidatePath("/admin/pedidos");
    }
    return toAction("admin.requestCancel", r, "Pedido cancelado.");
  });
}

const resolveReportSchema = z.object({
  reportId: uuid, status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]), notes: z.string().max(1000).default(""), suspend: z.boolean().default(false),
});

export async function resolveReportAction(input: unknown): Promise<ActionResult> {
  return withAdmin("admin.report", async (db) => {
    const p = parseInput(resolveReportSchema, input);
    if (!p.ok) return p.result;
    const r = await admin.resolveReport(db, p.data.reportId, p.data.status, p.data.notes, p.data.suspend);
    if (r.ok) {
      schedulePushDispatch();
      revalidatePath("/admin/denuncias");
      revalidatePath("/admin");
    }
    return toAction("admin.report", r, "Denúncia atualizada.");
  });
}

const resolveDisputeSchema = z.object({
  disputeId: uuid, status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]), resolution: z.string().max(1000).default(""),
  outcome: z.enum(["COMPLETED", "CANCELLED"]).nullable().default(null),
});

export async function resolveDisputeAction(input: unknown): Promise<ActionResult> {
  return withAdmin("admin.dispute", async (db) => {
    const p = parseInput(resolveDisputeSchema, input);
    if (!p.ok) return p.result;
    const r = await admin.resolveDispute(db, p.data.disputeId, p.data.status, p.data.resolution, p.data.outcome);
    if (r.ok) {
      schedulePushDispatch();
      revalidatePath("/admin/disputas");
      revalidatePath("/admin");
    }
    return toAction("admin.dispute", r, "Disputa atualizada.");
  });
}

export async function saveCategoryAction(input: unknown, id?: string): Promise<ActionResult> {
  return withAdmin("admin.category", async (db) => {
    const p = parseInput(categorySchema, input);
    if (!p.ok) return p.result;
    const r = await admin.upsertCategory(db, { id, ...p.data });
    if (r.ok) {
      revalidatePath("/admin/categorias");
      revalidatePath("/pedido/novo");
    }
    return toAction("admin.category", r, id ? "Categoria atualizada." : "Categoria criada.");
  });
}

export async function setCategoryActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return withAdmin("admin.categoryActive", async (db) => {
    if (!uuid.safeParse(id).success) return { ok: false, message: "Categoria inválida." };
    const r = await admin.setCategoryActive(db, id, active);
    if (r.ok) revalidatePath("/admin/categorias");
    return toAction("admin.categoryActive", r, active ? "Categoria ativada." : "Categoria desativada.");
  });
}
