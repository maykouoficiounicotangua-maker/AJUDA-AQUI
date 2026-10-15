import type { Metadata } from "next";
import { AuthedShell } from "@/components/layout/authed-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { requireUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

// Área logada nunca é indexada
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { userId, profile } = await requireUser();
  return <AuthedShell userId={userId} profile={profile}>{children}</AuthedShell>;
}
