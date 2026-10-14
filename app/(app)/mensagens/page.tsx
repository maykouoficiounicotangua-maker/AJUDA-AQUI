import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils/format";
import { listConversations } from "@/services/conversations";
import { getProfilesByIds } from "@/services/profiles";

export const metadata: Metadata = { title: "Mensagens" };

export default async function MessagesPage() {
  const { userId } = await requireUser();
  const db = await getSupabase();
  const conversations = await listConversations(db, userId);
  const profiles = await getProfilesByIds(db, conversations.flatMap((c) => (c.other_user_id ? [c.other_user_id] : [])));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Mensagens" />
      {conversations.length === 0 ? (
        <EmptyState
          title="Você ainda não possui conversas."
          description="As conversas começam quando um pedido é aceito."
          icon={<MessageCircle className="size-10" aria-hidden />}
          action={<LinkButton href="/explorar" variant="secondary">Explorar pedidos</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
          {conversations.map((c) => {
            const other = c.other_user_id ? profiles.get(c.other_user_id) : null;
            return (
              <li key={c.id}>
                <Link href={`/conversa/${c.id}`} className="flex min-h-20 items-center gap-3 p-4 hover:bg-slate-50">
                  <Avatar name={other?.full_name ?? "?"} src={other?.avatar_url} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-bold">{other?.full_name ?? "Usuário"}</p>
                      {c.last_message && <span className="shrink-0 text-xs text-ink-muted">{formatRelative(c.last_message.created_at)}</span>}
                    </div>
                    <p className="truncate text-sm text-ink-muted">{c.request?.title}</p>
                    <p className={`truncate text-sm ${c.unread ? "font-bold" : "text-ink-muted"}`}>{c.last_message?.content ?? "Sem mensagens ainda"}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="grid min-w-6 place-items-center rounded-full bg-danger-600 px-1.5 text-xs font-bold text-white">
                      <span className="sr-only">{c.unread} não lidas</span><span aria-hidden>{c.unread}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
