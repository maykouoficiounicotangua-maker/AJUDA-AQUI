import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { Logo } from "@/components/layout/logo";
import { getAuthUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

/** Fica fora de (auth) porque o usuário chega aqui JÁ com sessão de recuperação. */
export default async function ResetPasswordPage() {
  const user = await getAuthUser();
  if (!user) redirect("/entrar?erro=link");
  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-extrabold">Crie uma nova senha</h1>
        <p className="mb-5 text-ink-muted">Escolha uma senha que só você conheça.</p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
