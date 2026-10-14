import { cityCentroid } from "@/lib/geo/locations";
import { toPublicCoords } from "@/lib/geo/distance";
import type { RequestInput } from "@/lib/validations";
import type { HelpRequest, RequestListItem, RequestStatus } from "@/types";
import { fail, ok, type Db, type ServiceResult } from "./db";

export const REQUEST_COLUMNS =
  "id, requester_id, category_id, title, description, help_type, amount_cents, exchange_description, state, city, neighborhood, public_latitude, public_longitude, scheduled_date, scheduled_time, duration_minutes, timezone, status, selected_helper_id, requester_confirmed_start, helper_confirmed_start, requester_confirmed_done, helper_confirmed_done, created_at";

export async function getRequest(db: Db, id: string): Promise<HelpRequest | null> {
  const { data } = await db.from("help_requests").select(REQUEST_COLUMNS).eq("id", id).maybeSingle();
  return (data as HelpRequest | null) ?? null;
}

/** Endereço exato: a RLS só libera ao dono e ao ajudante que já confirmou. */
export async function getRequestPrivate(db: Db, id: string): Promise<{ address: string | null; notes: string | null } | null> {
  const { data } = await db.from("help_request_private").select("address, notes").eq("request_id", id).maybeSingle();
  return (data as { address: string | null; notes: string | null } | null) ?? null;
}

export type MyRequestGroup = "active" | "completed" | "cancelled" | "expired" | "draft";
const GROUP_STATUSES: Record<MyRequestGroup, RequestStatus[]> = {
  draft: ["DRAFT"],
  active: ["PUBLISHED", "OPEN", "ASSIGNED", "AWAITING_CONFIRMATION", "IN_PROGRESS", "COMPLETION_PENDING", "DISPUTED"],
  completed: ["COMPLETED"],
  cancelled: ["CANCELLED"],
  expired: ["EXPIRED"],
};

export async function listMyRequests(db: Db, userId: string, group: MyRequestGroup, limit = 30): Promise<HelpRequest[]> {
  const { data } = await db
    .from("help_requests")
    .select(REQUEST_COLUMNS)
    .eq("requester_id", userId)
    .in("status", GROUP_STATUSES[group])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as HelpRequest[] | null) ?? [];
}

/** Pedidos em que o usuário foi o ajudante selecionado. */
export async function listHelpsAsHelper(db: Db, userId: string, group: "active" | "completed" | "cancelled"): Promise<HelpRequest[]> {
  const { data } = await db
    .from("help_requests")
    .select(REQUEST_COLUMNS)
    .eq("selected_helper_id", userId)
    .in("status", GROUP_STATUSES[group])
    .order("scheduled_date", { ascending: false })
    .limit(30);
  return (data as HelpRequest[] | null) ?? [];
}

export interface SearchFilters {
  state?: string;
  city?: string;
  neighborhood?: string;
  categoryId?: string;
  helpType?: "FREE" | "PAID" | "EXCHANGE";
  day?: "today" | "tomorrow";
  maxKm?: number;
  query?: string;
  sort?: "recent" | "nearest" | "time" | "category";
  lat?: number | null;
  lng?: number | null;
  page?: number;
  pageSize?: number;
}

/** Busca paginada e filtrada NO SERVIDOR (RPC search_requests; RLS decide o que é visível). */
export async function searchRequests(db: Db, f: SearchFilters): Promise<RequestListItem[]> {
  const pageSize = Math.min(f.pageSize ?? 20, 50);
  const { data, error } = await db.rpc("search_requests", {
    p_state: f.state || null,
    p_city: f.city || null,
    p_neighborhood: f.neighborhood || null,
    p_category: f.categoryId || null,
    p_help_type: f.helpType || null,
    p_day: f.day || null,
    p_lat: f.lat ?? null,
    p_lng: f.lng ?? null,
    p_max_km: f.maxKm ?? null,
    p_query: f.query?.trim() || null,
    p_sort: f.sort ?? "recent",
    p_limit: pageSize,
    p_offset: ((f.page ?? 1) - 1) * pageSize,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", scope: "requests.search", message: error.message }));
    return [];
  }
  return (data as RequestListItem[] | null) ?? [];
}

/** Rascunho/edição. Coordenada pública = centróide da cidade (nunca o endereço). */
export async function saveRequest(
  db: Db,
  userId: string,
  input: RequestInput,
  existingId?: string,
): Promise<ServiceResult<string>> {
  const centroid = cityCentroid(input.state, input.city);
  const pub = centroid ? toPublicCoords(centroid) : null;
  const row = {
    category_id: input.categoryId,
    title: input.title,
    description: input.description,
    help_type: input.helpType,
    amount_cents: input.helpType === "PAID" ? (input.amountCents ?? null) : null,
    exchange_description: input.helpType === "EXCHANGE" ? (input.exchangeDescription ?? null) : null,
    state: input.state,
    city: input.city,
    neighborhood: input.neighborhood ?? null,
    public_latitude: pub?.lat ?? null,
    public_longitude: pub?.lng ?? null,
    scheduled_date: input.scheduledDate,
    scheduled_time: input.scheduledTime,
    duration_minutes: input.durationMinutes,
  };

  let id = existingId;
  if (id) {
    const { error } = await db.from("help_requests").update(row).eq("id", id);
    if (error) return fail(error);
  } else {
    const { data, error } = await db.from("help_requests").insert({ ...row, requester_id: userId }).select("id").single();
    if (error || !data) return fail(error);
    id = (data as { id: string }).id;
  }

  const { error: privErr } = await db
    .from("help_request_private")
    .upsert({ request_id: id, address: input.address ?? null }, { onConflict: "request_id" });
  if (privErr) return fail(privErr);
  return ok(id!);
}

export async function publishRequest(db: Db, id: string): Promise<ServiceResult> {
  const { error } = await db.rpc("publish_request", { p_request_id: id });
  return error ? fail(error) : ok(undefined);
}

export async function cancelRequest(db: Db, id: string): Promise<ServiceResult> {
  const { error } = await db.rpc("cancel_request", { p_request_id: id });
  return error ? fail(error) : ok(undefined);
}

export async function deleteDraft(db: Db, id: string): Promise<ServiceResult> {
  const { error } = await db.from("help_requests").delete().eq("id", id).eq("status", "DRAFT");
  return error ? fail(error) : ok(undefined);
}

export async function confirmStart(db: Db, id: string): Promise<ServiceResult<RequestStatus>> {
  const { data, error } = await db.rpc("confirm_start", { p_request_id: id });
  return error ? fail(error) : ok(data as RequestStatus);
}

export async function markDone(db: Db, id: string): Promise<ServiceResult<RequestStatus>> {
  const { data, error } = await db.rpc("mark_done", { p_request_id: id });
  return error ? fail(error) : ok(data as RequestStatus);
}

export async function helperWithdraw(db: Db, id: string): Promise<ServiceResult> {
  const { error } = await db.rpc("helper_withdraw", { p_request_id: id });
  return error ? fail(error) : ok(undefined);
}

export async function reportProblem(db: Db, id: string, reason: string, description: string): Promise<ServiceResult<string>> {
  const { data, error } = await db.rpc("report_problem", { p_request_id: id, p_reason: reason, p_description: description });
  return error ? fail(error) : ok(data as string);
}
