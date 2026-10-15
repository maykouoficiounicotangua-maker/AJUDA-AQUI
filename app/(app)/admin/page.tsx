import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BellRing, CheckCircle2, Clock, HandHeart, Inbox, Users, Wallet } from "lucide-react";
import { Card, Notice, PageHeader } from "@/components/ui/display";
import { DailyBars, HBarList } from "@/components/admin/charts";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { getSupabase } from "@/lib/auth/session";
import { formatBRL } from "@/lib/utils/format";
import { REPORT_REASONS } from "@/lib/validations";
import { getMetrics, type RankedUser } from "@/services/admin";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Painel" };

const nf = new Intl.NumberFormat("pt-BR");
const PERIODS = [7, 30, 90];

function Kpi({ icon: Icon, label, value, hint, tone = "brand" }: { icon: typeof Users; label: string; value: string; hint: string; tone?: "brand" | "warm" | "danger" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
        <Icon className={cn("size-4", tone === "brand" ? "text-brand-700" : tone === "warm" ? "text-warm-700" : "text-danger-700")} aria-hidden /> {label}
      </div>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
    </Card>
  );
}

function Ranking({ title, hint, users, metric }: { title: string; hint: string; users: RankedUser[]; metric: (u: RankedUser) => string }) {
  return (
    <Card>
      <h3 className="font-bold">{title}</h3>
      <p className="mb-3 text-xs text-ink-muted">{hint}</p>
      {users.length === 0 ? (
        <p className="text-sm text-ink-muted">Ainda sem dados.</p>
      ) : (
        <ol className="space-y-2">
          {users.map((u, i) => (
            <li key={u.id} className="flex items-center gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>
              <Link href={`/admin/usuarios/${u.id}`} className="min-w-0 flex-1 truncate font-semibold underline-offset-2 hover:underline">
                {u.name} <span className="font-normal text-ink-muted">{u.city ? `· ${u.city}` : ""}</span>
              </Link>
              <span className="shrink-0 tabular-nums">{metric(u)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const m = await getMetrics(await getSupabase(), days);
  if (!m) {
    return <Notice tone="danger" title="Não conseguimos carregar as métricas">Confira se a migration 0009 foi aplicada no Supabase.</Notice>;
  }

  const pct = (v: number | null) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
  const funnel = [
    { label: "Criaram conta", value: m.funnel.signups },
    { label: "Concluíram o onboarding", value: m.funnel.onboarded },
    { label: "Publicaram um pedido", value: m.funnel.first_request },
    { label: "Ofereceram ajuda", value: m.funnel.first_offer },
    { label: "Concluíram uma ajuda", value: m.funnel.first_completion },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Painel do administrador"
        subtitle="Como a comunidade está usando o Ajuda Aqui. Números do período escolhido, exceto quando indicado."
        action={
          <nav aria-label="Período" className="flex shrink-0 gap-1 rounded-2xl bg-slate-100 p-1">
            {PERIODS.map((p) => (
              <Link key={p} href={`/admin?dias=${p}`} aria-current={p === days ? "page" : undefined}
                className={cn("rounded-xl px-3 py-2 text-sm font-semibold", p === days ? "bg-white shadow" : "text-ink-muted")}>
                {p} dias
              </Link>
            ))}
          </nav>
        }
      />

      {(m.safety.reports_open > 0 || m.safety.disputes_open > 0) && (
        <Notice tone="warning" title="Precisa da sua atenção">
          {m.safety.reports_open > 0 && <><Link href="/admin/denuncias" className="font-semibold underline">{m.safety.reports_open} denúncia(s) em aberto</Link>. </>}
          {m.safety.disputes_open > 0 && <Link href="/admin/disputas" className="font-semibold underline">{m.safety.disputes_open} disputa(s) aguardando decisão</Link>}
        </Notice>
      )}

      <section aria-labelledby="pessoas" className="space-y-3">
        <h2 id="pessoas" className="text-xl font-extrabold">Pessoas</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Users} label="Usuários" value={nf.format(m.users.total)} hint={`+${nf.format(m.users.new_period)} no período · +${nf.format(m.users.new_7d)} em 7 dias`} />
          <Kpi icon={Users} label="Ativos hoje" value={nf.format(m.users.active_1d)} hint={`${nf.format(m.users.active_7d)} na semana · ${nf.format(m.users.active_30d)} no mês (fizeram algo no app)`} />
          <Kpi icon={HandHeart} label="Disponíveis para ajudar" value={nf.format(m.users.helpers_available)} hint="Com área de ajuda ativa (recebem avisos de pedidos)" />
          <Kpi icon={BellRing} label="Com notificações push" value={nf.format(m.users.with_push)} hint={`${nf.format(m.push.subscriptions_active)} aparelhos ativos`} />
        </div>
      </section>

      <section aria-labelledby="pedidos" className="space-y-3">
        <h2 id="pedidos" className="text-xl font-extrabold">Pedidos e ajudas</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Inbox} label="Abertos agora" value={nf.format(m.requests.open)} hint={`${nf.format(m.requests.in_progress)} em andamento · ${nf.format(m.requests.created_period)} publicados no período`} tone="warm" />
          <Kpi icon={CheckCircle2} label="Ajudas concluídas" value={nf.format(m.requests.completed)} hint={`${nf.format(m.requests.completed_period)} no período · taxa de conclusão ${pct(m.requests.completion_rate_pct)}`} />
          <Kpi icon={Clock} label="Até a 1ª proposta" value={m.requests.median_hours_first_offer == null ? "—" : `${String(m.requests.median_hours_first_offer).replace(".", ",")} h`} hint={`Mediana. ${pct(m.requests.with_offer_pct)} dos pedidos recebem proposta`} />
          <Kpi icon={Wallet} label="Valor combinado (pagas)" value={formatBRL(m.requests.paid_volume_cents)} hint="Soma das ajudas remuneradas concluídas (o app não intermedeia)" />
        </div>
      </section>

      <section aria-labelledby="atividade" className="space-y-3">
        <h2 id="atividade" className="text-xl font-extrabold">Atividade por dia</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DailyBars title="Novos cadastros" data={m.series.map((s) => ({ day: s.day, value: s.signups }))} />
          <DailyBars title="Pedidos publicados" data={m.series.map((s) => ({ day: s.day, value: s.requests }))} />
          <DailyBars title="Propostas enviadas" data={m.series.map((s) => ({ day: s.day, value: s.offers }))} />
          <DailyBars title="Ajudas concluídas" data={m.series.map((s) => ({ day: s.day, value: s.completed }))} />
          <DailyBars title="Mensagens no chat" data={m.series.map((s) => ({ day: s.day, value: s.messages }))} />
        </div>
      </section>

      <section aria-labelledby="ranking" className="space-y-3">
        <h2 id="ranking" className="text-xl font-extrabold">Quem movimenta a comunidade</h2>
        <p className="text-sm text-ink-muted">Uso interno da moderação. Estes rankings nunca aparecem para os usuários.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Ranking title="Quem mais ajuda" hint="Ajudas concluídas como ajudante (todo o histórico)" users={m.top_helpers}
            metric={(u) => `${u.helps} ${u.helps === 1 ? "ajuda" : "ajudas"}${u.rating ? ` · ★ ${String(u.rating).replace(".", ",")}` : ""}`} />
          <Ranking title="Quem mais pede ajuda" hint="Pedidos publicados (concluídos entre parênteses)" users={m.top_requesters}
            metric={(u) => `${u.requests} (${u.completed})`} />
          <Ranking title="Mais bem avaliados" hint="Média das avaliações, mínimo de 3" users={m.top_rated}
            metric={(u) => `★ ${String(u.rating).replace(".", ",")} · ${u.reviews}`} />
          <Ranking title="Mais denunciados" hint="Total de denúncias recebidas — revise com cuidado" users={m.most_reported}
            metric={(u) => `${u.reports} ${u.status !== "ACTIVE" ? `· ${u.status}` : ""}`} />
        </div>
      </section>

      <section aria-labelledby="funil" className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 id="funil" className="font-bold">Jornada de quem chegou no período</h2>
          <p className="mb-3 text-xs text-ink-muted">Quantos novos usuários avançaram em cada etapa.</p>
          <HBarList items={funnel} valueLabel="pessoas" />
        </Card>
        <Card>
          <h2 className="font-bold">Oferta × demanda por categoria</h2>
          <p className="mb-3 text-xs text-ink-muted">Pedidos publicados e quantas pessoas se dispõem a ajudar em cada categoria.</p>
          <HBarList items={m.categories.map((c) => ({ label: c.name, value: c.requests, note: `${c.helpers} ajudantes · ${c.completed} concluídos` }))} valueLabel="pedidos" />
        </Card>
        <Card>
          <h2 className="font-bold">Cidades com mais usuários</h2>
          <p className="mb-3 text-xs text-ink-muted">Onde a comunidade está crescendo.</p>
          <HBarList items={m.cities.map((c) => ({ label: `${c.city}/${c.state}`, value: c.users, note: `${c.requests} pedidos` }))} valueLabel="usuários" />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">Engajamento e saúde</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Mensagens no período", nf.format(m.engagement.messages_period)],
              ["Logins no período", nf.format(m.engagement.logins_period)],
              ["Pedidos vistos", nf.format(m.engagement.request_views_period)],
              ["Avaliação média", m.engagement.avg_rating == null ? "—" : `★ ${String(m.engagement.avg_rating).replace(".", ",")}`],
              ["Push entregues", nf.format(m.push.sent_period)],
              ["Push com falha", nf.format(m.push.failed_period)],
              ["Denúncias no período", nf.format(m.safety.reports_period)],
              ["Bloqueios (total)", nf.format(m.safety.blocks_total)],
              ["Contas suspensas", nf.format(m.users.suspended)],
              ["Contas bloqueadas", nf.format(m.users.blocked)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-ink-muted">{k}</dt><dd className="text-lg font-extrabold tabular-nums">{v}</dd></div>
            ))}
          </dl>
          {Object.keys(m.safety.reports_by_reason).length > 0 && (
            <p className="flex items-start gap-2 text-xs text-ink-muted">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Denúncias por motivo: {Object.entries(m.safety.reports_by_reason).map(([k, v]) => `${REPORT_REASONS[k as keyof typeof REPORT_REASONS] ?? k} (${v})`).join(", ")}
            </p>
          )}
        </Card>
      </section>

      <section aria-labelledby="aviso" className="space-y-3">
        <h2 id="aviso" className="text-xl font-extrabold">Enviar aviso para a comunidade</h2>
        <BroadcastForm />
      </section>
    </div>
  );
}
