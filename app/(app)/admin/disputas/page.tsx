import type { Metadata } from "next";
import Link from "next/link";
import { Scale } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/display";
import { DisputeResolver } from "@/components/admin/admin-controls";
import { LinkTabs } from "@/components/ui/tabs";
import { getSupabase } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils/format";
import { listDisputes } from "@/services/admin";
import { getProfilesByIds } from "@/services/profiles";

export const metadata: Metadata = { title: "Disputas" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const TABS = [{ value: "open", label: "Em aberto" }, { value: "RESOLVED", label: "Resolvidas" }, { value: "DISMISSED", label: "Arquivadas" }];

export default async function AdminDisputesPage({ searchParams }: PageProps<"/admin/disputas">) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === one(sp.grupo)) ? one(sp.grupo) : "open";
  const db = await getSupabase();
  const disputes = await listDisputes(db, tab === "open" ? undefined : tab);
  const profiles = await getProfilesByIds(db, disputes.map((d) => d.opened_by));

  return (
    <div>
      <PageHeader title="Disputas" subtitle="Casos de “Tive um problema”" />
      <LinkTabs tabs={TABS} active={tab} basePath="/admin/disputas" />
      {disputes.length === 0 ? <EmptyState title="Nenhuma disputa aqui." icon={<Scale className="size-10" aria-hidden />} /> : (
        <ul className="space-y-4">
          {disputes.map((d) => (
            <li key={d.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/pedido/${d.request_id}`} className="font-bold underline">{d.request?.title ?? "Pedido"}</Link>
                  <span className="flex items-center gap-2"><Badge tone="warning">{d.request?.status}</Badge><span className="text-xs text-ink-muted">{formatRelative(d.created_at)}</span></span>
                </div>
                <p className="text-sm">Aberta por <strong>{profiles.get(d.opened_by)?.full_name ?? "usuário"}</strong> — {d.reason}</p>
                <p className="rounded-2xl bg-slate-50 p-3 break-words">{d.description}</p>
                {d.resolution && <p className="text-sm text-ink-muted">Decisão: {d.resolution}</p>}
                {(d.status === "OPEN" || d.status === "UNDER_REVIEW") && <DisputeResolver disputeId={d.id} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
