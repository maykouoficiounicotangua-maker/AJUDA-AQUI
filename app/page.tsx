import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, Ban, Flag, Lock, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/display";
import { CategoryIcon } from "@/components/requests/category-icon";
import { RequestCard } from "@/components/requests/request-card";
import { PhoneDemo } from "@/components/landing/phone-demo";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Reveal } from "@/components/landing/reveal";
import { InstallButton } from "@/components/pwa/install-prompt";
import { VisitorBottomNav } from "@/components/layout/nav";
import { getAuthUser, getSupabase } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { listCategories } from "@/services/categories";
import { publicFeed } from "@/services/public";
import type { Category } from "@/types";

export const metadata: Metadata = {
  title: { absolute: "AJUDA AQUI — Pessoas ajudando pessoas." },
  description: "Precisa de uma mãozinha com compras, entregas, tecnologia ou animais? Encontre alguém perto de você — ou ajude quem precisa. Grátis e seguro.",
  alternates: { canonical: "/" },
};

const FAQ = [
  ["É grátis?", "Sim. Criar conta, pedir e oferecer ajuda é gratuito."],
  ["Preciso me cadastrar para ver os pedidos?", "Não. Você pode olhar tudo à vontade. O cadastro só é pedido quando você quiser publicar um pedido ou se oferecer para ajudar."],
  ["Como funciona o pagamento?", "Quem pede escolhe se a ajuda é gratuita, paga (com valor sugerido) ou em troca de algo. O app não cobra nem intermedeia pagamentos: vocês combinam diretamente."],
  ["Meu endereço fica público?", "Nunca. Os outros veem só bairro e cidade. O endereço é liberado apenas para a pessoa que você escolher, depois que ela confirmar a ajuda."],
  ["E meu telefone?", "Também não é público. Só a pessoa com quem você tem uma ajuda em andamento consegue ver."],
  ["Preciso baixar algo?", "Não. O Ajuda Aqui funciona no navegador e pode ser instalado na tela inicial do celular em um toque, como um app."],
  ["E se algo der errado?", "Você pode cancelar, bloquear e denunciar a qualquer momento. Nossa equipe analisa cada denúncia e acompanha os casos de “Tive um problema”."],
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const accountDeleted = sp.conta === "excluida";
  const configured = isSupabaseConfigured();
  if (!accountDeleted && configured && (await getAuthUser())) redirect("/inicio");

  let categories: Category[] = [];
  let latest: Awaited<ReturnType<typeof publicFeed>> = [];
  if (configured) {
    const db = await getSupabase();
    [categories, latest] = await Promise.all([listCategories(db), publicFeed(db, { pageSize: 4 })]);
  }
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line/60 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav aria-label="Principal" className="flex items-center gap-2">
            <Link href="/explorar" className="hidden rounded-xl px-3 py-2 font-semibold text-ink-muted hover:bg-slate-100 md:inline-block">Ver pedidos</Link>
            <Link href="#como-funciona" className="hidden rounded-xl px-3 py-2 font-semibold text-ink-muted hover:bg-slate-100 md:inline-block">Como funciona</Link>
            <LinkButton href="/entrar" variant="ghost" size="sm">Entrar</LinkButton>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="flex-1">
        {accountDeleted && (
          <div className="mx-auto mt-4 max-w-6xl px-4">
            <Notice tone="success" title="Sua conta foi excluída">Seus dados foram removidos. Obrigado por ter feito parte do Ajuda Aqui.</Notice>
          </div>
        )}

        {/* ---------- HERO ---------- */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[480px] rounded-full bg-brand-100/60 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 size-[420px] rounded-full bg-warm-100/70 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[1.1fr_1fr] md:py-16">
            <div className="text-center md:text-left">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
                <MapPin className="size-4" aria-hidden /> Perto de você, em todo o Brasil
              </p>
              <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
                Precisa de uma mãozinha? <span className="text-brand-700">Tem alguém pertinho querendo ajudar.</span>
              </h1>
              <p className="mt-5 text-lg text-ink-muted">
                Compras, entregas, um conserto, ajuda com o celular, passear com o cachorro… O Ajuda Aqui conecta você a pessoas da sua região
                para resolver as pequenas coisas do dia a dia — de forma simples e segura.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row md:justify-start">
                <LinkButton href="/pedido/novo" variant="warm" size="lg">🆘 Pedir ajuda agora</LinkButton>
                <LinkButton href="/explorar" variant="primary" size="lg">🤝 Ver quem precisa de ajuda</LinkButton>
              </div>
              <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-muted md:justify-start">
                <Sparkles className="size-4 text-warm-700" aria-hidden /> Grátis · Sem cadastro para conhecer · Funciona no navegador
              </p>
            </div>
            <PhoneDemo />
          </div>
        </section>

        {/* ---------- COMO FUNCIONA ---------- */}
        <section id="como-funciona" aria-labelledby="como-funciona-title" className="scroll-mt-20 bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <h2 id="como-funciona-title" className="text-center text-3xl font-extrabold">Como funciona</h2>
              <p className="mx-auto mt-2 mb-8 max-w-xl text-center text-ink-muted">A mesma conta serve para pedir e para ajudar. Escolha um lado para ver o passo a passo:</p>
            </Reveal>
            <HowItWorks />
          </div>
        </section>

        {/* ---------- CATEGORIAS ---------- */}
        {categories.length > 0 && (
          <section aria-labelledby="categorias-title" className="py-14">
            <div className="mx-auto max-w-6xl px-4">
              <Reveal>
                <h2 id="categorias-title" className="text-center text-3xl font-extrabold">Ajuda para o dia a dia</h2>
                <p className="mx-auto mt-2 mb-8 max-w-xl text-center text-ink-muted">Toque em uma categoria para ver os pedidos abertos.</p>
              </Reveal>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {categories.map((c, i) => (
                  <li key={c.id}>
                    <Reveal delay={(i % 6) * 60}>
                      <Link
                        href={`/explorar?categoria=${c.id}&estado=all`}
                        className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-line bg-white p-3 text-center font-semibold transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                      >
                        <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><CategoryIcon name={c.icon} className="size-6" /></span>
                        {c.name}
                      </Link>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ---------- PEDIDOS REAIS ---------- */}
        {latest.length > 0 && (
          <section aria-labelledby="agora-title" className="bg-white py-14">
            <div className="mx-auto max-w-6xl px-4">
              <Reveal>
                <h2 id="agora-title" className="text-center text-3xl font-extrabold">Gente precisando de ajuda agora</h2>
                <p className="mx-auto mt-2 mb-8 max-w-xl text-center text-ink-muted">Pedidos reais da comunidade. Pode olhar à vontade.</p>
              </Reveal>
              <ul className="grid gap-3 md:grid-cols-2">
                {latest.map((r) => (
                  <li key={r.id}><RequestCard request={r} category={catById.get(r.category_id)} /></li>
                ))}
              </ul>
              <div className="mt-6 text-center">
                <LinkButton href="/explorar?estado=all" variant="secondary">Ver todos os pedidos <ArrowRight className="size-4" aria-hidden /></LinkButton>
              </div>
            </div>
          </section>
        )}

        {/* ---------- SEGURANÇA ---------- */}
        <section aria-labelledby="seguranca-title" className="py-14">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <div className="rounded-[2rem] bg-brand-800 p-6 text-white sm:p-10">
                <h2 id="seguranca-title" className="flex items-center gap-3 text-3xl font-extrabold"><ShieldCheck className="size-8" aria-hidden /> Segurança em primeiro lugar</h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    [Lock, "Endereço protegido", "Ninguém vê seu endereço. Só a pessoa escolhida, depois de confirmar a ajuda."],
                    [Phone, "Telefone privado", "Só aparece para quem tem uma ajuda em andamento com você."],
                    [MessageCircle, "Chat dentro do app", "Combine tudo sem precisar passar seu número."],
                    [BadgeCheck, "Avaliações e selos", "Veja a reputação de cada pessoa antes de escolher."],
                    [Ban, "Bloqueie quando quiser", "Quem for bloqueado não vê seus pedidos nem fala com você."],
                    [Flag, "Denúncias analisadas", "Nossa equipe acompanha cada denúncia e problema relatado."],
                  ].map(([Icon, title, text]) => {
                    const I = Icon as typeof Lock;
                    return (
                      <li key={title as string} className="flex gap-3">
                        <I className="mt-1 size-5 shrink-0 text-brand-200" aria-hidden />
                        <div><p className="font-bold">{title as string}</p><p className="text-sm text-brand-100">{text as string}</p></div>
                      </li>
                    );
                  })}
                </ul>
                <LinkButton href="/seguranca" variant="secondary" className="mt-6">Ver todas as dicas de segurança</LinkButton>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- PERGUNTAS ---------- */}
        <section aria-labelledby="faq-title" className="bg-white py-14">
          <div className="mx-auto max-w-3xl px-4">
            <h2 id="faq-title" className="mb-6 text-center text-3xl font-extrabold">Perguntas frequentes</h2>
            <div className="space-y-2">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-line bg-canvas p-4 open:bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                    {q}
                    <span aria-hidden className="text-xl text-brand-700 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-ink-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA FINAL ---------- */}
        <section className="py-14 text-center">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="text-3xl font-extrabold">Pequenas ajudas fazem uma grande diferença.</h2>
            <p className="mt-2 text-ink-muted">Comece agora — sem cadastro para conhecer.</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <LinkButton href="/pedido/novo" variant="warm" size="lg">Pedir ajuda</LinkButton>
              <LinkButton href="/explorar" size="lg">Quero ajudar</LinkButton>
            </div>
            <InstallButton className="mt-4" />
          </div>
        </section>
      </main>

      <footer className="pb-nav border-t border-line bg-white py-6 text-center text-sm text-ink-muted lg:pb-6">
        <nav aria-label="Rodapé" className="mb-2 flex justify-center gap-4">
          <a href="/termos" className="underline">Termos de Uso</a>
          <a href="/privacidade" className="underline">Privacidade</a>
          <a href="/seguranca" className="underline">Segurança</a>
        </nav>
        © {new Date().getFullYear()} Ajuda Aqui — Pessoas ajudando pessoas.
      </footer>
      <VisitorBottomNav />
    </>
  );
}
