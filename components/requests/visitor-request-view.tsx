import { CalendarDays, Clock, HandHeart, Lock, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { Avatar, Badge, Card, Stars } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { CategoryIcon } from "@/components/requests/category-icon";
import { HelpTypeBadge } from "@/components/requests/request-card";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { formatDuration, formatRequestDate, formatTime } from "@/lib/utils/format";
import type { PublicRequestDetail } from "@/services/public";
import type { Category } from "@/types";

/** Pedido visto por quem ainda não entrou. Mostra o essencial e convida a ajudar (login só agora). */
export function VisitorRequestView({ request, category }: { request: PublicRequestDetail; category?: Category }) {
  const next = encodeURIComponent(`/pedido/${request.id}#proposta`);
  const where = [request.neighborhood, request.city, request.state].filter(Boolean).join(", ");
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <CategoryIcon name={category?.icon} className="size-4" /> {category?.name}
        </div>
        <h1 className="text-2xl leading-tight font-extrabold sm:text-3xl">{request.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">Aberto</Badge>
          <HelpTypeBadge type={request.help_type} amountCents={request.amount_cents} />
        </div>
      </header>

      <Card className="space-y-4">
        <p className="break-words whitespace-pre-line">{request.description}</p>
        <ul className="grid gap-2 text-ink-muted sm:grid-cols-2">
          <li className="flex items-center gap-2"><CalendarDays className="size-5" aria-hidden /> {formatRequestDate(request.scheduled_date)}</li>
          <li className="flex items-center gap-2"><Clock className="size-5" aria-hidden /> {formatTime(request.scheduled_time)} · {formatDuration(request.duration_minutes)}</li>
          <li className="flex items-center gap-2"><MapPin className="size-5" aria-hidden /> {where}</li>
          {request.help_type === "EXCHANGE" && (
            <li className="flex items-center gap-2 sm:col-span-2"><Wallet className="size-5" aria-hidden /> Troca: {request.exchange_description}</li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">Quem pediu</h2>
        <div className="flex items-center gap-3">
          <Avatar name={request.requester_first_name} src={request.requester_avatar_url} size={52} />
          <div>
            <p className="font-bold">{request.requester_first_name}</p>
            {request.requester_reviews > 0 && request.requester_rating != null ? (
              <p className="flex items-center gap-1 text-sm"><Stars value={Number(request.requester_rating)} /> ({request.requester_reviews})</p>
            ) : (
              <p className="text-sm text-ink-muted">Sem avaliações ainda</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-3 border-brand-200 bg-brand-50" id="proposta">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><HandHeart className="size-6 text-brand-700" aria-hidden /> Pode ajudar {request.requester_first_name}?</h2>
        <p className="text-sm">
          Para enviar sua proposta, entre ou crie sua conta grátis (leva menos de 1 minuto). Você volta direto para este pedido.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <LinkButton href={`/cadastrar?next=${next}`} size="lg" className="flex-1">TENHO INTERESSE — criar conta</LinkButton>
          <LinkButton href={`/entrar?next=${next}`} variant="secondary" size="lg">Já tenho conta</LinkButton>
        </div>
        <p className="flex items-start gap-2 text-xs text-ink-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> O endereço só é liberado para a pessoa escolhida, depois que ela confirma a ajuda.
        </p>
      </Card>

      <RequestTimeline status="OPEN" />

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> Antes de qualquer encontro, leia as <a href="/seguranca" className="font-semibold underline">dicas de segurança</a>.
      </p>
    </div>
  );
}
