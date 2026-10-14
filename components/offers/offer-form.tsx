"use client";

import { useState } from "react";
import { HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/display";
import { useRunAction } from "@/hooks/useRunAction";
import { submitOfferAction, withdrawOfferAction } from "@/app/actions/offers";
import { offerMessageSchema } from "@/lib/validations";

export function OfferForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const { run, pending } = useRunAction();

  function submit() {
    const parsed = offerMessageSchema.safeParse({ message });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    run(() => submitOfferAction(requestId, { message }), { onSuccess: () => setOpen(false) });
  }

  if (!open) {
    return (
      <Button id="proposta" size="lg" className="w-full" onClick={() => setOpen(true)}>
        <HandHeart className="size-5" aria-hidden /> TENHO INTERESSE
      </Button>
    );
  }
  return (
    <Card id="proposta" className="space-y-3 border-brand-200">
      <Field label="Conte rapidamente por que você pode ajudar." required error={error} hint="Ex.: Posso realizar essa tarefa hoje às 18h.">
        {(a) => <Textarea {...a} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={500} autoFocus />}
      </Field>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
        <Button className="flex-1" loading={pending} onClick={submit}>Enviar proposta</Button>
      </div>
    </Card>
  );
}

export function MyOfferNotice({ offerId, requestId, status, message }: { offerId: string; requestId: string; status: string; message: string }) {
  const { run, pending } = useRunAction();
  const labels: Record<string, string> = {
    PENDING: "Proposta enviada — aguardando resposta", ACCEPTED: "Sua proposta foi aceita!",
    REJECTED: "Sua proposta não foi selecionada", WITHDRAWN: "Você retirou sua proposta", EXPIRED: "Proposta expirada",
  };
  return (
    <Card className="space-y-2">
      <p className="font-bold">{labels[status] ?? status}</p>
      <p className="text-ink-muted">“{message}”</p>
      {status === "PENDING" && (
        <Button variant="dangerOutline" size="sm" loading={pending} onClick={() => run(() => withdrawOfferAction(offerId, requestId))}>
          Retirar proposta
        </Button>
      )}
    </Card>
  );
}
