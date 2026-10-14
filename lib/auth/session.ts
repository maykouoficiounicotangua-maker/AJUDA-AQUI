import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_VERSIONS } from "@/lib/legal";
import type { Profile } from "@/types";

const PROFILE_COLUMNS =
  "id, full_name, avatar_url, country_code, state, city, neighborhood, bio, status, role, profile_visibility, show_rating, show_help_count, onboarding_completed, created_at";

/** Um cliente por requisição. */
export const getSupabase = cache(async () => createClient());

export const getAuthUser = cache(async () => {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await getSupabase();
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/** O usuário aceitou as versões VIGENTES dos documentos? */
export const hasCurrentConsent = cache(async (userId: string): Promise<boolean> => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", userId)
    .eq("terms_version", LEGAL_VERSIONS.terms)
    .eq("privacy_version", LEGAL_VERSIONS.privacy)
    .eq("safety_version", LEGAL_VERSIONS.safety)
    .limit(1);
  return (data?.length ?? 0) > 0;
});

export async function requireUser(): Promise<{ userId: string; profile: Profile }> {
  const user = await getAuthUser();
  if (!user) redirect("/entrar");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");
  return { userId: user.id, profile };
}

/** Páginas /admin respondem 404 para quem não é admin (não revela que existem). A RLS/RPC continua sendo a defesa real. */
export async function requireAdmin() {
  const { userId, profile } = await requireUser();
  if (profile.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(profile.role)) notFound();
  return { userId, profile };
}

export const isAdminProfile = (p: Pick<Profile, "role" | "status"> | null) =>
  !!p && p.status === "ACTIVE" && (p.role === "ADMIN" || p.role === "SUPER_ADMIN");
