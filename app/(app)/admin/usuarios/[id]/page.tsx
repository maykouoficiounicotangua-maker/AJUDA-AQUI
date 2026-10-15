import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar, Badge, Card, Stars } from "@/components/ui/display";
import { UserStatusButtons } from "@/components/admin/admin-controls";
import { getSupabase } from "@/lib/auth/session";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/requests/state-machine";
import { REPORT_REASONS, uuid } from "@/lib/validations";
import { formatRelative } from "@/lib/utils/format";
import { getUserOverview } from "@/services/admin";
import { getProfile } from "@/services/profiles";
import type { RequestStatus } from "@/types";

export const metadata: Metadata = { title: "Ficha do usuário" };

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

export default async function AdminUserPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const db = await getSupabase();
  const [profile, overview] = await Promise.all([getProfile(db, id), getUserOverview(db, id)]);
  if (!profile || !overview) notFound();

  // O admin enxerga tudo pela RLS (is_admin); listas curtas e recentes.
  const [{ data: requests }, { data: helps }, { data: reviews }, { data: reports }, { data: audit }] = await Promise.all([
    db.from("help_requests").select("id, title, status, created_at").eq("requester_id", id).neq("status", "DRAFT").order("created_at", { ascending: false }).limit(10),
    db.from("help_requests").select("id, title, status, created_at").eq("selected_helper_id", id).order("created_at", { ascending: false }).limit(10),
    db.from("reviews").select("id, rating, comment, created_at").eq("reviewee_id", id).order("created_at", { ascending: false }).limit(10),
    db.from("reports").select("id, reason, description, status, created_at").eq("reported_user_id", id).order("created_at", { ascending: false }).limit(10),
    db.from("audit_logs").select("id, action, created_at, metadata").eq("entity_id", id).neq("action", "user.viewed").order("created_at", { ascending: false }).limit(10),
  ]);
  type Row = { id: string; title: string; status: RequestStatus; created_at: string };

  const stats: [string, number | string][] = [
    ["Pedidos publicados", overview.requests], ["Pedidos concluídos", overview.requests_completed], ["Ajudas realizadas", overview.helps_completed],
    ["Propostas enviadas", overview.offers], ["Mensagens", overview.messages], ["Avaliações recebidas", overview.reviews_received],
    ["Denúncias contra", overview.reports_against], ["Denúncias feitas", overview.reports_made], ["Bloqueado por", overview.blocked_by],
    ["Aparelhos com push", overview.push_devices],
  ];

  return (
    <div className="space-y-5">
      <Link href="/admin/usuarios" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft className="size-4" aria-hidden /> Usuários</Link>

      <Card className="flex flex-wrap items-center gap-4">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{profile.full_name}</h1>
          <p className="text-sm text-ink-muted">{overview.email}{overview.phone ? ` · ${overview.phone}` : ""}</p>
          <p className="text-sm text-ink-muted">{[profile.neighborhood, profile.city, profile.state].filter(Boolean).join(", ")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={profile.status === "ACTIVE" ? "success" : "danger"}>{profile.status}</Badge>
            <Badge>{profile.role}</Badge>
            {!overview.email_confirmed && <Badge tone="warning">E-mail não confirmado</Badge>}
            {overview.avg_rating != null && <span className="flex items-center gap-1 text-sm"><Stars value={Number(overview.avg_rating)} /> {String(overview.avg_rating).replace(".", ",")}</span>}
          </div>
        </div>
        {profile.role === "USER" && <UserStatusButtons userId={id} status={profile.status} />}
      </Card>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-line bg-white p-3"><dt className="text-xs text-ink-muted">Cadastro</dt><dd className="font-bold">{date(overview.created_at)}</dd></div>
        <div className="rounded-2xl border border-line bg-white p-3"><dt className="text-xs text-ink-muted">Último acesso</dt><dd className="font-bold">{date(overview.last_sign_in_at)}</dd></div>
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white p-3"><dt className="text-xs text-ink-muted">{k}</dt><dd className="text-xl font-extrabold tabular-nums">{v}</dd></div>
        ))}
      </dl>

      <div className="grid gap-3 lg:grid-cols-2">
        {[["Pedidos recentes", requests], ["Ajudas como ajudante", helps]].map(([title, rows]) => (
          <Card key={title as string}>
            <h2 className="mb-2 font-bold">{title as string}</h2>
            {((rows as Row[] | null) ?? []).length === 0 ? <p className="text-sm text-ink-muted">Nenhum.</p> : (
              <ul className="space-y-2 text-sm">
                {((rows as Row[] | null) ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link href={`/pedido/${r.id}`} className="truncate underline-offset-2 hover:underline">{r.title}</Link>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        <Card>
          <h2 className="mb-2 font-bold">Avaliações recebidas</h2>
          {(reviews ?? []).length === 0 ? <p className="text-sm text-ink-muted">Nenhuma.</p> : (
            <ul className="space-y-2 text-sm">
              {(reviews as { id: string; rating: number; comment: string | null; created_at: string }[]).map((r) => (
                <li key={r.id}><Stars value={r.rating} /> {r.comment && <span className="text-ink-muted">“{r.comment}”</span>} <span className="text-xs text-ink-muted">· {formatRelative(r.created_at)}</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Denúncias contra esta pessoa</h2>
          {(reports ?? []).length === 0 ? <p className="text-sm text-ink-muted">Nenhuma.</p> : (
            <ul className="space-y-2 text-sm">
              {(reports as { id: string; reason: string; description: string; status: string; created_at: string }[]).map((r) => (
                <li key={r.id}>
                  <p className="font-semibold">{REPORT_REASONS[r.reason as keyof typeof REPORT_REASONS] ?? r.reason} <Badge>{r.status}</Badge></p>
                  <p className="text-ink-muted">{r.description}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/denuncias" className="mt-2 inline-block text-sm font-semibold text-brand-700 underline">Abrir denúncias</Link>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-bold">Ações da moderação sobre esta conta</h2>
        {(audit ?? []).length === 0 ? <p className="text-sm text-ink-muted">Nenhuma ação registrada.</p> : (
          <ul className="space-y-1 text-sm">
            {(audit as { id: string; action: string; created_at: string }[]).map((a) => (
              <li key={a.id} className="flex justify-between gap-2"><span className="font-mono">{a.action}</span><span className="text-ink-muted">{date(a.created_at)}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
