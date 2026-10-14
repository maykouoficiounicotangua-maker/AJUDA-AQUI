import { matching } from "@/lib/matching/basic";
import { toMatchHelper, toMatchRequest } from "@/lib/matching/mappers";
import type { MatchResult } from "@/lib/matching/types";
import type { HelperPreferences, HelpRequest, RequestListItem } from "@/types";
import type { Db } from "./db";
import { getHelperPrefs, getProfile, getStatsByIds, getUserCategoryIds } from "./profiles";
import { searchRequests } from "./requests";

export type RankedRequest = RequestListItem & { match: MatchResult };

/** Monta o perfil de ajudante do usuário (preferências + categorias + confiança). */
export async function loadHelperForUser(db: Db, userId: string) {
  const [profile, categoryIds, prefs, stats] = await Promise.all([
    getProfile(db, userId),
    getUserCategoryIds(db, userId),
    getHelperPrefs(db, userId),
    getStatsByIds(db, [userId]),
  ]);
  return { profile, categoryIds, prefs, helper: toMatchHelper(userId, categoryIds, prefs, profile, stats.get(userId) ?? null) };
}

/** Anexa o resultado de matching preservando a ordem recebida. */
export function attachMatch(helper: ReturnType<typeof toMatchHelper>, requests: RequestListItem[]): RankedRequest[] {
  return requests.map((r) => ({ ...r, match: matching.score(toMatchRequest(r), helper) }));
}

/** Anexa o matching e ordena (mais compatíveis primeiro). */
export function rankForHelper(helper: ReturnType<typeof toMatchHelper>, requests: RequestListItem[]): RankedRequest[] {
  return attachMatch(helper, requests).sort((a, b) => b.match.score - a.match.score);
}

/** "Pedidos que combinam com você" — só os que atingem algum nível de compatibilidade. */
export async function getRecommendedRequests(db: Db, userId: string, limit = 6): Promise<RankedRequest[]> {
  const { helper } = await loadHelperForUser(db, userId);
  const candidates = await searchRequests(db, {
    state: helper.state ?? undefined,
    lat: helper.lat,
    lng: helper.lng,
    sort: "recent",
    pageSize: 50,
  });
  return rankForHelper(helper, candidates)
    .filter((r) => r.match.label !== null)
    .slice(0, limit);
}

/** Candidatos a ajudar um pedido. Usa o cliente ADMIN (lê preferências de terceiros); só devolve dados mínimos. */
export async function findCompatibleHelpers(admin: Db, request: HelpRequest, minScore = 55) {
  const { data: cats } = await admin.from("user_categories").select("user_id").eq("category_id", request.category_id).limit(1000);
  const ids = [...new Set((cats ?? []).map((c: { user_id: string }) => c.user_id))].filter((id) => id !== request.requester_id);
  if (!ids.length) return [];

  const [{ data: prefsRows }, { data: profiles }, { data: blocks }] = await Promise.all([
    admin
      .from("helper_preferences")
      .select("user_id, description, state, city, neighborhood, latitude, longitude, max_distance_km, accepts_paid, accepts_free, accepts_exchange, available_days, availability_start, availability_end, active")
      .in("user_id", ids)
      .eq("active", true)
      .eq("state", request.state),
    admin.from("profiles").select("id, state, city, neighborhood, status").in("id", ids).eq("status", "ACTIVE"),
    admin.from("blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${request.requester_id},blocked_id.eq.${request.requester_id}`),
  ]);

  const blocked = new Set(
    ((blocks ?? []) as { blocker_id: string; blocked_id: string }[]).flatMap((b) => [b.blocker_id, b.blocked_id]),
  );
  const profileById = new Map(((profiles ?? []) as { id: string; state: string | null; city: string | null; neighborhood: string | null }[]).map((p) => [p.id, p]));
  const req = toMatchRequest(request);

  const helpers = ((prefsRows ?? []) as HelperPreferences[])
    .filter((p) => profileById.has(p.user_id) && !blocked.has(p.user_id))
    .map((p) => toMatchHelper(p.user_id, [request.category_id], p, profileById.get(p.user_id) ?? null, null));

  return matching.rankHelpersForRequest(req, helpers).filter((h) => h.match.score >= minScore);
}
