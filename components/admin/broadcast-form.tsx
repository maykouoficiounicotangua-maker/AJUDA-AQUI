"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useRunAction } from "@/hooks/useRunAction";
import { broadcastAction } from "@/app/actions/admin";
import { BR_STATES } from "@/lib/geo/locations";

/** Aviso geral: notificação no app + push para todos (ou um estado). Pede confirmação antes de enviar. */
export function BroadcastForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useRunAction();

  const send = () =>
    run(async () => {
      const r = await broadcastAction({ title, body, url: url || undefined, state: state || undefined });
      setErrors(r.fieldErrors ?? {});
      return r;
    }, { onSuccess: () => { setTitle(""); setBody(""); setUrl(""); setConfirm(false); } });

  return (
    <Card className="space-y-3">
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Megaphone className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
        Use para comunicados importantes (novidades, manutenção, segurança). Respeita a preferência “Avisos importantes” de cada pessoa. Limite de 5 por dia.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" required error={errors.title}>{(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}</Field>
        <Field label="Para quem">
          {(a) => (
            <Select {...a} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Todo o Brasil</option>
              {BR_STATES.map((s) => <option key={s.code} value={s.code}>Só {s.name}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Mensagem" required error={errors.body}>{(a) => <Textarea {...a} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} />}</Field>
      <Field label="Abrir qual página ao tocar (opcional)" error={errors.url} hint="Ex.: /explorar ou /seguranca">
        {(a) => <Input {...a} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/explorar" />}
      </Field>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-caution-50 p-3 text-sm">
          <span className="flex-1 font-semibold">Enviar agora para {state ? `usuários de ${state}` : "todos os usuários"}?</span>
          <Button variant="secondary" size="sm" onClick={() => setConfirm(false)} disabled={pending}>Voltar</Button>
          <Button size="sm" loading={pending} onClick={send}>Sim, enviar</Button>
        </div>
      ) : (
        <Button onClick={() => setConfirm(true)} disabled={title.trim().length < 3 || body.trim().length < 5}>Revisar e enviar</Button>
      )}
    </Card>
  );
}
