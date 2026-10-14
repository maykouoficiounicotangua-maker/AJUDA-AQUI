/** Reputação como fator de CONFIANÇA. Sem ranking público, sem competição. */
import type { ProfileStats } from "@/types";

export type BadgeId = "NOVO" | "PARTICIPANTE" | "COLABORADOR" | "CONFIAVEL";

export const BADGE_RULES = {
  PARTICIPANTE: { minHelps: 3 },
  COLABORADOR: { minHelps: 10 },
  CONFIAVEL: { minHelps: 25, minAvgRating: 4.5 },
} as const;

export const BADGE_LABELS: Record<BadgeId, string> = {
  NOVO: "Novo",
  PARTICIPANTE: "Participante",
  COLABORADOR: "Colaborador",
  CONFIAVEL: "Confiável",
};

type StatsInput = Pick<ProfileStats, "helps_completed" | "avg_rating">;

export function computeBadge(stats: StatsInput | null | undefined): BadgeId {
  const helps = stats?.helps_completed ?? 0;
  const avg = Number(stats?.avg_rating ?? 0);
  if (helps >= BADGE_RULES.CONFIAVEL.minHelps && avg >= BADGE_RULES.CONFIAVEL.minAvgRating) return "CONFIAVEL";
  if (helps >= BADGE_RULES.COLABORADOR.minHelps) return "COLABORADOR";
  if (helps >= BADGE_RULES.PARTICIPANTE.minHelps) return "PARTICIPANTE";
  return "NOVO";
}

/** Nota 0..1 usada pelo matching como sinal de confiança. Sem avaliações => neutro (0.5). */
export function trustSignal(stats: Pick<ProfileStats, "avg_rating" | "review_count" | "completion_rate"> | null | undefined): number {
  if (!stats || !stats.review_count) return 0.5;
  const rating = Number(stats.avg_rating ?? 0) / 5;
  const completion = stats.completion_rate == null ? 1 : Number(stats.completion_rate);
  // poucas avaliações pesam menos (suavização)
  const w = Math.min(stats.review_count / 5, 1);
  return 0.5 * (1 - w) + (0.8 * rating + 0.2 * completion) * w;
}
