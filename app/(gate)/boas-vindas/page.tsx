import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/auth/onboarding";
import { hasCurrentConsent, requireUser } from "@/lib/auth/session";
import { safeInternalUrl } from "@/lib/notifications/catalog";

export const metadata: Metadata = { title: "Boas-vindas" };

export default async function WelcomePage({ searchParams }: PageProps<"/boas-vindas">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeInternalUrl(sp.next, "/inicio") : "/inicio";
  const { userId, profile } = await requireUser();
  if (!(await hasCurrentConsent(userId))) redirect("/aceitar-termos");
  if (profile.onboarding_completed) redirect(next);
  return <Onboarding firstName={profile.full_name.split(" ")[0]} next={next} />;
}
