import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { RegisterServiceWorker } from "@/components/notifications/register-sw";
import { getSupabase, hasCurrentConsent, requireUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { countUnreadMessages } from "@/services/conversations";
import { countUnreadNotifications } from "@/services/notifications";

// Área logada nunca é indexada
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { userId, profile } = await requireUser();
  if (!(await hasCurrentConsent(userId))) redirect("/aceitar-termos");
  if (!profile.onboarding_completed) redirect("/boas-vindas");

  const db = await getSupabase();
  const [unreadNotifications, unreadMessages] = await Promise.all([
    countUnreadNotifications(db, userId),
    countUnreadMessages(db, userId),
  ]);

  return (
    <AppShell profile={profile} unreadNotifications={unreadNotifications} unreadMessages={unreadMessages}>
      <RegisterServiceWorker />
      {children}
    </AppShell>
  );
}
