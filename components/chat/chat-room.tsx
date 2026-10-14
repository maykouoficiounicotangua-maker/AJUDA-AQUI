"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, CheckCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/display";
import { createClient } from "@/lib/supabase/client";
import { markConversationReadAction, sendMessageAction } from "@/app/actions/social";
import { chatMessageSchema } from "@/lib/validations";
import { cn } from "@/lib/utils/cn";
import type { MessageRow } from "@/services/conversations";

const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Chat com Supabase Realtime (sem polling): novas mensagens e confirmações de leitura chegam por assinatura. */
export function ChatRoom({
  conversationId, currentUserId, initialMessages, closed, blockedNotice,
}: { conversationId: string; currentUserId: string; initialMessages: MessageRow[]; closed: boolean; blockedNotice?: string }) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Realtime: INSERT (nova mensagem) e UPDATE (read_at)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (p) => {
        const m = p.new as MessageRow;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id !== currentUserId) void markConversationReadAction(conversationId);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (p) => {
        const m = p.new as MessageRow;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x)));
      })
      .subscribe();
    void markConversationReadAction(conversationId);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = chatMessageSchema.safeParse({ content: text });
    if (!parsed.success) return;
    const content = parsed.data.content;
    start(async () => {
      const res = await sendMessageAction(conversationId, { content });
      if (res.ok && res.data) {
        setText("");
        const sent = res.data;
        setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
      } else {
        toast.error(res.message ?? "Não conseguimos enviar agora. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-80 flex-col lg:h-[calc(100dvh-12rem)]">
      <div className="flex-1 space-y-2 overflow-y-auto rounded-[var(--radius-card)] border border-line bg-white p-4" role="log" aria-live="polite" aria-label="Mensagens">
        {messages.length === 0 && <p className="py-10 text-center text-ink-muted">Comece a conversa combinando os detalhes.</p>}
        {messages.map((m) =>
          m.message_type === "SYSTEM" ? (
            <p key={m.id} className="mx-auto max-w-sm rounded-full bg-slate-100 px-3 py-1.5 text-center text-xs text-ink-muted">{m.content}</p>
          ) : (
            <div key={m.id} className={cn("flex", m.sender_id === currentUserId ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2", m.sender_id === currentUserId ? "bg-brand-700 text-white" : "bg-slate-100")}>
                <p className="break-words whitespace-pre-wrap">{m.content}</p>
                <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[11px]", m.sender_id === currentUserId ? "text-brand-100" : "text-ink-muted")}>
                  {time(m.created_at)}
                  {m.sender_id === currentUserId && (m.read_at ? <CheckCheck className="size-3.5" aria-label="Lida" /> : <Check className="size-3.5" aria-label="Enviada" />)}
                </p>
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {closed || blockedNotice ? (
        <div className="mt-3"><Notice tone="info">{blockedNotice ?? "Esta conversa foi encerrada."}</Notice></div>
      ) : (
        <form onSubmit={send} className="mt-3 flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">Digite sua mensagem</label>
          <textarea
            id="chat-input" value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            placeholder="Digite sua mensagem…"
            className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-3"
          />
          <Button type="submit" className="size-12 !px-0" loading={pending} disabled={!text.trim()} aria-label="Enviar mensagem"><Send className="size-5" aria-hidden /></Button>
        </form>
      )}
    </div>
  );
}
