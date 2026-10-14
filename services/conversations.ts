import { fail, ok, type Db, type ServiceResult } from "./db";

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  message_type: "TEXT" | "SYSTEM";
  content: string;
  read_at: string | null;
  created_at: string;
}

const MESSAGE_COLUMNS = "id, conversation_id, sender_id, message_type, content, read_at, created_at";

export interface ConversationSummary {
  id: string;
  request_id: string;
  status: "OPEN" | "CLOSED";
  updated_at: string;
  request: { id: string; title: string; status: string } | null;
  other_user_id: string | null;
  last_message: { content: string; created_at: string; message_type: string } | null;
  unread: number;
}

export async function listConversations(db: Db, userId: string): Promise<ConversationSummary[]> {
  const { data: convs } = await db
    .from("conversations")
    .select("id, request_id, status, updated_at, request:help_requests(id, title, status), participants:conversation_participants(user_id)")
    .order("updated_at", { ascending: false })
    .limit(50);
  const rows = (convs as unknown as (Omit<ConversationSummary, "other_user_id" | "last_message" | "unread"> & { participants: { user_id: string }[] })[] | null) ?? [];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  // Última mensagem + não lidas em UMA consulta (limitada), em vez de N consultas.
  const { data: msgs } = await db
    .from("messages")
    .select("conversation_id, sender_id, content, created_at, message_type, read_at")
    .in("conversation_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const last = new Map<string, { content: string; created_at: string; message_type: string }>();
  const unread = new Map<string, number>();
  for (const m of (msgs as { conversation_id: string; sender_id: string | null; content: string; created_at: string; message_type: string; read_at: string | null }[] | null) ?? []) {
    if (!last.has(m.conversation_id)) last.set(m.conversation_id, { content: m.content, created_at: m.created_at, message_type: m.message_type });
    if (m.sender_id && m.sender_id !== userId && !m.read_at) unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    request_id: r.request_id,
    status: r.status,
    updated_at: r.updated_at,
    request: r.request,
    other_user_id: r.participants.find((p) => p.user_id !== userId)?.user_id ?? null,
    last_message: last.get(r.id) ?? null,
    unread: unread.get(r.id) ?? 0,
  }));
}

export async function getConversation(db: Db, id: string) {
  const { data } = await db
    .from("conversations")
    .select("id, request_id, status, participants:conversation_participants(user_id)")
    .eq("id", id)
    .maybeSingle();
  return data as { id: string; request_id: string; status: "OPEN" | "CLOSED"; participants: { user_id: string }[] } | null;
}

export async function getConversationIdForRequest(db: Db, requestId: string): Promise<string | null> {
  const { data } = await db.from("conversations").select("id").eq("request_id", requestId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function listMessages(db: Db, conversationId: string, limit = 100): Promise<MessageRow[]> {
  const { data } = await db
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data as MessageRow[] | null) ?? []).reverse();
}

export async function sendMessage(db: Db, conversationId: string, userId: string, content: string): Promise<ServiceResult<MessageRow>> {
  const { data, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: userId, message_type: "TEXT", content })
    .select(MESSAGE_COLUMNS)
    .single();
  return error || !data ? fail(error) : ok(data as MessageRow);
}

export async function markConversationRead(db: Db, conversationId: string, userId: string): Promise<void> {
  await db
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .is("read_at", null)
    .neq("sender_id", userId);
}

export async function countUnreadMessages(db: Db, userId: string): Promise<number> {
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .is("deleted_at", null)
    .neq("sender_id", userId);
  return count ?? 0;
}
