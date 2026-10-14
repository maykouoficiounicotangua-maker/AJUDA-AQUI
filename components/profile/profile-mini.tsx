import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { Avatar, Badge, Stars } from "@/components/ui/display";
import { BADGE_LABELS, computeBadge } from "@/lib/reputation";
import type { Profile, ProfileStats } from "@/types";

/** Perfil resumido: foto, nome, avaliação, nº de ajudas/pedidos e selo (sem ranking). */
export function ProfileMini({
  profile,
  stats,
  link = true,
  extra,
}: {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url" | "city" | "neighborhood" | "show_rating" | "show_help_count">;
  stats?: ProfileStats | null;
  link?: boolean;
  extra?: React.ReactNode;
}) {
  const badge = computeBadge(stats);
  const rating = stats?.avg_rating != null ? Number(stats.avg_rating) : null;
  const body = (
    <div className="flex items-center gap-3">
      <Avatar name={profile.full_name} src={profile.avatar_url} size={52} />
      <div className="min-w-0">
        <p className="truncate font-bold">{profile.full_name}</p>
        <p className="flex items-center gap-1 text-sm text-ink-muted">
          <MapPin className="size-3.5" aria-hidden />
          {[profile.neighborhood, profile.city].filter(Boolean).join(", ") || "Brasil"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {rating != null && stats && stats.review_count > 0 ? (
            <span className="flex items-center gap-1"><Stars value={rating} /> <span className="text-ink-muted">({stats.review_count})</span></span>
          ) : (
            <span className="text-ink-muted">Sem avaliações ainda</span>
          )}
          {stats && stats.helps_completed > 0 && <span className="text-ink-muted">{stats.helps_completed} {stats.helps_completed === 1 ? "ajuda" : "ajudas"}</span>}
          {stats && stats.requests_completed > 0 && <span className="text-ink-muted">{stats.requests_completed} {stats.requests_completed === 1 ? "pedido" : "pedidos"}</span>}
          <Badge tone={badge === "NOVO" ? "neutral" : "success"}>
            {badge !== "NOVO" && <BadgeCheck className="size-3" aria-hidden />} {BADGE_LABELS[badge]}
          </Badge>
        </div>
      </div>
    </div>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {link ? <Link href={`/usuario/${profile.id}`} className="min-w-0 rounded-xl">{body}</Link> : body}
      {extra}
    </div>
  );
}
