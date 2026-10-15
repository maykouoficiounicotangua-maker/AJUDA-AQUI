import type { Metadata } from "next";
import Link from "next/link";
import { Info, SearchX } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { ExploreFilters } from "@/components/requests/explore-filters";
import { RequestCard, type RequestCardData } from "@/components/requests/request-card";
import type { MatchResult } from "@/lib/matching/types";
import { getAuthUser, getCurrentProfile, getSupabase } from "@/lib/auth/session";
import { publicFeed } from "@/services/public";
import { listCategories } from "@/services/categories";
import { attachMatch, loadHelperForUser, rankForHelper } from "@/services/matching";
import { searchRequests, type SearchFilters } from "@/services/requests";
import { HELP_TYPES, type Category, type HelpType } from "@/types";

export const metadata: Metadata = { title: "Explorar pedidos" };

const PAGE_SIZE = 12;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExplorePage({ searchParams }: PageProps<"/explorar">) {
  const sp = await searchParams;
  const user = await getAuthUser();
  const profile = user ? await getCurrentProfile() : null;
  const db = await getSupabase();

  // Escopo padrão: o estado do usuário (visitante: todo o Brasil). "Todo o Brasil" = estado=all.
  const stateParam = one(sp.estado);
  const state = stateParam === "all" ? "" : stateParam || profile?.state || "";
  const page = Math.max(1, Number(one(sp.pagina)) || 1);
  const order = one(sp.ordem) || (user ? "match" : "recent");
  const typeParam = one(sp.tipo);
  const dayParam = one(sp.dia);
  const cat = one(sp.categoria);
  const km = Number(one(sp.km)) || undefined;

  const categories = await listCategories(db, { includeInactive: true });
  const catById = new Map(categories.map((c) => [c.id, c]));
  const qs = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) next.set(k, v);
    next.set("pagina", String(p));
    return `/explorar?${next.toString()}`;
  };
  const common = {
    state: state || undefined,
    city: one(sp.cidade).slice(0, 120) || undefined,
    neighborhood: one(sp.bairro).slice(0, 120) || undefined,
    categoryId: UUID.test(cat) ? cat : undefined,
    helpType: (HELP_TYPES as readonly string[]).includes(typeParam) ? (typeParam as HelpType) : undefined,
    day: dayParam === "today" || dayParam === "tomorrow" ? (dayParam as "today" | "tomorrow") : undefined,
    query: one(sp.q).slice(0, 80) || undefined,
  };

  // ---------- VISITANTE: feed público, sem login ----------
  if (!user || !profile) {
    const sort = order === "time" || order === "category" ? order : "recent";
    const rows = await publicFeed(db, { ...common, sort, page, pageSize: PAGE_SIZE + 1 });
    return (
      <div className="space-y-5">
        <PageHeader title="Pedidos de ajuda" subtitle="Pessoas reais precisando de uma mãozinha" />
        <Card className="flex items-start gap-3 border-brand-200 bg-brand-50">
          <Info className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
          <p className="text-sm">
            Fique à vontade para olhar. Quando quiser ajudar alguém, toque em <strong>TENHO INTERESSE</strong>: só nessa hora pedimos
            seu cadastro, que leva menos de 1 minuto. O endereço de quem pediu nunca aparece aqui.
          </p>
        </Card>
        <ExploreFilters categories={categories} defaultState={state || "all"} visitor />
        <ResultList items={rows.slice(0, PAGE_SIZE)} catById={catById} />
        <Pagination page={page} hasNext={rows.length > PAGE_SIZE} qs={qs} />
      </div>
    );
  }

  const { helper } = await loadHelperForUser(db, user.id);

  const filters: SearchFilters = {
    ...common,
    maxKm: km,
    lat: helper.lat,
    lng: helper.lng,
  };

  let results;
  let hasNext: boolean;
  if (order === "match") {
    // "Mais compatíveis": busca os 50 mais recentes do recorte e ordena pelo motor de matching (paginação sobre esse conjunto).
    const pool = await searchRequests(db, { ...filters, sort: "recent", pageSize: 50 });
    const ranked = rankForHelper(helper, pool);
    results = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    hasNext = ranked.length > page * PAGE_SIZE;
  } else {
    const rows = await searchRequests(db, { ...filters, sort: order as SearchFilters["sort"], page, pageSize: PAGE_SIZE + 1 });
    hasNext = rows.length > PAGE_SIZE;
    results = attachMatch(helper, rows.slice(0, PAGE_SIZE)); // mantém a ordem definida pelo servidor
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Explorar" subtitle="Pedidos abertos perto de você. Toque em um pedido para ver detalhes e oferecer ajuda." />
      <ExploreFilters categories={categories} defaultState={state || "all"} />

      <ResultList items={results} catById={catById} />
      <Pagination page={page} hasNext={hasNext} qs={qs} />
    </div>
  );
}

function ResultList({ items, catById }: { items: (RequestCardData & { category_id: string; match?: MatchResult })[]; catById: Map<string, Category> }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Não encontramos pedidos próximos agora."
        description="Que tal ampliar sua busca?"
        icon={<SearchX className="size-10" aria-hidden />}
        action={<LinkButton href="/explorar?estado=all" variant="secondary">Ver todo o Brasil</LinkButton>}
      />
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((r) => (
        <li key={r.id}>
          <RequestCard request={r} category={catById.get(r.category_id)} match={r.match} />
        </li>
      ))}
    </ul>
  );
}

function Pagination({ page, hasNext, qs }: { page: number; hasNext: boolean; qs: (p: number) => string }) {
  if (page <= 1 && !hasNext) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between">
      {page > 1 ? <Link href={qs(page - 1)} className="font-semibold text-brand-700 underline">← Anterior</Link> : <span />}
      <span className="text-sm text-ink-muted">Página {page}</span>
      {hasNext ? <Link href={qs(page + 1)} className="font-semibold text-brand-700 underline">Próxima →</Link> : <span />}
    </nav>
  );
}
