import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/auth/onboarding";
import { hasCurrentConsent, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Boas-vindas" };

export default async function WelcomePage() {
  const { userId, profile } = await requireUser();
  if (!(await hasCurrentConsent(userId))) redirect("/aceitar-termos");
  if (profile.onboarding_completed) redirect("/inicio");
  return <Onboarding firstName={profile.full_name.split(" ")[0]} />;
}
