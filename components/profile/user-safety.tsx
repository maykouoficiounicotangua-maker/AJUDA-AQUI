"use client";

import { useState } from "react";
import { Ban, Flag, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/display";
import { useRunAction } from "@/hooks/useRunAction";
import { blockUserAction, reportUserAction, unblockUserAction } from "@/app/actions/social";
import { REPORT_REASONS, reportSchema } from "@/lib/validations";

/** Bloquear / denunciar. Usado no perfil e na conversa. */
export function UserSafety({
  userId, userName, blocked, requestId, conversationId,
}: { userId: string; userName: string; blocked: boolean; requestId?: string; conversationId?: string }) {
  const [mode, setMode] = useState<"idle" | "block" | "report">("idle");
  const [reason, setReason] = useState<keyof typeof REPORT_REASONS | "">("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useRunAction();

  function submitReport() {
    const parsed = reportSchema.safeParse({ reportedUserId: userId, reason, description, requestId, conversationId });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    run(() => reportUserAction(parsed.data), { onSuccess: () => { setMode("idle"); setDescription(""); setReason(""); } });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {blocked ? (
          <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => unblockUserAction(userId))}>
            <ShieldCheck className="size-4" aria-hidden /> Desbloquear
          </Button>
        ) : (
          <Button variant="dangerOutline" size="sm" onClick={() => setMode("block")}><Ban className="size-4" aria-hidden /> Bloquear</Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setMode("report")}><Flag className="size-4" aria-hidden /> Denunciar</Button>
      </div>

      {mode === "block" && (
        <Card className="space-y-3 border-danger-600/40 bg-danger-50">
          <p className="font-semibold">Bloquear {userName}?</p>
          <p className="text-sm text-ink-muted">Vocês não poderão trocar mensagens, enviar propostas ou ver os pedidos um do outro.</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMode("idle")}>Voltar</Button>
            <Button variant="danger" size="sm" loading={pending} onClick={() => run(() => blockUserAction(userId), { onSuccess: () => setMode("idle") })}>Sim, bloquear</Button>
          </div>
        </Card>
      )}

      {mode === "report" && (
        <Card className="space-y-3">
          <p className="font-semibold">Denunciar {userName}</p>
          <Field label="Motivo" required error={errors.reason}>
            {(a) => (
              <Select {...a} value={reason} onChange={(e) => setReason(e.target.value as keyof typeof REPORT_REASONS)}>
                <option value="">Selecione</option>
                {Object.entries(REPORT_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </Field>
          <Field label="O que aconteceu?" required error={errors.description}>
            {(a) => <Textarea {...a} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1000} />}
          </Field>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("idle")}>Cancelar</Button>
            <Button size="sm" className="flex-1" loading={pending} onClick={submitReport}>Enviar denúncia</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
