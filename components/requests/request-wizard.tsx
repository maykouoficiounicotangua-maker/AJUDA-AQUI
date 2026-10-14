"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowLeft, CheckCircle2, Gift, HandCoins, HeartHandshake, Users } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, Notice } from "@/components/ui/display";
import { LocationFields } from "@/components/ui/location-fields";
import { CategoryIcon } from "@/components/requests/category-icon";
import { publishRequestAction, saveRequestAction } from "@/app/actions/requests";
import { useRunAction } from "@/hooks/useRunAction";
import { requestInputSchema, WIZARD_STEP_FIELDS } from "@/lib/validations";
import { formatBRL, formatDuration, formatRequestDate, parseBRLToCents, toLocalISODate } from "@/lib/utils/format";
import { nowInTimezone } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { Category } from "@/types";

type FormValues = z.input<typeof requestInputSchema>;
type FieldName = keyof FormValues;

const STEP_TITLES = ["Do que você precisa?", "Conte mais", "Quando?", "Onde?", "Tipo de ajuda", "Revisar", "Publicar"];
const DRAFT_KEY = "aa:request-wizard";

const HELP_TYPES = [
  { value: "FREE", label: "Gratuita", desc: "Sem pagamento", icon: Gift },
  { value: "PAID", label: "Remunerada", desc: "Você oferece um valor", icon: HandCoins },
  { value: "EXCHANGE", label: "Troca", desc: "Troco por algo", icon: HeartHandshake },
] as const;

const DURATIONS = [15, 30, 60, 90, 120, 180, 240];

/** Hoje às 18h se ainda der tempo; senão amanhã às 18h (evita começar o formulário com data já passada). */
function defaultSchedule() {
  const now = nowInTimezone();
  if (now.time < "17:00") return { scheduledDate: now.date, scheduledTime: "18:00" };
  const [y, m, d] = now.date.split("-").map(Number);
  return { scheduledDate: toLocalISODate(new Date(y, m - 1, d + 1)), scheduledTime: "18:00" };
}

