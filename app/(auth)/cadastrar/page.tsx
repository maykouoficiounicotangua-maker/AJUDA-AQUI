import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthContextNotice } from "@/components/auth/auth-context";
import { safeInternalUrl } from "@/lib/notifications/catalog";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeInternalUrl(sp.next, "") || undefined : undefined;
  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold">Criar minha conta</h1>
      <p className="mb-5 text-ink-muted">É grátis. Você poderá pedir e oferecer ajuda com a mesma conta.</p>
      <AuthContextNotice next={next} />
      <SignUpForm next={next} />
      <p className="mt-6 text-center text-sm">
        Já tem conta? <Link href={next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"} className="font-semibold text-brand-700 underline">Entrar</Link>
      </p>
    </>
  );
}
