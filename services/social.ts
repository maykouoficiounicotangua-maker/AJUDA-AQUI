/** Avaliações, bloqueios, denúncias e favoritos. */
import { fail, ok, type Db, type ServiceResult } from "./db";
import type { z } from "zod";
import type { reviewSchema } from "@/lib/validations";

export type ReviewInput = z.output<typeof reviewSchema>;

export async function getMyReview(db: Db, requestId: string, userId: string) {
  const { data } = await db.from("reviews").select("id, rating").eq("request_id", requestId).eq("reviewer_id", userId).maybeSingle();
  return data as { id: string; rating: number } | null;
}

export async function submitReview(db: Db, requestId: string, r: ReviewInput): Promise<ServiceResult<string>> {
  const { data, error } = await db.rpc("submit_review", {
    p_request_id: requestId,
    p_rating: r.rating,
    p_comment: r.comment ?? null,
    p_punctuality: r.punctuality ?? null,
    p_respect: r.respect ?? null,
    p_communication: r.communication ?? null,
    p_fulfillment: r.fulfillment ?? null,
  });
  return error ? fail(error) : ok(data as string);
}

// ---------- Bloqueios ----------
export async function blockUser(db: Db, blockerId: string, blockedId: string): Promise<ServiceResult> {
  const { error } = await db.from("blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
  // 23505 = já bloqueado: idempotente
  if (error && error.code !== "23505") return fail(error);
  return ok(undefined);
}

export async function unblockUser(db: Db, blockerId: string, blockedId: string): Promise<ServiceResult> {
  const { error } = await db.from("blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  return error ? fail(error) : ok(undefined);
}

export async function isBlockedByMe(db: Db, me: string, other: string): Promise<boolean> {
  const { data } = await db.from("blocks").select("id").eq("blocker_id", me).eq("blocked_id", other).maybeSingle();
  return !!data;
}

export async function listMyBlocks(db: Db): Promise<{ id: string; name: string }[]> {
  const { data } = await db.rpc("list_my_blocks");
  return ((data ?? []) as { blocked_id: string; full_name: string }[]).map((b) => ({ id: b.blocked_id, name: b.full_name }));
}

// ---------- Denúncias ----------
export async function submitReport(
  db: Db,
  p: { reportedUserId: string; reason: string; description: string; requestId?: string; conversationId?: string },
): Promise<ServiceResult<string>> {
  const { data, error } = await db.rpc("submit_report", {
    p_reported: p.reportedUserId,
    p_reason: p.reason,
    p_description: p.description,
    p_request_id: p.requestId ?? null,
    p_conversation_id: p.conversationId ?? null,
  });
  return error ? fail(error) : ok(data as string);
}

// ---------- Favoritos ----------
export type FavoriteTarget = { type: "REQUEST"; id: string } | { type: "CATEGORY"; id: string } | { type: "USER"; id: string };

const targetColumn = { REQUEST: "request_id", CATEGORY: "category_id", USER: "target_user_id" } as const;

export async function toggleFavorite(db: Db, userId: string, t: FavoriteTarget): Promise<ServiceResult<boolean>> {
  const col = targetColumn[t.type];
  const { data: existing } = await db.from("favorites").select("id").eq("user_id", userId).eq(col, t.id).maybeSingle();
  if (existing) {
    const { error } = await db.from("favorites").delete().eq("id", (existing as { id: string }).id);
    return error ? fail(error) : ok(false);
  }
  const { error } = await db.from("favorites").insert({ user_id: userId, favorite_type: t.type, [col]: t.id });
  return error ? fail(error) : ok(true);
}

export async function listFavoriteIds(db: Db, userId: string, type: FavoriteTarget["type"]): Promise<Set<string>> {
  const col = targetColumn[type];
  const { data } = await db.from("favorites").select(col).eq("user_id", userId).eq("favorite_type", type);
  return new Set(((data ?? []) as unknown as Record<string, string>[]).map((r) => r[col]));
}
