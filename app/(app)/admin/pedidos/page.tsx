import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/display";
import { AdminCancelRequest } from "@/components/admin/admin-controls";
import { getSupabase } from "@/lib/auth/session";
import { STATUS_LABELS, STATUS_TONE, isTerminal } from "@/lib/requests/state-machine";
import { listRequests } from "@/services/admin";
import { REQUEST_STATUSES } from "@/types";

export const metadata: Metadata = { title: "Pedidos" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin/pedidos">) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 80);
  const status = (REQUEST_STATUSES as readonly string[]).includes(one(sp.status)) ? one(sp.status) : "";
  const page = Math.max(1, Number(one(sp.pagina)) || 1);
  const items = await listRequests(await getSupabase(), { q, status, page });

  return (
    <div className="space-y-4">
      <PageHeader title="Pedidos" />
      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar por título" aria-label="Buscar por título" className="min-h-12 flex-1 rounded-2xl border border-line bg-white px-4" />
        <select name="status" defaultValue={status} aria-label="Status" className="min-h-12 rounded-2xl border border-line bg-white px-3">
          <option value="">Todos</option>
          {REQUEST_STATUSES.filter((s) => s !== "DRAFT").map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <button className="min-h-12 rounded-2xl bg-brand-700 px-5 font-semibold text-white">Filtrar</button>
      </form>
      {items.length === 0 ? <EmptyState title="Nenhum pedido encontrado." /> : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/pedido/${r.id}`} className="font-bold underline-offset-2 hover:underline">{r.title}</Link>
                  <p className="text-sm text-ink-muted">{r.city}/{r.state} · {r.scheduled_date}</p>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                {!isTerminal(r.status) && <AdminCancelRequest requestId={r.id} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex justify-between text-sm font-semibold text-brand-700 underline" aria-label="Paginação">
        {page > 1 ? <Link href={`?q=${q}&status=${status}&pagina=${page - 1}`}>← Anterior</Link> : <span />}
        {items.length === 25 && <Link href={`?q=${q}&status=${status}&pagina=${page + 1}`}>Próxima →</Link>}
      </nav>
    </div>
  );
}
