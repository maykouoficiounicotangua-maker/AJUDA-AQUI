"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/display";
import { useRunAction } from "@/hooks/useRunAction";
import {
  cancelRequestAsAdminAction, resolveDisputeAction, resolveReportAction, saveCategoryAction, setCategoryActiveAction, setUserStatusAction,
} from "@/app/actions/admin";
import { CATEGORY_ICON_NAMES } from "@/components/requests/category-icon";
import { slugify } from "@/lib/validations";

export function UserStatusButtons({ userId, status }: { userId: string; status: string }) {
  const { run, pending } = useRunAction();
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "ACTIVE" && <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => setUserStatusAction(userId, "ACTIVE"))}>Reativar</Button>}
      {status !== "SUSPENDED" && <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => setUserStatusAction(userId, "SUSPENDED"))}>Suspender</Button>}
      {status !== "BLOCKED" && <Button size="sm" variant="dangerOutline" loading={pending} onClick={() => run(() => setUserStatusAction(userId, "BLOCKED"))}>Bloquear</Button>}
    </div>
  );
}

export function AdminCancelRequest({ requestId }: { requestId: string }) {
  const { run, pending } = useRunAction();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <Button size="sm" variant="dangerOutline" onClick={() => setConfirm(true)}>Cancelar pedido</Button>;
  return (
    <span className="inline-flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>Voltar</Button>
      <Button size="sm" variant="danger" loading={pending} onClick={() => run(() => cancelRequestAsAdminAction(requestId, "Removido pela moderação"))}>Confirmar</Button>
    </span>
  );
}

export function ReportResolver({ reportId }: { reportId: string }) {
  const [notes, setNotes] = useState("");
  const [suspend, setSuspend] = useState(false);
  const { run, pending } = useRunAction();
  const send = (status: "UNDER_REVIEW" | "RESOLVED" | "DISMISSED") => run(() => resolveReportAction({ reportId, status, notes, suspend }));
  return (
    <div className="space-y-3">
      <Field label="Notas da análise">{(a) => <Textarea {...a} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-brand-700" checked={suspend} onChange={(e) => setSuspend(e.target.checked)} /> Suspender o usuário denunciado</label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" loading={pending} onClick={() => send("UNDER_REVIEW")}>Em análise</Button>
        <Button size="sm" loading={pending} onClick={() => send("RESOLVED")}>Resolver</Button>
        <Button size="sm" variant="ghost" loading={pending} onClick={() => send("DISMISSED")}>Arquivar</Button>
      </div>
    </div>
  );
}

export function DisputeResolver({ disputeId }: { disputeId: string }) {
  const [resolution, setResolution] = useState("");
  const [outcome, setOutcome] = useState<"" | "COMPLETED" | "CANCELLED">("");
  const { run, pending } = useRunAction();
  const send = (status: "UNDER_REVIEW" | "RESOLVED" | "DISMISSED") =>
    run(() => resolveDisputeAction({ disputeId, status, resolution, outcome: outcome || null }));
  return (
    <div className="space-y-3">
      <Field label="Decisão / observações">{(a) => <Textarea {...a} rows={2} maxLength={1000} value={resolution} onChange={(e) => setResolution(e.target.value)} />}</Field>
      <Field label="Resultado do pedido">
        {(a) => (
          <Select {...a} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
            <option value="">Manter como está</option>
            <option value="COMPLETED">Marcar como concluído</option>
            <option value="CANCELLED">Cancelar pedido</option>
          </Select>
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" loading={pending} onClick={() => send("UNDER_REVIEW")}>Em análise</Button>
        <Button size="sm" loading={pending} onClick={() => send("RESOLVED")}>Resolver</Button>
        <Button size="sm" variant="ghost" loading={pending} onClick={() => send("DISMISSED")}>Arquivar</Button>
      </div>
    </div>
  );
}

export function CategoryEditor({ category }: { category?: { id: string; name: string; slug: string; icon: string; description: string | null; active: boolean } }) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "HandHelping");
  const [description, setDescription] = useState(category?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useRunAction();

  function save() {
    run(async () => {
      const res = await saveCategoryAction({ name, slug: slug || slugify(name), icon, description }, category?.id);
      setErrors(res.fieldErrors ?? {});
      return res;
    }, { onSuccess: () => { if (!category) { setName(""); setSlug(""); setDescription(""); } } });
  }

  return (
    <Card className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" error={errors.name}>{(a) => <Input {...a} value={name} onChange={(e) => { setName(e.target.value); if (!category) setSlug(slugify(e.target.value)); }} maxLength={60} />}</Field>
        <Field label="Identificador (slug)" error={errors.slug}>{(a) => <Input {...a} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={60} />}</Field>
        <Field label="Ícone">{(a) => <Select {...a} value={icon} onChange={(e) => setIcon(e.target.value)}>{CATEGORY_ICON_NAMES.map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
        <Field label="Descrição">{(a) => <Input {...a} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />}</Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={pending} onClick={save}>{category ? "Salvar" : "Criar categoria"}</Button>
        {category && (
          <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => setCategoryActiveAction(category.id, !category.active))}>
            {category.active ? "Desativar" : "Ativar"}
          </Button>
        )}
      </div>
    </Card>
  );
}
