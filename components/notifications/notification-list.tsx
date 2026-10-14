"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/display";
import { useRunAction } from "@/hooks/useRunAction";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/profile";
import { safeInternalUrl } from "@/lib/notifications/catalog";
import { formatRelative } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { NotificationRow } from "@/types";

export function NotificationList({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const { run, pending } = useRunAction();
  const unread = items.filter((n) => !n.read).length;

  if (items.length === 0) {
    return <EmptyState title="Você não tem notificações." description="Avisaremos quando algo acontecer nos seus pedidos e ajudas." icon={<Bell className="size-10" aria-hidden />} />;
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => markAllNotificationsReadAction())}>
            <CheckCheck className="size-4" aria-hidden /> Marcar tudo como lido
          </Button>
        </div>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className={cn("flex min-h-16 w-full items-start gap-3 p-4 text-left hover:bg-slate-50", !n.read && "bg-brand-50/60")}
              onClick={() => {
                if (!n.read) void markNotificationReadAction(n.id);
                router.push(safeInternalUrl(n.url, "/notificacoes"));
                router.refresh();
              }}
            >
              <span aria-hidden className={cn("mt-2 size-2.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate", n.read ? "font-semibold" : "font-extrabold")}>{n.title}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{formatRelative(n.created_at)}</span>
                </span>
                <span className="block text-sm text-ink-muted">{n.body}</span>
                {!n.read && <span className="sr-only">Não lida</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
