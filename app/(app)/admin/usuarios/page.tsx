import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/display";
import { UserStatusButtons } from "@/components/admin/admin-controls";
import { getSupabase } from "@/lib/auth/session";
import { listUsers } from "@/services/admin";

export const metadata: Metadata = { title: "Usuários" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const TONE = { ACTIVE: "success", SUSPENDED: "warning", BLOCKED: "danger", DELETED: "neutral" } as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 80);
  const status = ["ACTIVE", "SUSPENDED", "BLOCKED"].includes(one(sp.status)) ? one(sp.status) : "";
  const page = Math.max(1, Number(one(sp.pagina)) || 1);
  const users = await listUsers(await getSupabase(), { q, status, page });

  return (
    <div className="space-y-4">
      <PageHeader title="Usuários" />
      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar por nome" aria-label="Buscar por nome" className="min-h-12 flex-1 rounded-2xl border border-line bg-white px-4" />
        <select name="status" defaultValue={status} aria-label="Situação" className="min-h-12 rounded-2xl border border-line bg-white px-3">
          <option value="">Todos</option><option value="ACTIVE">Ativos</option><option value="SUSPENDED">Suspensos</option><option value="BLOCKED">Bloqueados</option>
        </select>
        <button className="min-h-12 rounded-2xl bg-brand-700 px-5 font-semibold text-white">Buscar</button>
      </form>
      {users.length === 0 ? <EmptyState title="Nenhum usuário encontrado." /> : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/usuario/${u.id}`} className="font-bold underline-offset-2 hover:underline">{u.full_name}</Link>
                  <p className="text-sm text-ink-muted">{[u.city, u.state].filter(Boolean).join(" / ")} · {u.role}</p>
                </div>
                <Badge tone={TONE[u.status]}>{{ ACTIVE: "Ativo", SUSPENDED: "Suspenso", BLOCKED: "Bloqueado", DELETED: "Excluído" }[u.status]}</Badge>
                {u.role === "USER" && <UserStatusButtons userId={u.id} status={u.status} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex justify-between text-sm font-semibold text-brand-700 underline" aria-label="Paginação">
        {page > 1 ? <Link href={`?q=${q}&status=${status}&pagina=${page - 1}`}>← Anterior</Link> : <span />}
        {users.length === 25 && <Link href={`?q=${q}&status=${status}&pagina=${page + 1}`}>Próxima →</Link>}
      </nav>
    </div>
  );
}
