import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AcceptTermsForm } from "@/components/auth/accept-terms-form";
import { hasCurrentConsent, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Aceitar termos" };

export default async function AcceptTermsPage() {
  const { userId } = await requireUser();
  if (await hasCurrentConsent(userId)) redirect("/inicio");
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-2xl font-extrabold">Antes de continuar</h1>
      <p className="mb-5 text-ink-muted">
        Atualizamos nossos documentos. Leia e aceite para continuar usando o Ajuda Aqui.
      </p>
      <AcceptTermsForm />
    </div>
  );
}
