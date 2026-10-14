import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold">Recuperar senha</h1>
      <p className="mb-5 text-ink-muted">Enviaremos um link para você criar uma nova senha.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/entrar" className="font-semibold text-brand-700 underline">Voltar para o login</Link>
      </p>
    </>
  );
}
