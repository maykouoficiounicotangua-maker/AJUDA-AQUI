import { BadgeCheck, CalendarClock, MapPin } from "lucide-react";
import { Avatar, Badge, Card, EmptyState, Stars } from "@/components/ui/display";
import { CategoryIcon } from "@/components/requests/category-icon";
import { BADGE_LABELS, computeBadge } from "@/lib/reputation";
import { WEEKDAY_SHORT, formatRelative, formatTime } from "@/lib/utils/format";
import type { ReceivedReview } from "@/services/profiles";
import type { Category, HelperPreferences, Profile, ProfileStats } from "@/types";

export function ProfileView({
  profile, stats, categories, prefs, reviews, reviewerNames, isSelf,
}: {
  profile: Profile;
  stats: ProfileStats | null;
  categories: Category[];
  prefs: HelperPreferences | null;
  reviews: ReceivedReview[];
  reviewerNames: Map<string, string>;
  isSelf: boolean;
}) {
  const badge = computeBadge(stats);
  const rating = stats?.avg_rating != null ? Number(stats.avg_rating) : null;
  const showRating = profile.show_rating || isSelf;
  const showHelps = profile.show_help_count || isSelf;

  return (
    <div className="space-y-5">
      <Card className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{profile.full_name}</h1>
          <p className="flex items-center justify-center gap-1 text-ink-muted sm:justify-start">
            <MapPin className="size-4" aria-hidden /> {[profile.neighborhood, profile.city, profile.state].filter(Boolean).join(", ") || "Brasil"}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Badge tone={badge === "NOVO" ? "neutral" : "success"}>{badge !== "NOVO" && <BadgeCheck className="size-3" aria-hidden />} {BADGE_LABELS[badge]}</Badge>
            {showRating && rating != null && stats && stats.review_count > 0 && (
              <span className="flex items-center gap-1 text-sm"><Stars value={rating} /> {rating.toFixed(1).replace(".", ",")} ({stats.review_count})</span>
            )}
          </div>
          {profile.bio && <p className="mt-3 break-words whitespace-pre-line">{profile.bio}</p>}
        </div>
      </Card>

      {showHelps && stats && (
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Ajudas realizadas", stats.helps_completed],
            ["Pedidos concluídos", stats.requests_completed],
            ["Taxa de conclusão", stats.completion_rate != null ? `${Math.round(Number(stats.completion_rate) * 100)}%` : "—"],
          ].map(([label, value]) => (
            <Card key={String(label)} className="p-3">
              <dd className="text-2xl font-extrabold">{value}</dd>
              <dt className="text-xs text-ink-muted">{label}</dt>
            </Card>
          ))}
        </dl>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Pode ajudar com</h2>
        {categories.length === 0 ? (
          <p className="text-ink-muted">Nenhuma categoria escolhida.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800">
                <CategoryIcon name={c.icon} className="size-4" /> {c.name}
              </li>
            ))}
          </ul>
        )}
        {prefs?.active && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            <CalendarClock className="size-4" aria-hidden />
            {prefs.available_days.length === 7 ? "Todos os dias" : prefs.available_days.map((d) => WEEKDAY_SHORT[d]).join(", ")}
            {" · "}{formatTime(prefs.availability_start)}–{formatTime(prefs.availability_end)}
          </p>
        )}
        {prefs?.description && <p className="text-ink-muted">{prefs.description}</p>}
      </Card>

      <section aria-labelledby="avaliacoes" className="space-y-3">
        <h2 id="avaliacoes" className="text-lg font-bold">Avaliações recebidas</h2>
        {!showRating ? (
          <p className="text-ink-muted">Esta pessoa optou por não exibir avaliações.</p>
        ) : reviews.length === 0 ? (
          <EmptyState title="Você ainda não recebeu avaliações." description={isSelf ? "Elas aparecerão aqui depois das primeiras ajudas." : undefined} />
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id}>
                <Card className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={r.rating} />
                    <span className="text-xs text-ink-muted">{formatRelative(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="break-words">{r.comment}</p>}
                  <p className="text-sm text-ink-muted">— {reviewerNames.get(r.reviewer_id)?.split(" ")[0] ?? "Usuário"}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
