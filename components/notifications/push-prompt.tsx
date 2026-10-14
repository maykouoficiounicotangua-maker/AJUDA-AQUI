"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISS_KEY = "aa:push-prompt-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Convite para ativar push. NUNCA pede permissão sozinho: só após o clique em "Ativar notificações". */
export function PushPrompt() {
  const push = usePushNotifications();
  const [dismissed, setDismissed] = useState(true); // começa oculto para evitar "flash"
  useEffect(() => {
    // lê localStorage (API do navegador) só no cliente, para evitar divergência na hidratação
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
  }, []);

  if (!push.ready || !push.supported || !push.configured || push.subscribed || push.permission === "denied" || dismissed) return null;

  async function onEnable() {
    const res = await push.enable();
    if (res.ok) toast.success("Notificações ativadas!");
    else toast.error(res.message);
  }

  function onDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignorar */
    }
    setDismissed(true);
  }

  return (
    <Card className="border-brand-200 bg-brand-50">
      <div className="flex items-start gap-3">
        <Bell className="mt-1 size-6 shrink-0 text-brand-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">🔔 Receba avisos importantes</h2>
          <p className="mt-1 text-sm text-ink-muted">O Ajuda Aqui pode avisar você quando:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
            <li>alguém responder seu pedido;</li>
            <li>sua proposta for aceita;</li>
            <li>chegar uma nova mensagem;</li>
            <li>surgir uma oportunidade compatível;</li>
            <li>seu pedido sofrer uma atualização.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onEnable} loading={push.busy}>Ativar notificações</Button>
            <Button variant="ghost" onClick={onDismiss}>Agora não</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
