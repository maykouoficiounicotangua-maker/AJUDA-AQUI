/** Operações administrativas. A autorização REAL está nas RPCs (`_require_admin`) e nas políticas RLS. */
import type { ReportStatus, RequestStatus, UserStatus } from "@/types";
import { fail, ok, type Db, type ServiceResult } from "./db";

export interface AdminStats {
  users_total: number; users_active: number; users_blocked: number;
  requests_total: number; requests_open: number; requests_completed: number; requests_cancelled: number;
  helps_in_progress: number; reports_open: number; disputes_open: number;
}

export async function getStats(db: Db): Promise<AdminStats | null> {
  const { data } = await db.rpc("admin_dashboard_stats");
  return (data as AdminStats | null) ?? null;
}

export interface AdminUser {
  id: string; full_name: string; city: string | null; state: string | null;
  status: UserStatus; role: string; created_at: string;
}

const escapeLike = (s: string) => s.replace(/[%_\\]/g, "").trim();

export async function listUsers(db: Db, opts: { q?: string; status?: string; page?: number }): Promise<AdminUser[]> {
  let q = db.from("profiles").select("id, full_name, city, state, status, role, created_at").order("created_at", { ascending: false });
  if (opts.q) q = q.ilike("full_name", `%${escapeLike(opts.q)}%`);
  if (opts.status) q = q.eq("status", opts.status);
  const page = Math.max(opts.page ?? 1, 1);
  const { data } = await q.range((page - 1) * 25, page * 25 - 1);
  return (data as AdminUser[] | null) ?? [];
}

export async function setUserStatus(db: Db, userId: string, status: UserStatus, reason?: string): Promise<ServiceResult> {
  const { error } = await db.rpc("admin_set_user_status", { p_user: userId, p_status: status, p_reason: reason ?? null });
  return error ? fail(error) : ok(undefined);
}

export interface AdminRequest { id: string; title: string; status: RequestStatus; city: string; state: string; requester_id: string; created_at: string; scheduled_date: string }

export async function listRequests(db: Db, opts: { q?: string; status?: string; page?: number }): Promise<AdminRequest[]> {
  let q = db.from("help_requests").select("id, title, status, city, state, requester_id, created_at, scheduled_date").neq("status", "DRAFT").order("created_at", { ascending: false });
  if (opts.q) q = q.ilike("title", `%${escapeLike(opts.q)}%`);
  if (opts.status) q = q.eq("status", opts.status);
  const page = Math.max(opts.page ?? 1, 1);
  const { data } = await q.range((page - 1) * 25, page * 25 - 1);
  return (data as AdminRequest[] | null) ?? [];
}

export async function setRequestStatus(db: Db, id: string, status: RequestStatus, reason?: string): Promise<ServiceResult> {
  const { error } = await db.rpc("admin_set_request_status", { p_request: id, p_status: status, p_reason: reason ?? null });
  return error ? fail(error) : ok(undefined);
}

export interface AdminReport {
  id: string; reporter_id: string; reported_user_id: string; request_id: string | null; reason: string; description: string;
  status: ReportStatus; priority: number; admin_notes: string | null; created_at: string;
}

export async function listReports(db: Db, status?: string): Promise<AdminReport[]> {
  let q = db.from("reports")
    .select("id, reporter_id, reported_user_id, request_id, reason, description, status, priority, admin_notes, created_at")
    .order("priority", { ascending: true }).order("created_at", { ascending: false }).limit(50);
  if (status) q = q.eq("status", status);
  else q = q.in("status", ["OPEN", "UNDER_REVIEW"]);
  const { data } = await q;
  return (data as AdminReport[] | null) ?? [];
}

export async function resolveReport(db: Db, id: string, status: ReportStatus, notes: string, suspend: boolean): Promise<ServiceResult> {
  const { error } = await db.rpc("admin_resolve_report", { p_report: id, p_status: status, p_notes: notes || null, p_suspend_reported: suspend });
  return error ? fail(error) : ok(undefined);
}

export interface AdminDispute {
  id: string; request_id: string; opened_by: string; reason: string; description: string;
  status: ReportStatus; resolution: string | null; created_at: string;
  request: { title: string; status: string } | null;
}

export async function listDisputes(db: Db, status?: string): Promise<AdminDispute[]> {
  let q = db.from("disputes")
    .select("id, request_id, opened_by, reason, description, status, resolution, created_at, request:help_requests(title, status)")
    .order("created_at", { ascending: false }).limit(50);
  q = status ? q.eq("status", status) : q.in("status", ["OPEN", "UNDER_REVIEW"]);
  const { data } = await q;
  return (data as unknown as AdminDispute[] | null) ?? [];
}

export async function resolveDispute(db: Db, id: string, status: ReportStatus, resolution: string, outcome: "COMPLETED" | "CANCELLED" | null): Promise<ServiceResult> {
  const { error } = await db.rpc("admin_resolve_dispute", { p_dispute: id, p_status: status, p_resolution: resolution || null, p_outcome: outcome });
  return error ? fail(error) : ok(undefined);
}

export interface AuditRow { id: string; admin_id: string | null; action: string; entity_type: string; entity_id: string | null; old_data: unknown; new_data: unknown; metadata: unknown; created_at: string }

export async function listAudit(db: Db, page = 1): Promise<AuditRow[]> {
  const { data } = await db.from("audit_logs")
    .select("id, admin_id, action, entity_type, entity_id, old_data, new_data, metadata, created_at")
    .order("created_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1);
  return (data as AuditRow[] | null) ?? [];
}

export async function upsertCategory(db: Db, c: { id?: string; name: string; slug: string; icon: string; description?: string; active?: boolean }): Promise<ServiceResult> {
  const row = { name: c.name, slug: c.slug, icon: c.icon, description: c.description ?? null, ...(c.active === undefined ? {} : { active: c.active }) };
  const { error } = c.id ? await db.from("categories").update(row).eq("id", c.id) : await db.from("categories").insert(row);
  return error ? fail(error) : ok(undefined);
}

export async function setCategoryActive(db: Db, id: string, active: boolean): Promise<ServiceResult> {
  const { error } = await db.from("categories").update({ active }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}
