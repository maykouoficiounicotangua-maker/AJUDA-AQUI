"use client";

import { useState } from "react";
import { Bell, ClipboardList, HandHeart, MessagesSquare, Search, ShieldCheck, Star, UserCheck } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils/cn";

const FLOWS = {
  pedir: {
    label: "🆘 Preciso de ajuda",
    steps: [
      { icon: ClipboardList, title: "Conte do que precisa", text: "Categoria, dia, horário e se é grátis, pago ou troca. Leva menos de 1 minuto." },
      { icon: Bell, title: "Avisamos quem está perto", text: "Pessoas da sua região que combinam com o pedido recebem um aviso na hora." },
      { icon: UserCheck, title: "Você escolhe quem vai ajudar", text: "Veja as propostas, o perfil e as avaliações de cada pessoa e escolha com calma." },
      { icon: Star, title: "Ajuda feita, avaliem-se", text: "Combinem pelo chat, confirmem a conclusão e deixem uma avaliação." },
    ],
  },
  ajudar: {
    label: "🤝 Quero ajudar",
    steps: [
      { icon: Search, title: "Veja pedidos perto de você", text: "Sem cadastro para olhar. Filtre por dia, bairro, categoria ou tipo." },
      { icon: HandHeart, title: "Toque em “Tenho interesse”", text: "Conte em uma frase por que você pode ajudar. Só agora pedimos seu cadastro." },
      { icon: MessagesSquare, title: "Combine pelo chat", text: "Se for escolhido, o chat abre e o endereço é liberado depois que você confirma." },
      { icon: ShieldCheck, title: "Ganhe reputação", text: "Cada ajuda concluída conta no seu perfil e rende selos de confiança." },
    ],
  },
} as const;

export function HowItWorks() {
  const [tab, setTab] = useState<keyof typeof FLOWS>("pedir");
  return (
    <div>
      <div role="tablist" aria-label="Como funciona" className="mx-auto mb-6 grid max-w-md grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
        {(Object.keys(FLOWS) as (keyof typeof FLOWS)[]).map((k) => (
          <button
            key={k} type="button" role="tab" aria-selected={tab === k} aria-controls={`flow-${k}`} id={`tab-${k}`}
            onClick={() => setTab(k)}
            className={cn("min-h-12 rounded-xl text-sm font-bold transition-colors sm:text-base", tab === k ? "bg-white text-ink shadow" : "text-ink-muted")}
          >
            {FLOWS[k].label}
          </button>
        ))}
      </div>
      <div id={`flow-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FLOWS[tab].steps.map((s, i) => (
          <li key={s.title}>
            <Reveal delay={i * 120} className="h-full">
              <div className="relative h-full rounded-[var(--radius-card)] border border-line bg-white p-5">
                <span className="absolute top-4 right-4 text-4xl font-black text-slate-100" aria-hidden>{i + 1}</span>
                <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><s.icon className="size-6" aria-hidden /></span>
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-ink-muted">{s.text}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
      </div>
    </div>
  );
}
