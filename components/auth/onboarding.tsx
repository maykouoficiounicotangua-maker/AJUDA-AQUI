"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandHeart, HandHelping, ShieldCheck, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { completeOnboardingAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils/cn";

const slides = [
  { icon: Smile, title: "Bem-vindo ao Ajuda Aqui", text: "Uma comunidade simples onde pessoas ajudam pessoas, perto de você." },
  { icon: HandHelping, title: "Precisa de ajuda?", text: "Conte do que precisa em poucos passos e escolha quem vai ajudar." },
  { icon: HandHeart, title: "Quer ajudar?", text: "Veja pedidos que combinam com você e ofereça uma mãozinha." },
  { icon: ShieldCheck, title: "Ajude com segurança", text: "Seu endereço fica protegido, o chat é interno e você pode bloquear e denunciar." },
];

export function Onboarding({ firstName }: { firstName: string }) {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const { run, pending } = useRunAction();
  const last = step === slides.length - 1;
  const slide = slides[step];

  const finish = () => run(() => completeOnboardingAction(), { refresh: false, silent: true, onSuccess: () => router.replace("/inicio") });

  return (
    <section aria-labelledby="onb-title" className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-5 grid size-24 place-items-center rounded-full bg-brand-50 text-brand-700">
        <slide.icon className="size-12" aria-hidden />
      </div>
      <h1 id="onb-title" className="text-2xl font-extrabold">
        {step === 0 ? `Olá, ${firstName}! ` : ""}
        {slide.title}
      </h1>
      <p className="mt-2 min-h-16 text-ink-muted" aria-live="polite">{slide.text}</p>

      <ol className="my-5 flex justify-center gap-2" aria-label={`Passo ${step + 1} de ${slides.length}`}>
        {slides.map((s, i) => (
          <li key={s.title} aria-current={i === step ? "step" : undefined} className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-brand-700" : "w-2 bg-slate-300")} />
        ))}
      </ol>

      {last ? (
        <Button size="lg" className="w-full" loading={pending} onClick={finish}>COMEÇAR</Button>
      ) : (
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={finish} disabled={pending}>Pular</Button>
          <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>Continuar</Button>
        </div>
      )}
    </section>
  );
}
