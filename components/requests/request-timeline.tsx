import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { RequestStatus } from "@/types";

const STEPS = [
  { label: "Pedido publicado", hint: "Pessoas por perto podem se oferecer para ajudar." },
  { label: "Ajudante escolhido", hint: "Quem pediu escolhe uma das propostas e o chat é aberto." },
  { label: "Os dois confirmam", hint: "Cada um confirma pelo app. Aí o endereço é liberado para quem vai ajudar." },
  { label: "Ajuda acontece", hint: "Combinem os detalhes pelo chat. Em qualquer problema, use “Tive um problema”." },
  { label: "Concluída e avaliada", hint: "Os dois marcam como concluída e se avaliam." },
];

function currentStep(status: RequestStatus): number {
  switch (status) {
    case "DRAFT":
    case "PUBLISHED":
      return -1;
    case "OPEN":
      return 0;
    case "ASSIGNED":
      return 1;
    case "AWAITING_CONFIRMATION":
      return 2;
    case "IN_PROGRESS":
    case "COMPLETION_PENDING":
    case "DISPUTED":
      return 3;
    case "COMPLETED":
      return 5;
    default:
      return -2; // cancelado / expirado
  }
}

/** Linha do tempo didática: mostra em que etapa a ajuda está e o que vem depois. */
export function RequestTimeline({ status }: { status: RequestStatus }) {
  const step = currentStep(status);
  if (step === -2) return null;
  return (
    <details className="group rounded-[var(--radius-card)] border border-line bg-white p-4" open={step <= 0}>
      <summary className="cursor-pointer list-none font-bold">
        Como funciona a partir daqui <span className="text-sm font-normal text-ink-muted group-open:hidden">(ver etapas)</span>
      </summary>
      <ol className="mt-3 space-y-3">
        {STEPS.map((s, i) => {
          const done = i < step;
          const now = i === step;
          return (
            <li key={s.label} className="flex gap-3" aria-current={now ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold",
                  done ? "bg-brand-700 text-white" : now ? "bg-warm-700 text-white" : "bg-slate-100 text-ink-muted",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <div>
                <p className={cn("font-semibold", now && "text-warm-700")}>
                  {s.label}
                  {now && <span className="ml-2 rounded-full bg-warm-100 px-2 py-0.5 text-xs text-warm-700">agora</span>}
                  {done && <span className="sr-only"> (concluída)</span>}
                </p>
                <p className="text-sm text-ink-muted">{s.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
