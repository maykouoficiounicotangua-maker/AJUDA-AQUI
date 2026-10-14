import "server-only";
import { getAuthUser, getSupabase } from "@/lib/auth/session";
import { GENERIC_ERROR, humanizeError, logServerError } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import type { Db, ServiceResult } from "@/services/db";
import type { ActionResult } from "@/types";
import type { ZodType } from "zod";

export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

interface Ctx {
  db: Db;
  userId: string;
}

/** Executa uma ação com usuário autenticado. Erros viram mensagens humanas; detalhes vão para o log do servidor. */
export async function withUser<T = void>(scope: string, fn: (ctx: Ctx) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  if (!isSupabaseConfigured()) return { ok: false, message: "O serviço ainda não está configurado." };
  try {
    const user = await getAuthUser();
    if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente para continuar." };
    return await fn({ db: await getSupabase(), userId: user.id });
  } catch (err) {
    // redirect()/notFound() do Next lançam erros de controle: precisam seguir adiante
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
    logServerError(scope, err);
    return { ok: false, message: GENERIC_ERROR };
  }
}

/** Converte ServiceResult em ActionResult (com log técnico e mensagem humana em caso de erro). */
export function toAction<T>(scope: string, r: ServiceResult<T>, successMessage?: string): ActionResult<T> {
  if (!r.ok) {
    logServerError(scope, r.error);
    return { ok: false, message: humanizeError(r.error) };
  }
  return { ok: true, data: r.data, message: successMessage };
}

/** Como toAction, mas descarta o dado (para actions que não devolvem nada ao cliente). */
export function toVoid(scope: string, r: ServiceResult<unknown>, successMessage?: string): ActionResult {
  const res = toAction(scope, r, successMessage);
  return { ok: res.ok, message: res.message };
}

export function parseInput<S extends ZodType>(schema: S, input: unknown):
  | { ok: true; data: import("zod").output<S> }
  | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    result: { ok: false, message: parsed.error.issues[0]?.message ?? "Revise os dados informados.", fieldErrors: zodFieldErrors(parsed.error.issues) },
  };
}
