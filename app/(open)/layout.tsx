import type { Metadata } from "next";
import { AuthedShell } from "@/components/layout/authed-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { VisitorShell } from "@/components/layout/visitor-shell";
import { getAuthUser, getCurrentProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

// Pedidos e buscas não são indexados (privacidade), mesmo quando abertos a visitantes.
export const metadata: Metadata = { robots: { index: false, follow: true } };

/**
 * Rotas que funcionam COM ou SEM login (Explorar, detalhe do pedido, criar pedido).
 * O visitante conhece o app livremente; o login só é pedido quando ele quer agir.
 */
export default async function OpenLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const user = await getAuthUser();
  const profile = user ? await getCurrentProfile() : null;
  if (!user || !profile) return <VisitorShell>{children}</VisitorShell>;
  return <AuthedShell userId={user.id} profile={profile}>{children}</AuthedShell>;
}
