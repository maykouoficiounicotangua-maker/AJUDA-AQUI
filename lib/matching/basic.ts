import { haversineKm } from "@/lib/geo/distance";
import { normalizeName } from "@/lib/geo/locations";
import type { MatchBreakdown, MatchHelper, MatchLabel, MatchRequest, MatchResult, MatchingService } from "./types";

/** Pesos configuráveis (somam 100). */
export const MATCH_WEIGHTS = {
  category: 40,
  distance: 25,
  availability: 20,
  helpType: 10,
  reputation: 5,
} as const;

export const MATCH_THRESHOLDS = { high: 75, good: 55, compatible: 35 } as const;

/**
 * Taxonomia de categorias relacionadas (parcial). Vazia no MVP: ponto de extensão.
 * Ex.: { tecnologia: ["celular"], celular: ["tecnologia"] } daria crédito parcial.
 */
export const RELATED_CATEGORY_CREDIT = 0.35;
export type CategoryTaxonomy = Record<string, string[]>;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

const dayOfWeek = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

export function labelFor(score: number): MatchLabel | null {
  if (score >= MATCH_THRESHOLDS.high) return "Alta compatibilidade";
  if (score >= MATCH_THRESHOLDS.good) return "Boa compatibilidade";
  if (score >= MATCH_THRESHOLDS.compatible) return "Compatível";
  return null;
}

export class BasicMatchingService implements MatchingService {
  constructor(private readonly taxonomy: CategoryTaxonomy = {}) {}

  private categoryScore(req: MatchRequest, h: MatchHelper): number {
    if (h.categoryIds.includes(req.categoryId)) return MATCH_WEIGHTS.category;
    const related = this.taxonomy[req.categoryId] ?? [];
    if (related.some((c) => h.categoryIds.includes(c))) return MATCH_WEIGHTS.category * RELATED_CATEGORY_CREDIT;
    return 0;
  }

  private distanceScore(req: MatchRequest, h: MatchHelper): { score: number; km: number | null } {
    const W = MATCH_WEIGHTS.distance;
    if (req.lat != null && req.lng != null && h.lat != null && h.lng != null) {
      const km = haversineKm({ lat: req.lat, lng: req.lng }, { lat: h.lat, lng: h.lng });
      if (km > h.maxDistanceKm) return { score: 0, km };
      if (km <= 3) return { score: W, km };
      // decaimento linear de 3 km até o limite escolhido pelo ajudante
      const span = Math.max(h.maxDistanceKm - 3, 1);
      return { score: W * (1 - (km - 3) / span) * 0.9 + W * 0.1, km };
    }
    // sem coordenadas: aproximação por texto
    const sameState = !!h.state && normalizeName(h.state) === normalizeName(req.state);
    const sameCity = sameState && !!h.city && normalizeName(h.city) === normalizeName(req.city);
    if (!sameCity) return { score: sameState ? W * 0.2 : 0, km: null };
    const sameHood = !!h.neighborhood && !!req.neighborhood && normalizeName(h.neighborhood) === normalizeName(req.neighborhood);
    return { score: sameHood ? W : W * 0.7, km: null };
  }

  private availabilityScore(req: MatchRequest, h: MatchHelper): number {
    const W = MATCH_WEIGHTS.availability;
    if (!h.availableDays.includes(dayOfWeek(req.scheduledDate))) return 0;
    const start = toMinutes(req.scheduledTime);
    const end = start + req.durationMinutes;
    const winStart = toMinutes(h.availabilityStart);
    const winEnd = toMinutes(h.availabilityEnd);
    if (start >= winStart && end <= winEnd) return W;
    if (start >= winStart && start < winEnd) return W * 0.6; // começa dentro, termina depois
    return W * 0.25; // dia compatível, horário fora da janela
  }

  private helpTypeScore(req: MatchRequest, h: MatchHelper): number {
    const ok =
      (req.helpType === "PAID" && h.acceptsPaid) ||
      (req.helpType === "FREE" && h.acceptsFree) ||
      (req.helpType === "EXCHANGE" && h.acceptsExchange);
    return ok ? MATCH_WEIGHTS.helpType : 0;
  }

  score(req: MatchRequest, h: MatchHelper): MatchResult {
    const dist = this.distanceScore(req, h);
    const breakdown: MatchBreakdown = {
      category: this.categoryScore(req, h),
      distance: dist.score,
      availability: this.availabilityScore(req, h),
      helpType: this.helpTypeScore(req, h),
      reputation: MATCH_WEIGHTS.reputation * Math.min(Math.max(h.trust, 0), 1),
    };
    let score = Object.values(breakdown).reduce((a, b) => a + b, 0);
    // Sem categoria E sem proximidade: não há razão para sugerir.
    if (breakdown.category === 0 && breakdown.distance === 0) score = Math.min(score, MATCH_THRESHOLDS.compatible - 1);
    // Fora do raio máximo do ajudante: nunca "alta".
    if (dist.km != null && dist.km > h.maxDistanceKm) score = Math.min(score, MATCH_THRESHOLDS.good - 1);
    score = Math.round(Math.min(Math.max(score, 0), 100));
    return { score, label: labelFor(score), breakdown, distanceKm: dist.km };
  }

  rankRequestsForHelper<R extends MatchRequest>(helper: MatchHelper, requests: R[]) {
    return requests
      .filter((r) => r.requesterId !== helper.userId)
      .map((r) => ({ ...r, match: this.score(r, helper) }))
      .sort((a, b) => b.match.score - a.match.score);
  }

  rankHelpersForRequest(request: MatchRequest, helpers: MatchHelper[]) {
    return helpers
      .filter((h) => h.userId !== request.requesterId)
      .map((h) => ({ ...h, match: this.score(request, h) }))
      .sort((a, b) => b.match.score - a.match.score);
  }
}

/** Instância padrão. Para trocar o motor, altere apenas aqui. */
export const matching: MatchingService = new BasicMatchingService();
