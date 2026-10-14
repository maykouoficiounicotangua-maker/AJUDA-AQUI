import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/ui/display";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold">Que bom ver você!</h1>
      <p className="mb-5 text-ink-muted">Entre para pedir ou oferecer ajuda.</p>
      {sp.erro === "link" && (
        <div className="mb-4">
          <Notice tone="warning">Esse link expirou ou já foi usado. Tente entrar ou peça um novo link.</Notice>
        </div>
      )}
      <SignInForm next={next} />
      <p className="mt-6 text-center text-sm">
        Ainda não tem conta?{" "}
        <Link href="/cadastrar" className="font-semibold text-brand-700 underline">Cadastre-se</Link>
      </p>
    </>
  );
}
