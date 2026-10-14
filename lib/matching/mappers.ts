import { cityCentroid } from "@/lib/geo/locations";
import { trustSignal } from "@/lib/reputation";
import type { HelperPreferences, HelpRequest, Profile, ProfileStats, RequestListItem } from "@/types";
import type { MatchHelper, MatchRequest } from "./types";

type RequestLike = Pick<
  HelpRequest | RequestListItem,
  "id" | "requester_id" | "category_id" | "help_type" | "state" | "city" | "neighborhood" | "public_latitude" | "public_longitude" | "scheduled_date" | "scheduled_time" | "duration_minutes"
>;

export function toMatchRequest(r: RequestLike): MatchRequest {
  const fallback = r.public_latitude == null ? cityCentroid(r.state, r.city) : null;
  return {
    id: r.id,
    requesterId: r.requester_id,
    categoryId: r.category_id,
    helpType: r.help_type,
    state: r.state,
    city: r.city,
    neighborhood: r.neighborhood,
    lat: r.public_latitude ?? fallback?.lat ?? null,
    lng: r.public_longitude ?? fallback?.lng ?? null,
    scheduledDate: r.scheduled_date,
    scheduledTime: r.scheduled_time.slice(0, 5),
    durationMinutes: r.duration_minutes,
  };
}

export function toMatchHelper(
  userId: string,
  categoryIds: string[],
  prefs: HelperPreferences | null,
  profile: Pick<Profile, "state" | "city" | "neighborhood"> | null,
  stats: Pick<ProfileStats, "avg_rating" | "review_count" | "completion_rate"> | null,
): MatchHelper {
  const state = prefs?.state ?? profile?.state ?? null;
  const city = prefs?.city ?? profile?.city ?? null;
  const centroid = prefs?.latitude == null ? cityCentroid(state, city) : null;
  return {
    userId,
    categoryIds,
    state,
    city,
    neighborhood: prefs?.neighborhood ?? profile?.neighborhood ?? null,
    lat: prefs?.latitude ?? centroid?.lat ?? null,
    lng: prefs?.longitude ?? centroid?.lng ?? null,
    maxDistanceKm: prefs?.max_distance_km ?? 15,
    acceptsPaid: prefs?.accepts_paid ?? true,
    acceptsFree: prefs?.accepts_free ?? true,
    acceptsExchange: prefs?.accepts_exchange ?? true,
    availableDays: prefs?.available_days ?? [0, 1, 2, 3, 4, 5, 6],
    availabilityStart: (prefs?.availability_start ?? "08:00").slice(0, 5),
    availabilityEnd: (prefs?.availability_end ?? "20:00").slice(0, 5),
    trust: trustSignal(stats),
  };
}
