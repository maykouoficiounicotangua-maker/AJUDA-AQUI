import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HandHelping, MapPin, MessagesSquare, ShieldCheck, Star } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/display";
import { getAuthUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: { absolute: "AJUDA AQUI — Pessoas ajudando pessoas." },
  alternates: { canonical: "/" },
};

const steps = [
  { icon: HandHelping, title: "Peça ou ofereça", text: "Conte do que precisa em poucos passos, ou veja pedidos que combinam com você." },
  { icon: MessagesSquare, title: "Combine pelo chat", text: "Escolha quem vai ajudar e converse com segurança dentro do app." },
  { icon: Star, title: "Avalie", text: "Depois da ajuda, os dois se avaliam e a confiança cresce na comunidade." },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const accountDeleted = sp.conta === "excluida";
  if (!accountDeleted && isSupabaseConfigured() && (await getAuthUser())) redirect("/inicio");

  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <nav aria-label="Principal" className="flex items-center gap-2">
          <LinkButton href="/entrar" variant="ghost" size="sm">Entrar</LinkButton>
          <LinkButton href="/cadastrar" size="sm">Criar conta</LinkButton>
        </nav>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        {accountDeleted && (
          <div className="mt-4">
            <Notice tone="success" title="Sua conta foi excluída">Seus dados foram removidos. Obrigado por ter feito parte do Ajuda Aqui.</Notice>
          </div>
        )}
        <section className="py-10 text-center sm:py-16">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
            <MapPin className="size-4" aria-hidden /> Perto de você, em todo o Brasil
          </p>
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Pessoas ajudando <span className="text-brand-700">pessoas.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-muted">
            Precisa de uma mãozinha com compras, entregas, tecnologia ou animais? Ou quer ajudar quem mora perto?
            O Ajuda Aqui conecta vocês de um jeito simples e seguro.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <LinkButton href="/cadastrar" variant="warm" size="lg">🆘 Preciso de ajuda</LinkButton>
            <LinkButton href="/cadastrar" variant="primary" size="lg">🤝 Quero ajudar</LinkButton>
          </div>
        </section>

        <section aria-labelledby="como-funciona" className="py-8">
          <h2 id="como-funciona" className="mb-6 text-center text-2xl font-extrabold">Como funciona</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
                <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <s.icon className="size-6" aria-hidden />
                </span>
                <h3 className="text-lg font-bold">{i + 1}. {s.title}</h3>
                <p className="mt-1 text-ink-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="my-8 rounded-[var(--radius-card)] bg-brand-800 p-6 text-white sm:p-10">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 size-8 shrink-0" aria-hidden />
            <div>
              <h2 className="text-2xl font-extrabold">Segurança em primeiro lugar</h2>
              <p className="mt-2 max-w-2xl text-brand-100">
                Seu endereço nunca é público. Você escolhe quem vai ajudar, conversa dentro do app, pode bloquear e denunciar
                a qualquer momento — e nossa equipe acompanha as denúncias.
              </p>
              <LinkButton href="/seguranca" variant="secondary" className="mt-4">Ver orientações de segurança</LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white py-6 text-center text-sm text-ink-muted">
        <nav aria-label="Rodapé" className="mb-2 flex justify-center gap-4">
          <a href="/termos" className="underline">Termos de Uso</a>
          <a href="/privacidade" className="underline">Privacidade</a>
          <a href="/seguranca" className="underline">Segurança</a>
        </nav>
        © {new Date().getFullYear()} Ajuda Aqui — Pessoas ajudando pessoas.
      </footer>
    </>
  );
}
