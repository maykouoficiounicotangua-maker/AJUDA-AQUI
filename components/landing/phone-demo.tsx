"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, MapPin, PackageCheck, Send, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const SCENES = [
  { caption: "1. Maria pede ajuda em 1 minuto", short: "Pedir" },
  { caption: "2. João, que mora perto, recebe o aviso", short: "Aviso" },
  { caption: "3. Eles combinam tudo pelo chat do app", short: "Combinar" },
  { caption: "4. Ajuda feita, os dois se avaliam", short: "Avaliar" },
];
const DURATION = 3800;

/** Celular animado que demonstra o fluxo do app. Pausa ao passar o mouse; respeita "reduzir movimento". */
export function PhoneDemo() {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduce) return;
    const t = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), DURATION);
    return () => clearTimeout(t);
  }, [scene, paused]);

  return (
    <figure className="mx-auto w-full max-w-[300px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="animate-float relative rounded-[2.5rem] border-[10px] border-ink bg-ink shadow-2xl motion-reduce:animate-none" aria-hidden>
        <div className="absolute top-2 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <div className="relative h-[520px] overflow-hidden rounded-[1.8rem] bg-canvas">
          <div className="flex items-center gap-2 bg-white px-4 pt-8 pb-3 shadow-sm">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-700 text-xs font-bold text-white">AA</span>
            <span className="text-sm font-extrabold">Ajuda Aqui</span>
          </div>
          <div key={scene} className="animate-scene-in p-4">
            {scene === 0 && <SceneRequest />}
            {scene === 1 && <SceneNotification />}
            {scene === 2 && <SceneChat />}
            {scene === 3 && <SceneDone />}
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center">
        <p className="min-h-6 font-bold" aria-live="polite">{SCENES[scene].caption}</p>
        <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Etapas da demonstração">
          {SCENES.map((s, i) => (
            <button
              key={s.short} type="button" role="tab" aria-selected={i === scene} aria-label={s.caption}
              onClick={() => setScene(i)}
              className={cn("h-2.5 rounded-full transition-all", i === scene ? "w-8 bg-brand-700" : "w-2.5 bg-slate-300 hover:bg-slate-400")}
            />
          ))}
        </div>
      </figcaption>
    </figure>
  );
}

function SceneRequest() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-ink-muted">Etapa 6 de 7 · Revisar</p>
      <div className="space-y-2 rounded-2xl border border-line bg-white p-3 shadow-sm">
        <p className="flex items-center gap-2 text-xs font-semibold text-ink-muted"><PackageCheck className="size-4" /> Entregas</p>
        <p className="font-bold">Buscar uma encomenda</p>
        <p className="text-xs text-ink-muted">Hoje, 18h · Icaraí, Niterói</p>
        <span className="inline-block rounded-full bg-success-50 px-2 py-0.5 text-xs font-bold text-success-700">R$ 20,00</span>
      </div>
      <div className="animate-press rounded-2xl bg-warm-700 py-3 text-center text-sm font-bold text-white">Publicar pedido</div>
      <p className="animate-fade-late text-center text-xs font-semibold text-success-700">✓ Encontramos 3 pessoas que podem ajudar</p>
    </div>
  );
}

function SceneNotification() {
  return (
    <div className="space-y-3">
      <div className="animate-drop-in flex gap-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-line">
        <Bell className="mt-0.5 size-5 shrink-0 text-brand-700" />
        <div>
          <p className="text-xs font-bold">Pedido que combina com você</p>
          <p className="text-xs text-ink-muted">Entregas perto de você — Icaraí</p>
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-line bg-white p-3">
        <p className="font-bold">Buscar uma encomenda</p>
        <p className="flex items-center gap-1 text-xs text-ink-muted"><MapPin className="size-3" /> cerca de 2 km · Hoje, 18h</p>
        <span className="inline-block rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700">✦ Alta compatibilidade</span>
      </div>
      <div className="animate-press rounded-2xl bg-brand-700 py-3 text-center text-sm font-bold text-white">TENHO INTERESSE</div>
    </div>
  );
}

function SceneChat() {
  return (
    <div className="space-y-2">
      <p className="mx-auto w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] text-ink-muted">João foi escolhido para esta ajuda</p>
      <p className="animate-bubble-1 ml-auto w-fit max-w-[80%] rounded-2xl bg-brand-700 px-3 py-2 text-xs text-white">Oi João! Pode ser às 18h?</p>
      <p className="animate-bubble-2 w-fit max-w-[80%] rounded-2xl bg-white px-3 py-2 text-xs shadow-sm">Claro! Passo aí no horário 🙂</p>
      <p className="animate-bubble-3 ml-auto w-fit max-w-[80%] rounded-2xl bg-brand-700 px-3 py-2 text-xs text-white">Combinado, obrigada!</p>
      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-xs text-ink-muted">
        Digite sua mensagem… <Send className="ml-auto size-4 text-brand-700" />
      </div>
    </div>
  );
}

function SceneDone() {
  return (
    <div className="space-y-3 text-center">
      <CheckCircle2 className="animate-pop mx-auto mt-4 size-14 text-success-700" />
      <p className="font-extrabold">Ajuda concluída!</p>
      <p className="text-xs text-ink-muted">Como foi com o João?</p>
      <div className="flex justify-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="animate-star size-7 fill-amber-400 text-amber-400" style={{ animationDelay: `${300 + i * 150}ms` }} />
        ))}
      </div>
      <p className="animate-fade-late rounded-2xl bg-brand-50 p-3 text-xs font-semibold text-brand-800">A confiança da comunidade cresce a cada ajuda 💚</p>
    </div>
  );
}
