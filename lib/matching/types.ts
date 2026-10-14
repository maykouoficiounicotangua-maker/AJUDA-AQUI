import type { HelpType } from "@/types";

/**
 * O matching usa APENAS atributos legítimos para realizar a ajuda:
 * categoria, localização, disponibilidade, tipo de ajuda e confiança.
 * NUNCA raça, religião, gênero, orientação sexual, opinião política etc.
 */
export interface MatchRequest {
  id: string;
  requesterId: string;
  categoryId: string;
  helpType: HelpType;
  state: string;
  city: string;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  durationMinutes: number;
}

export interface MatchHelper {
  userId: string;
  categoryIds: string[];
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  maxDistanceKm: number;
  acceptsPaid: boolean;
  acceptsFree: boolean;
  acceptsExchange: boolean;
  availableDays: number[]; // 0 = domingo
  availabilityStart: string; // HH:MM
  availabilityEnd: string;
  trust: number; // 0..1 (lib/reputation.trustSignal)
}

export type MatchLabel = "Alta compatibilidade" | "Boa compatibilidade" | "Compatível";

export interface MatchBreakdown {
  category: number;
  distance: number;
  availability: number;
  helpType: number;
  reputation: number;
}

export interface MatchResult {
  score: number; // 0..100 — uso interno, nunca exibido bruto
  label: MatchLabel | null;
  breakdown: MatchBreakdown;
  distanceKm: number | null;
}

/** Contrato estável: hoje BasicMatchingService; amanhã AdvancedMatchingService / AIMatchingService. */
export interface MatchingService {
  score(request: MatchRequest, helper: MatchHelper): MatchResult;
  rankRequestsForHelper<R extends MatchRequest>(helper: MatchHelper, requests: R[]): (R & { match: MatchResult })[];
  rankHelpersForRequest(request: MatchRequest, helpers: MatchHelper[]): (MatchHelper & { match: MatchResult })[];
}
