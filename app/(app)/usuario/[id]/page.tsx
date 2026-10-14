import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/display";
import { FavoriteButton } from "@/components/requests/favorite-button";
import { ProfileView } from "@/components/profile/profile-view";
import { UserSafety } from "@/components/profile/user-safety";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { uuid } from "@/lib/validations";
import { listCategories } from "@/services/categories";
import { getHelperPrefs, getProfile, getProfilesByIds, getStatsByIds, getUserCategoryIds, listReviewsReceived } from "@/services/profiles";
import { isBlockedByMe, listFavoriteIds } from "@/services/social";

export const metadata: Metadata = { title: "Perfil", robots: { index: false, follow: false } };

export default async function PublicProfilePage({ params }: PageProps<"/usuario/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { userId } = await requireUser();
  if (id === userId) redirect("/perfil");
  const db = await getSupabase();

  const profile = await getProfile(db, id);
  if (!profile) notFound(); // inexistente, privado ou bloqueado: mesma resposta

  const [stats, categoryIds, allCategories, prefs, reviews, blocked, favs] = await Promise.all([
    getStatsByIds(db, [id]), getUserCategoryIds(db, id), listCategories(db, { includeInactive: true }),
    getHelperPrefs(db, id), listReviewsReceived(db, id), isBlockedByMe(db, userId, id), listFavoriteIds(db, userId, "USER"),
  ]);
  const reviewers = await getProfilesByIds(db, reviews.map((r) => r.reviewer_id));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ProfileView
        profile={profile} stats={stats.get(id) ?? null} isSelf={false}
        categories={allCategories.filter((c) => categoryIds.includes(c.id))} prefs={prefs} reviews={reviews}
        reviewerNames={new Map([...reviewers].map(([rid, p]) => [rid, p.full_name]))}
      />
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Segurança</h2>
          <FavoriteButton type="USER" id={id} initial={favs.has(id)} label="Favoritar pessoa" />
        </div>
        <UserSafety userId={id} userName={profile.full_name.split(" ")[0]} blocked={blocked} />
      </Card>
    </div>
  );
}
