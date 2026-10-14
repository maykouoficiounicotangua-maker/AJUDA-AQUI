import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { ExploreFilters } from "@/components/requests/explore-filters";
import { RequestCard } from "@/components/requests/request-card";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";
import { attachMatch, loadHelperForUser, rankForHelper } from "@/services/matching";
import { searchRequests, type SearchFilters } from "@/services/requests";
import { HELP_TYPES, type HelpType } from "@/types";

export const metadata: Metadata = { title: "Explorar pedidos" };

const PAGE_SIZE = 12;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExplorePage({ searchParams }: PageProps<"/explorar">) {
  const sp = await searchParams;
  const { userId, profile } = await requireUser();
  const db = await getSupabase();

  // Escopo padrão: o estado do usuário. "Todo o Brasil" = estado=all.
  const stateParam = one(sp.estado);
  const state = stateParam === "all" ? "" : stateParam || profile.state || "";
  const page = Math.max(1, Number(one(sp.pagina)) || 1);
  const order = one(sp.ordem) || "match";
  const typeParam = one(sp.tipo);
  const dayParam = one(sp.dia);
  const cat = one(sp.categoria);
  const km = Number(one(sp.km)) || undefined;

  const [categories, { helper }] = await Promise.all([listCategories(db, { includeInactive: true }), loadHelperForUser(db, userId)]);
  const catById = new Map(categories.map((c) => [c.id, c]));

  const filters: SearchFilters = {
    state: state || undefined,
    city: one(sp.cidade).slice(0, 120) || undefined,
    neighborhood: one(sp.bairro).slice(0, 120) || undefined,
    categoryId: UUID.test(cat) ? cat : undefined,
    helpType: (HELP_TYPES as readonly string[]).includes(typeParam) ? (typeParam as HelpType) : undefined,
    day: dayParam === "today" || dayParam === "tomorrow" ? dayParam : undefined,
    maxKm: km,
    query: one(sp.q).slice(0, 80) || undefined,
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

  const qs = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) next.set(k, v);
    next.set("pagina", String(p));
    return `/explorar?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Explorar" subtitle="Pedidos abertos perto de você" />
      <ExploreFilters categories={categories} defaultState={state || "all"} />

      {results.length === 0 ? (
        <EmptyState
          title="Não encontramos pedidos próximos agora."
          description="Que tal ampliar sua busca?"
          icon={<SearchX className="size-10" aria-hidden />}
          action={<LinkButton href="/explorar?estado=all" variant="secondary">Ver todo o Brasil</LinkButton>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {results.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} category={catById.get(r.category_id)} match={r.match} />
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <nav aria-label="Paginação" className="flex items-center justify-between">
          {page > 1 ? <Link href={qs(page - 1)} className="font-semibold text-brand-700 underline">← Anterior</Link> : <span />}
          <span className="text-sm text-ink-muted">Página {page}</span>
          {hasNext ? <Link href={qs(page + 1)} className="font-semibold text-brand-700 underline">Próxima →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
