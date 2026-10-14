import type { Metadata } from "next";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { PageHeader } from "@/components/ui/display";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";
import { getHelperPrefs, getPhone, getUserCategoryIds } from "@/services/profiles";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function EditProfilePage() {
  const { userId, profile } = await requireUser();
  const db = await getSupabase();
  const [categories, categoryIds, prefs, phone] = await Promise.all([
    listCategories(db), getUserCategoryIds(db, userId), getHelperPrefs(db, userId), getPhone(db, userId),
  ]);
  return (
    <>
      <div className="mx-auto max-w-2xl"><PageHeader title="Editar perfil" /></div>
      <ProfileEditForm
        userId={userId}
        categories={categories}
        prefs={prefs}
        initial={{
          fullName: profile.full_name, phone: phone ?? "", bio: profile.bio ?? "", state: profile.state ?? "", city: profile.city ?? "",
          neighborhood: profile.neighborhood ?? "", categoryIds, avatarUrl: profile.avatar_url,
        }}
      />
    </>
  );
}
