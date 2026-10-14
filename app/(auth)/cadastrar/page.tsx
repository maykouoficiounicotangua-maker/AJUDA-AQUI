import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold">Criar minha conta</h1>
      <p className="mb-5 text-ink-muted">É grátis. Você poderá pedir e oferecer ajuda com a mesma conta.</p>
      <SignUpForm />
      <p className="mt-6 text-center text-sm">
        Já tem conta? <Link href="/entrar" className="font-semibold text-brand-700 underline">Entrar</Link>
      </p>
    </>
  );
}
