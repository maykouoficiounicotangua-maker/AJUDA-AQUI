"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/display";
import { useRunAction } from "@/hooks/useRunAction";
import { submitReviewAction } from "@/app/actions/social";
import { cn } from "@/lib/utils/cn";

function StarPicker({ label, value, onChange, large }: { label: string; value: number; onChange: (v: number) => void; large?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center justify-between gap-3">
      <span className={cn("font-semibold", !large && "text-sm")}>{label}</span>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            onClick={() => onChange(n)} className="grid size-11 place-items-center"
          >
            <Star className={cn(large ? "size-8" : "size-6", n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
          </button>
        ))}
      </span>
    </div>
  );
}

export function ReviewForm({ requestId, otherName }: { requestId: string; otherName: string }) {
  const [rating, setRating] = useState(0);
  const [crit, setCrit] = useState({ punctuality: 0, respect: 0, communication: 0, fulfillment: 0 });
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const { run, pending } = useRunAction();

  function submit() {
    if (rating < 1) return setError("Escolha de 1 a 5 estrelas");
    setError(undefined);
    const optional = Object.fromEntries(Object.entries(crit).filter(([, v]) => v > 0));
    run(() => submitReviewAction(requestId, { rating, comment, ...optional }));
  }

  return (
    <Card id="avaliar" className="space-y-3">
      <h2 className="text-xl font-extrabold">Como foi com {otherName}?</h2>
      <StarPicker label="Avaliação geral" value={rating} onChange={setRating} large />
      {error && <p role="alert" className="text-sm font-medium text-danger-700">{error}</p>}
      <details className="rounded-2xl bg-slate-50 p-3">
        <summary className="cursor-pointer font-semibold">Detalhar (opcional)</summary>
        <div className="mt-2 space-y-1">
          <StarPicker label="Pontualidade" value={crit.punctuality} onChange={(v) => setCrit({ ...crit, punctuality: v })} />
          <StarPicker label="Respeito" value={crit.respect} onChange={(v) => setCrit({ ...crit, respect: v })} />
          <StarPicker label="Comunicação" value={crit.communication} onChange={(v) => setCrit({ ...crit, communication: v })} />
          <StarPicker label="Cumprimento do combinado" value={crit.fulfillment} onChange={(v) => setCrit({ ...crit, fulfillment: v })} />
        </div>
      </details>
      <Field label="Comentário (opcional)">
        {(a) => <Textarea {...a} rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />}
      </Field>
      <Button size="lg" className="w-full" loading={pending} onClick={submit}>Enviar avaliação</Button>
    </Card>
  );
}
