"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/** Sino com contador + toast em tempo real (Supabase Realtime filtrado por usuário; a RLS também protege). */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as { title: string; body: string; url: string | null };
          setUnread((c) => c + 1);
          toast(n.title, {
            description: n.body,
            action: n.url ? { label: "Ver", onClick: () => router.push(n.url as string) } : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return (
    <Link
      href="/notificacoes"
      className="relative grid size-11 place-items-center rounded-full text-ink-muted hover:bg-slate-100"
      aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
    >
      <Bell className="size-6" aria-hidden />
      {unread > 0 && (
        <span aria-hidden className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
