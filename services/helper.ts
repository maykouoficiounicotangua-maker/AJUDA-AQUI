import { cityCentroid } from "@/lib/geo/locations";
import type { z } from "zod";
import type { helperPrefsSchema, profileUpdateSchema, privacySchema } from "@/lib/validations";
import { fail, ok, type Db, type ServiceResult } from "./db";

type ProfileUpdate = z.output<typeof profileUpdateSchema>;
type HelperPrefsInput = z.output<typeof helperPrefsSchema>;
type PrivacyInput = z.output<typeof privacySchema>;

/** Atualiza perfil, telefone e categorias (substitui o conjunto). */
export async function updateProfile(db: Db, userId: string, v: ProfileUpdate): Promise<ServiceResult> {
  const { error } = await db
    .from("profiles")
    .update({
      full_name: v.fullName,
      bio: v.bio ?? null,
      state: v.state,
      city: v.city,
      neighborhood: v.neighborhood ?? null,
    })
    .eq("id", userId);
  if (error) return fail(error);

  if (v.phone !== undefined) {
    const { error: pe } = await db.from("profile_contacts").update({ phone: v.phone || null }).eq("user_id", userId);
    if (pe) return fail(pe);
  }

  // Categorias: remove as que saíram e insere as novas (sem apagar tudo e recriar)
  const { data: current } = await db.from("user_categories").select("category_id").eq("user_id", userId);
  const have = new Set((current ?? []).map((c: { category_id: string }) => c.category_id));
  const want = new Set(v.categoryIds);
  const toRemove = [...have].filter((id) => !want.has(id));
  const toAdd = [...want].filter((id) => !have.has(id));
  if (toRemove.length) {
    const { error: re } = await db.from("user_categories").delete().eq("user_id", userId).in("category_id", toRemove);
    if (re) return fail(re);
  }
  if (toAdd.length) {
    const { error: ae } = await db.from("user_categories").insert(toAdd.map((category_id) => ({ user_id: userId, category_id })));
    if (ae) return fail(ae);
  }
  return ok(undefined);
}

export async function saveHelperPrefs(
  db: Db,
  userId: string,
  location: { state: string | null; city: string | null; neighborhood: string | null },
  v: HelperPrefsInput,
): Promise<ServiceResult> {
  const c = cityCentroid(location.state, location.city);
  const { error } = await db.from("helper_preferences").upsert(
    {
      user_id: userId,
      description: v.description ?? null,
      state: location.state,
      city: location.city,
      neighborhood: location.neighborhood,
      latitude: c?.lat ?? null,
      longitude: c?.lng ?? null,
      max_distance_km: v.maxDistanceKm,
      accepts_paid: v.acceptsPaid,
      accepts_free: v.acceptsFree,
      accepts_exchange: v.acceptsExchange,
      available_days: v.availableDays,
      availability_start: v.availabilityStart,
      availability_end: v.availabilityEnd,
      active: v.active,
    },
    { onConflict: "user_id" },
  );
  return error ? fail(error) : ok(undefined);
}

export async function updatePrivacy(db: Db, userId: string, v: PrivacyInput): Promise<ServiceResult> {
  const { error } = await db
    .from("profiles")
    .update({ profile_visibility: v.profileVisibility, show_rating: v.showRating, show_help_count: v.showHelpCount })
    .eq("id", userId);
  return error ? fail(error) : ok(undefined);
}
