import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Cliente com service_role: IGNORA a RLS. Só em código de servidor, para tarefas do sistema
 * (envio de push, expiração, fan-out de matching). Nunca importar em componentes de cliente.
 */
export function createAdminClient() {
  const { serviceRoleKey } = serverEnv();
  if (!publicEnv.supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  }
  return createSupabaseClient(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
