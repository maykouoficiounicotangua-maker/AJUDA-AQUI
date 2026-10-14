/** Tipos de domínio. Espelham os enums/tabelas de supabase/migrations. */

export const REQUEST_STATUSES = [
  "DRAFT", "PUBLISHED", "OPEN", "ASSIGNED", "AWAITING_CONFIRMATION",
  "IN_PROGRESS", "COMPLETION_PENDING", "COMPLETED", "CANCELLED", "EXPIRED", "DISPUTED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const HELP_TYPES = ["FREE", "PAID", "EXCHANGE"] as const;
export type HelpType = (typeof HELP_TYPES)[number];

export type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED" | "DELETED";
export type UserRole = "USER" | "ADMIN" | "MODERATOR" | "SUPER_ADMIN";
export type ReportStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  active: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  country_code: string;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  bio: string | null;
  status: UserStatus;
  role: UserRole;
  profile_visibility: "PUBLIC" | "PRIVATE";
  show_rating: boolean;
  show_help_count: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface ProfileStats {
  user_id: string;
  avg_rating: number | null;
  review_count: number;
  helps_completed: number;
  requests_completed: number;
  requests_total: number;
  completion_rate: number | null;
}

export interface HelperPreferences {
  user_id: string;
  description: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  max_distance_km: number;
  accepts_paid: boolean;
  accepts_free: boolean;
  accepts_exchange: boolean;
  available_days: number[];
  availability_start: string; // HH:MM[:SS]
  availability_end: string;
  active: boolean;
}

export interface HelpRequest {
  id: string;
  requester_id: string;
  category_id: string;
  title: string;
  description: string;
  help_type: HelpType;
  amount_cents: number | null;
  exchange_description: string | null;
  state: string;
  city: string;
  neighborhood: string | null;
  public_latitude: number | null;
  public_longitude: number | null;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string; // HH:MM[:SS]
  duration_minutes: number;
  timezone: string;
  status: RequestStatus;
  selected_helper_id: string | null;
  requester_confirmed_start: boolean;
  helper_confirmed_start: boolean;
  requester_confirmed_done: boolean;
  helper_confirmed_done: boolean;
  created_at: string;
}

export interface RequestListItem extends Omit<HelpRequest, "selected_helper_id" | "requester_confirmed_start" | "helper_confirmed_start" | "requester_confirmed_done" | "helper_confirmed_done"> {
  distance_km: number | null;
}

export interface Offer {
  id: string;
  request_id: string;
  helper_id: string;
  message: string;
  status: OfferStatus;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  created_at: string;
}

export interface ActionResult<T = void> {
  ok: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string>;
}
