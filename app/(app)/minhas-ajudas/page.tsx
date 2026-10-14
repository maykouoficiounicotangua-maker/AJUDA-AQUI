import type { Metadata } from "next";
import Link from "next/link";
import { HandHeart } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { RequestCard } from "@/components/requests/request-card";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/requests/state-machine";
import { formatRelative } from "@/lib/utils/format";
import { listCategories } from "@/services/categories";
import { listMyOffers } from "@/services/offers";
import { listHelpsAsHelper } from "@/services/requests";
import type { RequestStatus } from "@/types";

export const metadata: Metadata = { title: "Minhas ajudas" };

const TABS = [
  { value: "propostas", label: "Propostas" },
  { value: "andamento", label: "Aceitas / em andamento" },
  { value: "concluidas", label: "Concluídas" },
  { value: "canceladas", label: "Canceladas" },
];
const OFFER_LABEL: Record<string, string> = { PENDING: "Aguardando", ACCEPTED: "Aceita", REJECTED: "Não selecionada", WITHDRAWN: "Retirada", EXPIRED: "Expirada" };

export default async function MyHelpsPage({ searchParams }: PageProps<"/minhas-ajudas">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.grupo) ? sp.grupo[0] : sp.grupo;
  const group = TABS.some((t) => t.value === raw) ? (raw as string) : "propostas";
  const { userId } = await requireUser();
  const db = await getSupabase();
  const categories = await listCategories(db, { includeInactive: true });
  const catById = new Map(categories.map((c) => [c.id, c]));

  const offers = group === "propostas" ? await listMyOffers(db, userId) : [];
  const helps = group === "propostas" ? [] : await listHelpsAsHelper(db, userId, group === "andamento" ? "active" : group === "concluidas" ? "completed" : "cancelled");

  const isEmpty = group === "propostas" ? offers.length === 0 : helps.length === 0;
  return (
    <div>
      <PageHeader title="Minhas ajudas" subtitle="O que você se ofereceu para fazer" />
      <LinkTabs tabs={TABS} active={group} basePath="/minhas-ajudas" />
      {isEmpty ? (
        <EmptyState
          title="Nada por aqui ainda."
          description="Encontre um pedido perto de você e ofereça ajuda."
          icon={<HandHeart className="size-10" aria-hidden />}
          action={<LinkButton href="/explorar">Explorar pedidos</LinkButton>}
        />
      ) : group === "propostas" ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {offers.map((o) => (
            <li key={o.id}>
              <Card className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold">
                    {o.request ? <Link href={`/pedido/${o.request.id}`} className="underline-offset-2 hover:underline">{o.request.title}</Link> : "Pedido indisponível"}
                  </h2>
                  <Badge tone={o.status === "ACCEPTED" ? "success" : o.status === "PENDING" ? "info" : "neutral"}>{OFFER_LABEL[o.status]}</Badge>
                </div>
                <p className="line-clamp-2 text-ink-muted">“{o.message}”</p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  {formatRelative(o.created_at)}
                  {o.request && <Badge tone={STATUS_TONE[o.request.status as RequestStatus]}>{STATUS_LABELS[o.request.status as RequestStatus]}</Badge>}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {helps.map((r) => (
            <li key={r.id}><RequestCard request={r} category={catById.get(r.category_id)} showStatus cta={false} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
