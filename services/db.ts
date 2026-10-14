import type { SupabaseClient } from "@supabase/supabase-js";

/** Cliente Supabase injetado nos serviços (do usuário, com RLS — ou admin, nos jobs de servidor). */
export type Db = SupabaseClient;

/** Resultado padrão dos serviços. `error` carrega o erro técnico (será humanizado/logado pela action). */
export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: unknown };

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
export const fail = (error: unknown): ServiceResult<never> => ({ ok: false, error });
