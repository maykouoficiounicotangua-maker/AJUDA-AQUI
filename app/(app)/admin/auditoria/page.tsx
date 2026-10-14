import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui/display";
import { getSupabase } from "@/lib/auth/session";
import { listAudit } from "@/services/admin";
import { getProfilesByIds } from "@/services/profiles";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.pagina) ? sp.pagina[0] : sp.pagina) || 1);
  const db = await getSupabase();
  const logs = await listAudit(db, page);
  const admins = await getProfilesByIds(db, logs.flatMap((l) => (l.admin_id ? [l.admin_id] : [])));

  return (
    <div className="space-y-4">
      <PageHeader title="Auditoria" subtitle="Registro imutável de ações administrativas" />
      {logs.length === 0 ? <EmptyState title="Nenhum registro ainda." /> : (
        <ul className="space-y-3">
          {logs.map((l) => (
            <li key={l.id}>
              <Card className="space-y-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-bold">{l.action}</p>
                  <time className="text-xs text-ink-muted" dateTime={l.created_at}>{new Date(l.created_at).toLocaleString("pt-BR")}</time>
                </div>
                <p className="text-sm text-ink-muted">{l.entity_type} · {l.entity_id} · por {l.admin_id ? admins.get(l.admin_id)?.full_name ?? l.admin_id : "sistema"}</p>
                {Boolean(l.old_data || l.new_data) && (
                  <details className="text-sm"><summary className="cursor-pointer font-semibold">Detalhes</summary>
                    <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify({ antes: l.old_data, depois: l.new_data, meta: l.metadata }, null, 2)}</pre>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex justify-between text-sm font-semibold text-brand-700 underline" aria-label="Paginação">
        {page > 1 ? <Link href={`?pagina=${page - 1}`}>← Anterior</Link> : <span />}
        {logs.length === 30 && <Link href={`?pagina=${page + 1}`}>Próxima →</Link>}
      </nav>
    </div>
  );
}
