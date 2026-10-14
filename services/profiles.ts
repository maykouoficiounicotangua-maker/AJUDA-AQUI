import type { HelperPreferences, Profile, ProfileStats } from "@/types";
import type { Db } from "./db";

const PROFILE_COLUMNS =
  "id, full_name, avatar_url, country_code, state, city, neighborhood, bio, status, role, profile_visibility, show_rating, show_help_count, onboarding_completed, created_at";
const STATS_COLUMNS = "user_id, avg_rating, review_count, helps_completed, requests_completed, requests_total, completion_rate";
const PREFS_COLUMNS =
  "user_id, description, state, city, neighborhood, latitude, longitude, max_distance_km, accepts_paid, accepts_free, accepts_exchange, available_days, availability_start, availability_end, active";

export async function getProfile(db: Db, id: string): Promise<Profile | null> {
  const { data } = await db.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function getProfilesByIds(db: Db, ids: string[]): Promise<Map<string, Profile>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data } = await db.from("profiles").select(PROFILE_COLUMNS).in("id", unique);
  return new Map(((data as Profile[] | null) ?? []).map((p) => [p.id, p]));
}

export async function getStatsByIds(db: Db, ids: string[]): Promise<Map<string, ProfileStats>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data } = await db.from("profile_stats").select(STATS_COLUMNS).in("user_id", unique);
  return new Map(((data as ProfileStats[] | null) ?? []).map((s) => [s.user_id, s]));
}

export async function getUserCategoryIds(db: Db, userId: string): Promise<string[]> {
  const { data } = await db.from("user_categories").select("category_id").eq("user_id", userId);
  return (data ?? []).map((r: { category_id: string }) => r.category_id);
}

export async function getHelperPrefs(db: Db, userId: string): Promise<HelperPreferences | null> {
  const { data } = await db.from("helper_preferences").select(PREFS_COLUMNS).eq("user_id", userId).maybeSingle();
  return (data as HelperPreferences | null) ?? null;
}

export interface ReceivedReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
}

export async function listReviewsReceived(db: Db, userId: string, limit = 20): Promise<ReceivedReview[]> {
  const { data } = await db
    .from("reviews")
    .select("id, rating, comment, created_at, reviewer_id")
    .eq("reviewee_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as ReceivedReview[] | null) ?? [];
}

/** Telefone: a RLS só devolve para o próprio usuário ou a contraparte de uma ajuda em andamento. */
export async function getPhone(db: Db, userId: string): Promise<string | null> {
  const { data } = await db.from("profile_contacts").select("phone").eq("user_id", userId).maybeSingle();
  return (data as { phone: string | null } | null)?.phone ?? null;
}
