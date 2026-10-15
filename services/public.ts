/** Leitura para VISITANTES (sem login). Só funções SECURITY DEFINER com dados mínimos — ver migration 0008. */
import type { HelpType, RequestStatus } from "@/types";
import type { Db } from "./db";

export interface PublicRequestItem {
  id: string;
  category_id: string;
  title: string;
  description: string;
  help_type: HelpType;
  amount_cents: number | null;
  exchange_description: string | null;
  state: string;
  city: string;
  neighborhood: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  timezone: string;
  status: RequestStatus;
  created_at: string;
  requester_first_name: string;
}

export interface PublicRequestDetail extends Omit<PublicRequestItem, "requester_first_name"> {
  requester_first_name: string;
  requester_avatar_url: string | null;
  requester_rating: number | null;
  requester_reviews: number;
  requester_helps: number;
}

export interface PublicFilters {
  state?: string;
  city?: string;
  neighborhood?: string;
  categoryId?: string;
  helpType?: HelpType;
  day?: "today" | "tomorrow";
  query?: string;
  sort?: "recent" | "time" | "category";
  page?: number;
  pageSize?: number;
}

export async function publicFeed(db: Db, f: PublicFilters): Promise<PublicRequestItem[]> {
  const pageSize = Math.min(f.pageSize ?? 20, 50);
  const { data, error } = await db.rpc("public_feed", {
    p_state: f.state || null,
    p_city: f.city || null,
    p_neighborhood: f.neighborhood || null,
    p_category: f.categoryId || null,
    p_help_type: f.helpType || null,
    p_day: f.day || null,
    p_query: f.query?.trim() || null,
    p_sort: f.sort ?? "recent",
    p_limit: pageSize,
    p_offset: ((f.page ?? 1) - 1) * pageSize,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", scope: "public.feed", message: error.message }));
    return [];
  }
  return (data as PublicRequestItem[] | null) ?? [];
}

export async function publicRequest(db: Db, id: string): Promise<PublicRequestDetail | null> {
  const { data, error } = await db.rpc("public_request", { p_id: id });
  if (error) return null;
  return ((data as PublicRequestDetail[] | null) ?? [])[0] ?? null;
}