export function RequestWizard({
  categories,
  initial,
  requestId,
  initialStatus,
  defaults,
}: {
  categories: Category[];
  initial?: Partial<FormValues>;
  requestId?: string;
  initialStatus?: "DRAFT" | "OPEN";
  defaults: { state: string; city: string; neighborhood: string };
}) {
  const router = useRouter();
  const { run, pending } = useRunAction();
  const [step, setStep] = useState(0);
  const [amountText, setAmountText] = useState(initial?.amountCents ? String(Number(initial.amountCents) / 100).replace(".", ",") : "");
  const [published, setPublished] = useState<{ id: string; compatible: number } | null>(null);
  const today = toLocalISODate(new Date());
  const editing = Boolean(requestId);

  const form = useForm<FormValues>({
    resolver: zodResolver(requestInputSchema as never) as never,
    mode: "onTouched",
    defaultValues: {
      categoryId: "", title: "", description: "", ...defaultSchedule(),
      durationMinutes: 60, state: defaults.state, city: defaults.city, neighborhood: defaults.neighborhood,
      address: "", helpType: "FREE", exchangeDescription: "", ...initial,
    },
  });
  const { register, watch, setValue, trigger, getValues, formState: { errors } } = form;
  const helpType = watch("helpType");
  const values = watch();

  // Rascunho LOCAL (só para novos pedidos): o que foi digitado sobrevive a um refresh.
  useEffect(() => {
    if (editing) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormValues>;
        (Object.keys(parsed) as FieldName[]).forEach((k) => parsed[k] !== undefined && setValue(k, parsed[k] as never));
        if (parsed.amountCents) setAmountText(String(Number(parsed.amountCents) / 100).replace(".", ","));
      }
    } catch { /* ignorar */ }
  }, [editing, setValue]);

  useEffect(() => {
    if (editing || published) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues())); } catch { /* ignorar */ }
    }, 400);
    return () => clearTimeout(t);
  }, [values, editing, published, getValues]);

  async function next() {
    const fields = WIZARD_STEP_FIELDS[step] as readonly FieldName[] | undefined;
    if (fields) {
      const valid = await trigger(fields as FieldName[]);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, 5));
  }

  async function validateAll(): Promise<FormValues | null> {
    const valid = await trigger();
    if (!valid) {
      // volta para a primeira etapa com erro
      const firstBad = WIZARD_STEP_FIELDS.findIndex((fs) => fs.some((f) => (form.formState.errors as Record<string, unknown>)[f]));
      if (firstBad >= 0) setStep(firstBad);
      return null;
    }
    return getValues();
  }

  async function onSave() {
    const v = await validateAll();
    if (!v) return;
    run(() => saveRequestAction(v, requestId), { refresh: false, onSuccess: () => router.push(editing ? `/pedido/${requestId}` : "/meus-pedidos") });
  }

  async function onPublish() {
    const v = await validateAll();
    if (!v) return;
    run(() => publishRequestAction(v, requestId), {
      refresh: false,
      onSuccess: (r) => {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignorar */ }
        if (r.data) setPublished(r.data);
        setStep(6);
      },
    });
  }

  if (published && step === 6) {
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto size-14 text-success-700" aria-hidden />
        <h1 className="mt-3 text-2xl font-extrabold">Pedido publicado com sucesso!</h1>
        <p className="mt-2 text-ink-muted">
          {published.compatible > 0
            ? `Encontramos ${published.compatible} ${published.compatible === 1 ? "pessoa que pode" : "pessoas que podem"} ajudar. Avisamos todas elas!`
            : "Avisaremos você assim que alguém demonstrar interesse."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <LinkButton href={`/pedido/${published.id}`}>Ver meu pedido</LinkButton>
          <LinkButton href="/inicio" variant="secondary">Voltar ao início</LinkButton>
        </div>
      </Card>
    );
  }

  const cat = categories.find((c) => c.id === values.categoryId);
  const err = (n: FieldName) => (errors[n] as { message?: string } | undefined)?.message;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center gap-2">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="grid size-11 place-items-center rounded-full hover:bg-slate-100" aria-label="Voltar etapa">
            <ArrowLeft className="size-6" aria-hidden />
          </button>
        ) : (
          <Link href={editing ? `/pedido/${requestId}` : "/inicio"} className="grid size-11 place-items-center rounded-full hover:bg-slate-100" aria-label="Cancelar">
            <ArrowLeft className="size-6" aria-hidden />
          </Link>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink-muted" aria-live="polite">Etapa {step + 1} de 7</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Progresso do pedido" aria-valuemin={1} aria-valuemax={7} aria-valuenow={step + 1}>
            <div className="h-full rounded-full bg-brand-700 transition-all" style={{ width: `${((step + 1) / 7) * 100}%` }} />
          </div>
        </div>
      </div>

      <form method="post" onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
        <h1 className="text-2xl font-extrabold">{STEP_TITLES[step]}</h1>

        {step === 0 && (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Categoria <span className="text-danger-600" aria-hidden>*</span></legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Categoria">
                {categories.map((c) => {
                  const active = values.categoryId === c.id;
                  return (
                    <button
                      key={c.id} type="button" role="radio" aria-checked={active}
                      onClick={() => setValue("categoryId", c.id, { shouldValidate: true })}
                      className={cn("flex min-h-16 items-center gap-2 rounded-2xl border p-3 text-left text-sm font-semibold", active ? "border-brand-700 bg-brand-50 text-brand-800" : "border-line bg-white")}
                    >
                      <CategoryIcon name={c.icon} className="size-5 shrink-0" /> {c.name}
                    </button>
                  );
                })}
              </div>
              {err("categoryId") && <p role="alert" className="mt-1 text-sm font-medium text-danger-700">Escolha uma categoria</p>}
            </fieldset>
            <Field label="Título do pedido" required error={err("title")} hint="Ex.: Buscar uma encomenda no correio">
              {(a) => <Input {...a} maxLength={100} {...register("title")} />}
            </Field>
          </>
        )}

        {step === 1 && (
          <Field label="Descreva o que precisa" required error={err("description")} hint="Quanto mais claro, mais fácil alguém se candidatar. Não coloque endereço, telefone ou dados bancários aqui.">
            {(a) => <Textarea {...a} rows={6} maxLength={1000} {...register("description")} />}
          </Field>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" required error={err("scheduledDate")}>
              {(a) => <Input {...a} type="date" min={today} {...register("scheduledDate")} />}
            </Field>
            <Field label="Horário" required error={err("scheduledTime")}>
              {(a) => <Input {...a} type="time" {...register("scheduledTime")} />}
            </Field>
            <Field label="Duração estimada" error={err("durationMinutes")} className="sm:col-span-2">
              {(a) => (
                <Select {...a} {...register("durationMinutes", { valueAsNumber: true })}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{formatDuration(d)}</option>)}
                </Select>
              )}
            </Field>
          </div>
        )}

        {step === 3 && (
          <>
            <LocationFields register={register} errors={errors} stateValue={values.state} />
            <Field label="Endereço (privado)" error={err("address")} hint="Opcional. Só será visto pela pessoa escolhida, depois que ela confirmar a ajuda. Nunca aparece publicamente.">
              {(a) => <Input {...a} autoComplete="street-address" maxLength={300} {...register("address")} />}
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <div className="grid gap-2" role="radiogroup" aria-label="Tipo de ajuda">
              {HELP_TYPES.map((t) => {
                const active = helpType === t.value;
                return (
                  <button
                    key={t.value} type="button" role="radio" aria-checked={active}
                    onClick={() => setValue("helpType", t.value, { shouldValidate: true })}
                    className={cn("flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-left", active ? "border-brand-700 bg-brand-50" : "border-line bg-white")}
                  >
                    <t.icon className="size-6 shrink-0 text-brand-700" aria-hidden />
                    <span><span className="block font-bold">{t.label}</span><span className="text-sm text-ink-muted">{t.desc}</span></span>
                  </button>
                );
              })}
            </div>
            {helpType === "PAID" && (
              <Field label="Valor oferecido (R$)" required error={err("amountCents")}>
                {(a) => (
                  <Input
                    {...a} inputMode="decimal" placeholder="20,00" value={amountText}
                    onChange={(e) => {
                      setAmountText(e.target.value);
                      const cents = parseBRLToCents(e.target.value);
                      setValue("amountCents", (cents ?? undefined) as never, { shouldValidate: true });
                    }}
                  />
                )}
              </Field>
            )}
            {helpType === "EXCHANGE" && (
              <Field label="O que você oferece em troca?" required error={err("exchangeDescription")}>
                {(a) => <Input {...a} maxLength={300} placeholder="Ex.: Um bolo caseiro" {...register("exchangeDescription")} />}
              </Field>
            )}
            <Notice tone="info">O Ajuda Aqui não processa pagamentos. Combinem tudo diretamente pelo chat.</Notice>
          </>
        )}

        {step === 5 && (
          <Card className="space-y-3">
            <ReviewRow label="Categoria" value={cat?.name} onEdit={() => setStep(0)} />
            <ReviewRow label="Título" value={values.title} onEdit={() => setStep(0)} />
            <ReviewRow label="Descrição" value={values.description} onEdit={() => setStep(1)} />
            <ReviewRow label="Quando" value={values.scheduledDate ? `${formatRequestDate(values.scheduledDate)} às ${values.scheduledTime} · ${formatDuration(Number(values.durationMinutes))}` : ""} onEdit={() => setStep(2)} />
            <ReviewRow label="Onde" value={[values.neighborhood, values.city, values.state].filter(Boolean).join(", ")} onEdit={() => setStep(3)} />
            <ReviewRow label="Tipo" value={helpType === "PAID" ? `Remunerada — ${formatBRL(Number(values.amountCents ?? 0))}` : helpType === "EXCHANGE" ? `Troca — ${values.exchangeDescription}` : "Gratuita"} onEdit={() => setStep(4)} />
            <p className="flex items-start gap-2 text-sm text-ink-muted"><Users className="mt-0.5 size-4 shrink-0" aria-hidden /> Pessoas compatíveis serão avisadas assim que você publicar.</p>
          </Card>
        )}

        {/* Barra de ação sempre visível (acima da navegação inferior no celular) */}
        <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-3 border-t border-line bg-canvas/95 px-4 pt-3 pb-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:px-0">
          {step < 5 && <Button size="lg" onClick={next}>Continuar</Button>}
          {step === 5 && (
            <>
              {(!editing || initialStatus === "DRAFT") && (
                <Button size="lg" variant="warm" loading={pending} onClick={onPublish}>Publicar pedido</Button>
              )}
              {editing && initialStatus === "OPEN" && (
                <Button size="lg" loading={pending} onClick={onSave}>Salvar alterações</Button>
              )}
              {(!editing || initialStatus === "DRAFT") && (
                <Button size="lg" variant="secondary" loading={pending} onClick={onSave}>Salvar como rascunho</Button>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value?: string | null; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
        <p className="break-words">{value || "—"}</p>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-sm font-semibold text-brand-700 underline">Editar</button>
    </div>
  );
}
