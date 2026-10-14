import Link from "next/link";
import { CalendarDays, Clock, MapPin, Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui/display";
import { CategoryIcon } from "@/components/requests/category-icon";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/requests/state-machine";
import { formatApproxDistance } from "@/lib/geo/distance";
import { formatBRL, formatDuration, formatRequestDate, formatTime } from "@/lib/utils/format";
import type { MatchResult } from "@/lib/matching/types";
import type { Category, HelpType, RequestStatus } from "@/types";
import { cn } from "@/lib/utils/cn";

export interface RequestCardData {
  id: string;
  title: string;
  description: string;
  help_type: HelpType;
  amount_cents: number | null;
  exchange_description: string | null;
  city: string;
  neighborhood: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: RequestStatus;
  distance_km?: number | null;
}

const TYPE_LABEL: Record<HelpType, string> = { FREE: "Gratuita", PAID: "Remunerada", EXCHANGE: "Troca" };

export function HelpTypeBadge({ type, amountCents, exchange }: { type: HelpType; amountCents: number | null; exchange?: string | null }) {
  if (type === "PAID") return <Badge tone="success">{formatBRL(amountCents)}</Badge>;
  if (type === "EXCHANGE") return <Badge tone="info" title={exchange ?? undefined}>Troca</Badge>;
  return <Badge tone="neutral">{TYPE_LABEL[type]}</Badge>;
}

export function MatchBadge({ match }: { match?: MatchResult | null }) {
  if (!match?.label) return null;
  return (
    <Badge tone={match.label === "Alta compatibilidade" ? "success" : "info"}>
      <Sparkles className="size-3" aria-hidden /> {match.label}
    </Badge>
  );
}

export function RequestCard({
  request,
  category,
  match,
  showStatus = false,
  cta = true,
  href,
}: {
  request: RequestCardData;
  category?: Category | null;
  match?: MatchResult | null;
  showStatus?: boolean;
  cta?: boolean;
  href?: string;
}) {
  const distance = formatApproxDistance(request.distance_km);
  const where = [request.neighborhood, request.city].filter(Boolean).join(", ");
  const link = href ?? `/pedido/${request.id}`;
  return (
    <Card className="relative flex flex-col gap-3 transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <CategoryIcon name={category?.icon} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-muted">{category?.name ?? "Ajuda"}</p>
          <h3 className="text-lg leading-snug font-bold">
            {/* O link cobre o cartão inteiro (área de toque grande) */}
            <Link href={link} className="after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-[var(--radius-card)]">
              {request.title}
            </Link>
          </h3>
        </div>
        <HelpTypeBadge type={request.help_type} amountCents={request.amount_cents} exchange={request.exchange_description} />
      </div>

      <p className="line-clamp-2 text-ink-muted">{request.description}</p>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        <li className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{where}{distance ? ` · ${distance}` : ""}</li>
        <li className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{formatRequestDate(request.scheduled_date)}</li>
        <li className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden />{formatTime(request.scheduled_time)} · {formatDuration(request.duration_minutes)}</li>
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <MatchBadge match={match} />
        {showStatus && <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABELS[request.status]}</Badge>}
        {cta && request.status === "OPEN" && (
          <span className={cn("ml-auto inline-flex min-h-10 items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white")}>
            TENHO INTERESSE
          </span>
        )}
      </div>
    </Card>
  );
}

export function RequestCardSkeleton() {
  return (
    <div aria-hidden className="h-44 animate-pulse rounded-[var(--radius-card)] border border-line bg-white" />
  );
}
