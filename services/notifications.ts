import type { NotificationRow } from "@/types";
import { fail, ok, type Db, type ServiceResult } from "./db";

const COLUMNS = "id, type, title, body, url, read, created_at";

export async function listNotifications(db: Db, userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data } = await db
    .from("notifications")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as NotificationRow[] | null) ?? [];
}

export async function countUnreadNotifications(db: Db, userId: string): Promise<number> {
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

export async function markRead(db: Db, userId: string, id: string): Promise<ServiceResult> {
  const { error } = await db
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  return error ? fail(error) : ok(undefined);
}

export async function markAllRead(db: Db, userId: string): Promise<ServiceResult> {
  const { error } = await db
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("read", false);
  return error ? fail(error) : ok(undefined);
}

export interface NotificationPrefs {
  in_app_enabled: boolean;
  push_enabled: boolean;
  pref_matches: boolean;
  pref_messages: boolean;
  pref_offers: boolean;
  pref_requests: boolean;
  pref_reviews: boolean;
  pref_system: boolean;
}

export async function getPrefs(db: Db, userId: string): Promise<NotificationPrefs> {
  const { data } = await db
    .from("notification_preferences")
    .select("in_app_enabled, push_enabled, pref_matches, pref_messages, pref_offers, pref_requests, pref_reviews, pref_system")
    .eq("user_id", userId)
    .maybeSingle();
  return (
    (data as NotificationPrefs | null) ?? {
      in_app_enabled: true, push_enabled: true, pref_matches: true, pref_messages: true,
      pref_offers: true, pref_requests: true, pref_reviews: true, pref_system: true,
    }
  );
}

export async function updatePrefs(db: Db, userId: string, patch: Partial<NotificationPrefs>): Promise<ServiceResult> {
  const { error } = await db.from("notification_preferences").update(patch).eq("user_id", userId);
  return error ? fail(error) : ok(undefined);
}
