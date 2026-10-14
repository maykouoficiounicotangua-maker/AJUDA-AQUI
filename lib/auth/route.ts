import "server-only";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Contexto autenticado para Route Handlers. Retorna null quando não há sessão —
 * inclusive em ambientes sem Supabase configurado (nunca estoura 500 por falta de env).
 */
export async function getRouteUser(): Promise<{ supabase: ServerClient; user: User } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, user: data.user } : null;
}
