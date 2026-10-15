"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form";
import { BottomSheet } from "./bottom-sheet";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { installSnoozed, useInstallSheetOpen, useInstallState } from "@/lib/pwa/install";
import { setupNotificationsAction } from "@/app/actions/profile";
import { cn } from "@/lib/utils/cn";
import type { NotificationPrefs } from "@/services/notifications";

const SNOOZE_KEY = "aa:notif-setup-at";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function snoozed() {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Ativação guiada das notificações: a pessoa escolhe o que quer receber e só então o navegador pede permissão.
 * Aparece depois do convite de instalação (nunca os dois juntos).
 */
export function NotificationSetup({ initial }: { initial: NotificationPrefs }) {
  const push = usePushNotifications();
  const { installed, platform } = useInstallState();
  const installOpen = useInstallSheetOpen();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState({
    pref_matches: initial.pref_matches, match_scope: initial.match_scope, pref_messages: initial.pref_messages,
    pref_offers: initial.pref_offers, pref_requests: initial.pref_requests, pref_reviews: initial.pref_reviews,
  });

  // O convite de instalação tem prioridade enquanto puder aparecer.
  const installPending = !installed && platform !== "unsupported" && !installSnoozed();

  useEffect(() => {
    if (!push.ready || !push.supported || !push.configured || push.subscribed || push.permission === "denied") return;
    if (installOpen || installPending || snoozed()) return;
    const t = setTimeout(() => setOpen(true), 3500);
    return () => clearTimeout(t);
  }, [push.ready, push.supported, push.configured, push.subscribed, push.permission, installOpen, installPending]);

  const later = () => {
    setOpen(false);
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* ignorar */ }
  };

  async function activate() {
    setBusy(true);
    // 1º a permissão do navegador (precisa acontecer logo após o toque), depois gravamos as escolhas
    const res = await push.enable();
    if (!res.ok) {
      setBusy(false);
      toast.error(res.message);
      if (res.reason === "denied") later();
      return;
    }
    const saved = await setupNotificationsAction({ ...p, push_enabled: true });
    setBusy(false);
    if (!saved.ok) toast.error(saved.message ?? "Não conseguimos salvar suas escolhas.");
    else toast.success("Pronto! Você vai receber os avisos que escolheu.");
    setOpen(false);
  }

  const item = (k: keyof typeof p, label: string, hint: string) => (
    <Switch label={label} description={hint} checked={Boolean(p[k])} onChange={(v) => setP({ ...p, [k]: v })} />
  );

  return (
    <BottomSheet open={open} onClose={later} labelledBy="notif-title">
      <div className="flex items-center gap-3 pr-8">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><BellRing className="size-7" aria-hidden /></span>
        <div>
          <h2 id="notif-title" className="text-xl font-extrabold">Ative as notificações</h2>
          <p className="text-sm text-ink-muted">Escolha o que quer receber. Dá para mudar quando quiser em Configurações.</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-line">
        <div>
          {item("pref_matches", "Novos pedidos de ajuda", "Quando alguém perto de você precisar de ajuda")}
          {p.pref_matches && (
            <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quais pedidos">
              {([["COMPATIBLE", "Só os que combinam comigo"], ["NEARBY", "Todos perto de mim"]] as const).map(([v, l]) => (
                <button
                  key={v} type="button" role="radio" aria-checked={p.match_scope === v} onClick={() => setP({ ...p, match_scope: v })}
                  className={cn("min-h-11 rounded-2xl border px-3 text-sm font-semibold", p.match_scope === v ? "border-brand-700 bg-brand-50 text-brand-800" : "border-line")}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
        {item("pref_messages", "Mensagens", "Quando alguém escrever para você")}
        {item("pref_offers", "Propostas", "Quando alguém quiser te ajudar ou aceitar sua ajuda")}
        {item("pref_requests", "Andamento das ajudas", "Confirmações, conclusões e lembretes")}
        {item("pref_reviews", "Avaliações", "Quando você receber uma avaliação")}
      </div>
      <Button size="lg" className="mt-4 w-full" loading={busy} onClick={activate}>Ativar notificações</Button>
      <Button variant="ghost" className="mt-1 w-full" onClick={later} disabled={busy}>Agora não</Button>
    </BottomSheet>
  );
}
