import type { Metadata } from "next";
import { FileQuestion, Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { RequestCard } from "@/components/requests/request-card";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";
import { listMyRequests, type MyRequestGroup } from "@/services/requests";

export const metadata: Metadata = { title: "Meus pedidos" };

const TABS = [
  { value: "active", label: "Ativos" },
  { value: "draft", label: "Rascunhos" },
  { value: "completed", label: "Concluídos" },
  { value: "cancelled", label: "Cancelados" },
  { value: "expired", label: "Expirados" },
];
const EMPTY: Record<string, string> = {
  active: "Você não tem pedidos ativos.", draft: "Você não tem rascunhos.", completed: "Nenhum pedido concluído ainda.",
  cancelled: "Nenhum pedido cancelado.", expired: "Nenhum pedido expirado.",
};

export default async function MyRequestsPage({ searchParams }: PageProps<"/meus-pedidos">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.grupo) ? sp.grupo[0] : sp.grupo;
  const group = (TABS.some((t) => t.value === raw) ? raw : "active") as MyRequestGroup;
  const { userId } = await requireUser();
  const db = await getSupabase();
  const [items, categories] = await Promise.all([listMyRequests(db, userId, group), listCategories(db, { includeInactive: true })]);
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div>
      <PageHeader
        title="Meus pedidos"
        action={<LinkButton href="/pedido/novo" size="sm"><Plus className="size-4" aria-hidden /> Novo</LinkButton>}
      />
      <LinkTabs tabs={TABS} active={group} basePath="/meus-pedidos" />
      {items.length === 0 ? (
        <EmptyState
          title={EMPTY[group]}
          icon={<FileQuestion className="size-10" aria-hidden />}
          action={group === "active" || group === "draft" ? <LinkButton href="/pedido/novo" variant="warm">Criar pedido</LinkButton> : undefined}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} category={catById.get(r.category_id)} showStatus cta={false} href={r.status === "DRAFT" ? `/pedido/${r.id}/editar` : undefined} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
