"use client";

import { useState } from "react";
import { BellOff } from "lucide-react";
import { toast } from "sonner";
import { Card, Notice } from "@/components/ui/display";
import { Switch } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { useRunAction } from "@/hooks/useRunAction";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { updateNotificationPrefsAction, updatePrivacyAction } from "@/app/actions/profile";
import { unblockUserAction } from "@/app/actions/social";
import { PREFERENCE_LABELS } from "@/lib/notifications/catalog";
import type { NotificationPrefs } from "@/services/notifications";

export function PrivacySettings({ initial }: { initial: { profileVisibility: "PUBLIC" | "PRIVATE"; showRating: boolean; showHelpCount: boolean } }) {
  const [v, setV] = useState(initial);
  const { run } = useRunAction();
  const save = (next: typeof v) => {
    const prev = v;
    setV(next);
    run(() => updatePrivacyAction(next).then((r) => { if (!r.ok) setV(prev); return r; }), { refresh: false });
  };
  return (
    <Card className="divide-y divide-line">
      <div className="pb-3">
        <label htmlFor="visibility" className="block font-semibold">Quem pode ver seu perfil</label>
        <p className="mb-2 text-sm text-ink-muted">Perfil privado só aparece para quem tem uma ajuda ou proposta com você.</p>
        <Select id="visibility" value={v.profileVisibility} onChange={(e) => save({ ...v, profileVisibility: e.target.value as "PUBLIC" | "PRIVATE" })}>
          <option value="PUBLIC">Público (qualquer usuário)</option>
          <option value="PRIVATE">Privado</option>
        </Select>
      </div>
      <Switch label="Mostrar minha avaliação" description="Nota média e comentários no seu perfil" checked={v.showRating} onChange={(c) => save({ ...v, showRating: c })} />
      <Switch label="Mostrar quantidade de ajudas" description="Número de ajudas e pedidos concluídos" checked={v.showHelpCount} onChange={(c) => save({ ...v, showHelpCount: c })} />
    </Card>
  );
}

export function NotificationSettings({ initial }: { initial: NotificationPrefs }) {
  const [p, setP] = useState(initial);
  const { run } = useRunAction();
  const push = usePushNotifications();

  function update(patch: Partial<NotificationPrefs>) {
    const prev = p;
    setP({ ...p, ...patch });
    run(() => updateNotificationPrefsAction(patch).then((r) => { if (!r.ok) setP(prev); return r; }), { refresh: false, silent: true });
  }

  async function togglePush(on: boolean) {
    if (on) {
      const res = await push.enable();
      if (res.ok) {
        update({ push_enabled: true });
        toast.success("Notificações push ativadas neste dispositivo!");
      } else toast.error(res.message);
    } else {
      await push.disable();
      toast.success("Notificações push desativadas neste dispositivo.");
    }
  }

  return (
    <Card className="divide-y divide-line">
      <Switch label="Notificações no aplicativo" description="Histórico dentro do Ajuda Aqui" checked={p.in_app_enabled} onChange={(c) => update({ in_app_enabled: c })} />
      <div>
        <Switch
          label="Notificações push" description="Avisos neste dispositivo, mesmo com o app fechado"
          checked={push.subscribed} disabled={!push.ready || !push.supported || !push.configured || push.busy || push.permission === "denied"}
          onChange={togglePush}
        />
        {push.ready && !push.supported && <p className="pb-3 text-sm text-ink-muted">Este navegador não suporta notificações push.</p>}
        {push.ready && push.supported && !push.configured && <p className="pb-3 text-sm text-ink-muted">As notificações push ainda não estão disponíveis neste ambiente.</p>}
        {push.permission === "denied" && (
          <div className="pb-3"><Notice tone="warning"><span className="inline-flex items-center gap-2"><BellOff className="size-4" aria-hidden /> Você bloqueou as notificações no navegador. Libere nas configurações do site para ativar.</span></Notice></div>
        )}
      </div>
      {PREFERENCE_LABELS.map((l) => (
        <Switch
          key={l.column} label={l.label} description={l.hint}
          checked={p[l.column as keyof NotificationPrefs]} disabled={!p.in_app_enabled}
          onChange={(c) => update({ [l.column]: c } as Partial<NotificationPrefs>)}
        />
      ))}
    </Card>
  );
}

export function BlockedUsers({ users }: { users: { id: string; name: string }[] }) {
  const { run, pending } = useRunAction();
  if (users.length === 0) return <p className="text-ink-muted">Você não bloqueou ninguém.</p>;
  return (
    <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
      {users.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-3 p-4">
          <span className="font-semibold">{u.name}</span>
          <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => unblockUserAction(u.id))}>Desbloquear</Button>
        </li>
      ))}
    </ul>
  );
}
