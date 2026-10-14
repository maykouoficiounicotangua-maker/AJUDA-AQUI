import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/display";
import { ReportResolver } from "@/components/admin/admin-controls";
import { LinkTabs } from "@/components/ui/tabs";
import { getSupabase } from "@/lib/auth/session";
import { REPORT_REASONS } from "@/lib/validations";
import { formatRelative } from "@/lib/utils/format";
import { listReports } from "@/services/admin";
import { getProfilesByIds } from "@/services/profiles";

export const metadata: Metadata = { title: "Denúncias" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const TABS = [{ value: "open", label: "Em aberto" }, { value: "RESOLVED", label: "Resolvidas" }, { value: "DISMISSED", label: "Arquivadas" }];
const PRIORITY = { 1: ["Alta", "danger"], 2: ["Média", "warning"], 3: ["Baixa", "neutral"] } as const;

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/denuncias">) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === one(sp.grupo)) ? one(sp.grupo) : "open";
  const db = await getSupabase();
  const reports = await listReports(db, tab === "open" ? undefined : tab);
  const profiles = await getProfilesByIds(db, reports.flatMap((r) => [r.reporter_id, r.reported_user_id]));
  const name = (id: string) => profiles.get(id)?.full_name ?? "Usuário";

  return (
    <div>
      <PageHeader title="Denúncias" />
      <LinkTabs tabs={TABS} active={tab} basePath="/admin/denuncias" />
      {reports.length === 0 ? <EmptyState title="Nenhuma denúncia aqui." icon={<ShieldCheck className="size-10" aria-hidden />} /> : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const [label, tone] = PRIORITY[r.priority as 1 | 2 | 3];
            return (
              <li key={r.id}>
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{REPORT_REASONS[r.reason as keyof typeof REPORT_REASONS] ?? r.reason}</p>
                    <span className="flex items-center gap-2"><Badge tone={tone}>Prioridade {label}</Badge><span className="text-xs text-ink-muted">{formatRelative(r.created_at)}</span></span>
                  </div>
                  <p className="text-sm">
                    <Link href={`/usuario/${r.reporter_id}`} className="underline">{name(r.reporter_id)}</Link> denunciou{" "}
                    <Link href={`/usuario/${r.reported_user_id}`} className="font-semibold underline">{name(r.reported_user_id)}</Link>
                    {r.request_id && <> · <Link href={`/pedido/${r.request_id}`} className="underline">ver pedido</Link></>}
                  </p>
                  <p className="rounded-2xl bg-slate-50 p-3 break-words">{r.description}</p>
                  {r.admin_notes && <p className="text-sm text-ink-muted">Notas: {r.admin_notes}</p>}
                  {(r.status === "OPEN" || r.status === "UNDER_REVIEW") && <ReportResolver reportId={r.id} />}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
