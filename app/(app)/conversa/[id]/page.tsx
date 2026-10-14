import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChatRoom } from "@/components/chat/chat-room";
import { Avatar } from "@/components/ui/display";
import { UserSafety } from "@/components/profile/user-safety";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { getConversation, listMessages } from "@/services/conversations";
import { getProfile } from "@/services/profiles";
import { getRequest } from "@/services/requests";
import { listMyBlocks } from "@/services/social";

export const metadata: Metadata = { title: "Conversa", robots: { index: false } };

export default async function ConversationPage({ params }: PageProps<"/conversa/[id]">) {
  const { id } = await params;
  const { userId } = await requireUser();
  const db = await getSupabase();

  const conversation = await getConversation(db, id);
  if (!conversation) notFound(); // não participante => a RLS devolve vazio => 404

  const otherId = conversation.participants.find((p) => p.user_id !== userId)?.user_id;
  const [other, request, messages, myBlocks] = await Promise.all([
    otherId ? getProfile(db, otherId) : Promise.resolve(null),
    getRequest(db, conversation.request_id),
    listMessages(db, id),
    listMyBlocks(db),
  ]);
  // Se EU bloqueei, a RLS esconde o perfil; o nome vem da minha lista de bloqueios para eu poder desbloquear.
  const blockedEntry = myBlocks.find((b) => b.id === otherId);
  const iBlocked = Boolean(blockedEntry);
  const otherName = other?.full_name ?? blockedEntry?.name ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <header className="flex items-center gap-3">
        <Link href="/mensagens" className="grid size-11 place-items-center rounded-full hover:bg-slate-100" aria-label="Voltar para mensagens"><ArrowLeft className="size-6" aria-hidden /></Link>
        {other && <Avatar name={other.full_name} src={other.avatar_url} size={44} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold">{otherName ?? "Conversa"}</h1>
          {request && <Link href={`/pedido/${request.id}`} className="block truncate text-sm text-brand-700 underline">{request.title}</Link>}
        </div>
      </header>

      <ChatRoom
        conversationId={id}
        currentUserId={userId}
        initialMessages={messages}
        closed={conversation.status === "CLOSED"}
        blockedNotice={iBlocked ? "Você bloqueou esta pessoa. Desbloqueie para voltar a conversar." : undefined}
      />

      {otherId && otherName && (
        <details className="rounded-2xl border border-line bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink-muted">Segurança</summary>
          <div className="mt-3">
            <UserSafety userId={otherId} userName={otherName.split(" ")[0]} blocked={iBlocked} requestId={conversation.request_id} conversationId={id} />
          </div>
        </details>
      )}
    </div>
  );
}
