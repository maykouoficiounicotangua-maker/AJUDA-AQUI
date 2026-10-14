import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { SetupNotice } from "@/components/layout/setup-notice";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Telas que o usuário logado precisa passar antes do app (aceite de termos, onboarding). */
export default function GateLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <div className="mb-6 flex justify-center"><Logo /></div>
      {children}
    </main>
  );
}
