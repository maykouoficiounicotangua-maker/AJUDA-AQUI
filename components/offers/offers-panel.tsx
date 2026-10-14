"use client";

import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/display";
import { useRunAction } from "@/hooks/useRunAction";
import { acceptOfferAction, rejectOfferAction } from "@/app/actions/offers";
import { formatRelative } from "@/lib/utils/format";

export interface OfferItem {
  id: string;
  helperId: string;
  message: string;
  status: string;
  createdAt: string;
  helperName: string;
  /** Perfil já renderizado no servidor (server component passa como children) */
  profile: React.ReactNode;
  matchLabel?: string | null;
}

export function OffersPanel({ requestId, offers, canDecide }: { requestId: string; offers: OfferItem[]; canDecide: boolean }) {
  const router = useRouter();
  const { run, pending } = useRunAction();

  return (
    <ul className="space-y-3">
      {offers.map((o) => (
        <li key={o.id}>
          <Card className="space-y-3">
            {o.profile}
            <p className="rounded-2xl bg-slate-50 p-3">“{o.message}”</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-ink-muted">{formatRelative(o.createdAt)}</span>
              {o.status !== "PENDING" ? (
                <Badge tone={o.status === "ACCEPTED" ? "success" : "neutral"}>
                  {{ ACCEPTED: "Aceita", REJECTED: "Recusada", WITHDRAWN: "Retirada", EXPIRED: "Expirada" }[o.status] ?? o.status}
                </Badge>
              ) : canDecide ? (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => rejectOfferAction(o.id, requestId))}>
                    <X className="size-4" aria-hidden /> Recusar
                  </Button>
                  <Button
                    size="sm" loading={pending}
                    onClick={() => run(() => acceptOfferAction(o.id, requestId, o.helperId), { onSuccess: (r) => r.data && router.push(`/conversa/${r.data.conversationId}`) })}
                  >
                    <Check className="size-4" aria-hidden /> Aceitar {o.helperName}
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
