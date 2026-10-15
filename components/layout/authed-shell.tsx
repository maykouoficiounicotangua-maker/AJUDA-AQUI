import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RegisterServiceWorker } from "@/components/notifications/register-sw";
import { getSupabase, hasCurrentConsent } from "@/lib/auth/session";
import { countUnreadMessages } from "@/services/conversations";
import { countUnreadNotifications, getPrefs } from "@/services/notifications";
import type { Profile } from "@/types";

/** Shell do usuário logado, com os "portões" (termos vigentes → onboarding). Usado por (app) e (open). */
export async function AuthedShell({ userId, profile, children }: { userId: string; profile: Profile; children: React.ReactNode }) {
  if (!(await hasCurrentConsent(userId))) redirect("/aceitar-termos");
  if (!profile.onboarding_completed) redirect("/boas-vindas");

  const db = await getSupabase();
  const [unreadNotifications, unreadMessages, prefs] = await Promise.all([
    countUnreadNotifications(db, userId),
    countUnreadMessages(db, userId),
    getPrefs(db, userId),
  ]);

  return (
    <AppShell profile={profile} unreadNotifications={unreadNotifications} unreadMessages={unreadMessages} prefs={prefs}>
      <RegisterServiceWorker />
      {children}
    </AppShell>
  );
}
