import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { RequestCard } from "@/components/requests/request-card";
import { DraftBanner } from "@/components/requests/draft-banner";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { firstName } from "@/lib/utils/format";
import { listCategories } from "@/services/categories";
import { getRecommendedRequests, loadHelperForUser } from "@/services/matching";
import { listHelpsAsHelper, listMyRequests } from "@/services/requests";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage() {
  const { userId, profile } = await requireUser();
  const db = await getSupabase();

  const [categories, recommended, myActive, helpsActive, { categoryIds, prefs }] = await Promise.all([
    listCategories(db, { includeInactive: true }),
    getRecommendedRequests(db, userId, 6),
    listMyRequests(db, userId, "active", 5),
    listHelpsAsHelper(db, userId, "active"),
    loadHelperForUser(db, userId),
  ]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const hasHistory = myActive.length > 0 || helpsActive.length > 0;
  const needsHelperSetup = categoryIds.length === 0 || !prefs;
  const inProgress = [...myActive.filter((r) => r.status !== "OPEN"), ...helpsActive];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-extrabold tracking-tight">Olá, {firstName(profile.full_name)} 👋</h1>
        <p className="mt-1 text-lg text-ink-muted">O que você precisa hoje?</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <LinkButton href="/pedido/novo" variant="warm" size="lg" className="min-h-20 text-xl">🆘 PRECISO DE AJUDA</LinkButton>
          <LinkButton href="/explorar" variant="primary" size="lg" className="min-h-20 text-xl">🤝 QUERO AJUDAR</LinkButton>
        </div>
      </section>

      <DraftBanner />

      {!hasHistory && (
        <Card className="border-brand-200 bg-brand-50">
          <h2 className="text-lg font-bold">Comece por aqui</h2>
          <p className="mt-1 text-ink-muted">Você pode pedir ajuda ou começar ajudando alguém. Que tal dar o primeiro passo?</p>
        </Card>
      )}

      {needsHelperSetup && (
        <Card>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 size-6 shrink-0 text-warm-600" aria-hidden />
            <div className="flex-1">
              <h2 className="text-lg font-bold">Receba pedidos que combinam com você</h2>
              <p className="mt-1 text-ink-muted">Escolha as categorias em que pode ajudar e seus horários livres.</p>
              <LinkButton href="/perfil/editar" variant="secondary" size="sm" className="mt-3">Configurar agora</LinkButton>
            </div>
          </div>
        </Card>
      )}

      {inProgress.length > 0 && (
        <section aria-labelledby="andamento">
          <h2 id="andamento" className="mb-3 text-xl font-extrabold">Em andamento</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {inProgress.slice(0, 4).map((r) => (
              <li key={r.id}>
                <RequestCard request={r} category={catById.get(r.category_id)} showStatus cta={false} />
              </li>
            ))}
          </ul>
          <Link href="/meus-pedidos" className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700">
            Ver todos os meus pedidos <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      )}

      <section aria-labelledby="combinam">
        <h2 id="combinam" className="mb-3 text-xl font-extrabold">Pedidos que podem combinar com você</h2>
        {recommended.length === 0 ? (
          <EmptyState
            title="Não encontramos pedidos próximos agora."
            description="Que tal ampliar sua busca?"
            icon={<Compass className="size-10" aria-hidden />}
            action={<LinkButton href="/explorar?estado=all" variant="secondary">Explorar todos os pedidos</LinkButton>}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {recommended.map((r) => (
              <li key={r.id}>
                <RequestCard request={r} category={catById.get(r.category_id)} match={r.match} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
