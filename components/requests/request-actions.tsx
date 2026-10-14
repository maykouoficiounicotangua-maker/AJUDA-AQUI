"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Pencil, PlayCircle, Undo2, XCircle } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/display";
import { useRunAction } from "@/hooks/useRunAction";
import {
  cancelRequestAction, confirmStartAction, deleteDraftAction, helperWithdrawAction, markDoneAction, reportProblemAction,
} from "@/app/actions/requests";
import { disputeSchema } from "@/lib/validations";
import type { RequestAction } from "@/lib/requests/state-machine";

export function RequestActions({ requestId, actions }: { requestId: string; actions: RequestAction[] }) {
  const router = useRouter();
  const { run, pending } = useRunAction();
  const [problemOpen, setProblemOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const has = (a: RequestAction) => actions.includes(a);

  return (
    <div className="space-y-3">
      {has("confirm_start") && (
        <Button size="lg" className="w-full" loading={pending} onClick={() => run(() => confirmStartAction(requestId))}>
          <PlayCircle className="size-5" aria-hidden /> Confirmar e começar
        </Button>
      )}
      {has("mark_done") && (
        <Button size="lg" variant="warm" className="w-full" loading={pending} onClick={() => run(() => markDoneAction(requestId))}>
          <CheckCircle2 className="size-5" aria-hidden /> AJUDA CONCLUÍDA
        </Button>
      )}
      {has("report_problem") && !problemOpen && (
        <Button variant="secondary" className="w-full" onClick={() => setProblemOpen(true)}>
          <AlertTriangle className="size-5" aria-hidden /> TIVE UM PROBLEMA
        </Button>
      )}
      {problemOpen && <ProblemForm requestId={requestId} onClose={() => setProblemOpen(false)} />}

      <div className="flex flex-wrap gap-2">
        {has("edit") && (
          <LinkButton href={`/pedido/${requestId}/editar`} variant="secondary" size="sm"><Pencil className="size-4" aria-hidden /> Editar</LinkButton>
        )}
        {has("withdraw") && (
          <Button variant="dangerOutline" size="sm" loading={pending} onClick={() => run(() => helperWithdrawAction(requestId))}>
            <Undo2 className="size-4" aria-hidden /> Desistir da ajuda
          </Button>
        )}
        {has("cancel") && !confirmCancel && (
          <Button variant="dangerOutline" size="sm" onClick={() => setConfirmCancel(true)}><XCircle className="size-4" aria-hidden /> Cancelar pedido</Button>
        )}
      </div>

      {confirmCancel && (
        <Card className="space-y-3 border-danger-600/40 bg-danger-50">
          <p className="font-semibold">Tem certeza que deseja cancelar este pedido?</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)}>Voltar</Button>
            <Button variant="danger" size="sm" loading={pending} onClick={() => run(() => cancelRequestAction(requestId), { onSuccess: () => setConfirmCancel(false) })}>
              Sim, cancelar
            </Button>
          </div>
        </Card>
      )}

      {has("publish") && (
        <div className="flex gap-2">
          <LinkButton href={`/pedido/${requestId}/editar`} size="sm">Revisar e publicar</LinkButton>
          <Button variant="dangerOutline" size="sm" loading={pending} onClick={() => run(() => deleteDraftAction(requestId), { onSuccess: () => router.push("/meus-pedidos") })}>
            Excluir rascunho
          </Button>
        </div>
      )}
    </div>
  );
}

function ProblemForm({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useRunAction();

  function submit() {
    const parsed = disputeSchema.safeParse({ requestId, reason, description });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    run(() => reportProblemAction({ requestId, reason, description }), { onSuccess: onClose });
  }

  return (
    <Card className="space-y-3 border-warm-500/40">
      <h3 className="font-bold">Conte o que aconteceu</h3>
      <p className="text-sm text-ink-muted">Nossa equipe vai analisar. O pedido ficará “em análise” até uma decisão.</p>
      <Field label="Motivo" required error={errors.reason}>
        {(a) => <Input {...a} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} placeholder="Ex.: A pessoa não compareceu" />}
      </Field>
      <Field label="Descrição" required error={errors.description}>
        {(a) => <Textarea {...a} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={4} />}
      </Field>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
        <Button className="flex-1" loading={pending} onClick={submit}>Enviar relato</Button>
      </div>
    </Card>
  );
}
