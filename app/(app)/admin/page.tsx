import type { Metadata } from "next";
import { Card, Notice, PageHeader } from "@/components/ui/display";
import { getSupabase } from "@/lib/auth/session";
import { getStats } from "@/services/admin";

export const metadata: Metadata = { title: "Resumo" };

export default async function AdminDashboard() {
  const stats = await getStats(await getSupabase());
  if (!stats) return <Notice tone="danger">Não conseguimos carregar os indicadores agora.</Notice>;

  const items: [string, number][] = [
    ["Usuários", stats.users_total], ["Usuários ativos", stats.users_active], ["Suspensos / bloqueados", stats.users_blocked],
    ["Pedidos publicados", stats.requests_total], ["Pedidos abertos", stats.requests_open], ["Pedidos concluídos", stats.requests_completed],
    ["Pedidos cancelados", stats.requests_cancelled], ["Ajudas em andamento", stats.helps_in_progress],
    ["Denúncias em aberto", stats.reports_open], ["Disputas em aberto", stats.disputes_open],
  ];
  return (
    <div>
      <PageHeader title="Resumo" subtitle="Visão geral da plataforma" />
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map(([label, value]) => (
          <Card key={label} className="p-4">
            <dd className="text-3xl font-extrabold">{value}</dd>
            <dt className="text-sm text-ink-muted">{label}</dt>
          </Card>
        ))}
      </dl>
    </div>
  );
}
