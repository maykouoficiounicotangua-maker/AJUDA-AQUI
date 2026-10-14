"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/validations";
import { GENERIC_ERROR, logServerError } from "@/lib/errors";
import { safeInternalUrl } from "@/lib/notifications/catalog";
import type { ActionResult } from "@/types";

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  message: "O serviço ainda não está configurado. Defina as variáveis do Supabase em .env.local.",
};

async function siteUrl() {
  const h = await headers();
  const origin = h.get("origin");
  return origin ?? publicEnv.siteUrl;
}

/** Traduz erros do Supabase Auth para mensagens úteis (sem revelar se um e-mail existe). */
function authErrorMessage(error: { message?: string; code?: string; status?: number }): string {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(msg))
    return "Recebemos muitos pedidos de e-mail agora. Aguarde alguns minutos e tente novamente.";
  if (code === "over_request_rate_limit" || error.status === 429)
    return "Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.";
  if (code === "email_address_invalid" || /invalid.*email|email.*invalid/i.test(msg)) return "Este e-mail não parece válido. Confira e tente de novo.";
  if (code === "weak_password" || /password/i.test(msg)) return "Escolha uma senha mais forte (letras, números e ao menos 8 caracteres).";
  if (code === "signup_disabled") return "Novos cadastros estão temporariamente desativados.";
  return GENERIC_ERROR;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

export async function signUpAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/boas-vindas`,
      data: {
        full_name: v.fullName,
        phone: v.phone,
        state: v.state,
        city: v.city,
        neighborhood: v.neighborhood ?? "",
        terms_version: LEGAL_VERSIONS.terms,
        privacy_version: LEGAL_VERSIONS.privacy,
        safety_version: LEGAL_VERSIONS.safety,
      },
    },
  });

  if (error) {
    logServerError("auth.signUp", error);
    if (/already|registered/i.test(error.message)) return { ok: false, message: "Já existe uma conta com este e-mail. Tente entrar." };
    return { ok: false, message: authErrorMessage(error) };
  }
  // E-mail já cadastrado com confirmação ligada: o Supabase devolve user sem identities (não revela existência).
  if (data.session) redirect("/boas-vindas");
  return { ok: true, message: "Enviamos um link de confirmação para o seu e-mail. Abra-o para ativar a conta." };
}

export async function signInAction(input: unknown, next?: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    // mensagem única: não revela se o e-mail existe
    return { ok: false, message: "E-mail ou senha incorretos." };
  }
  await supabase.from("analytics_events").insert({ user_id: data.user.id, event: "LOGIN" });
  redirect(safeInternalUrl(next, "/inicio"));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Informe um e-mail válido.", fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/redefinir-senha`,
  });
  if (error) {
    logServerError("auth.forgot", error);
    // limite de envio é o único erro que vale mostrar (não revela se a conta existe)
    if (error.status === 429) return { ok: false, message: authErrorMessage(error) };
  }
  // Resposta idêntica com ou sem conta: evita enumeração de usuários.
  return { ok: true, message: "Se houver uma conta com este e-mail, enviamos as instruções para redefinir a senha." };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error.issues) };
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "O link expirou. Peça um novo para redefinir sua senha." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logServerError("auth.reset", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  redirect("/inicio");
}

/** Registra o aceite das versões vigentes (para quem já tinha conta antes de uma nova versão dos termos). */
export async function acceptTermsAction(): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const supabase = await createClient();
  const { error } = await supabase.from("consents").upsert(
    {
      user_id: user.id,
      terms_version: LEGAL_VERSIONS.terms,
      privacy_version: LEGAL_VERSIONS.privacy,
      safety_version: LEGAL_VERSIONS.safety,
    },
    { onConflict: "user_id,terms_version,privacy_version,safety_version", ignoreDuplicates: true },
  );
  if (error) {
    logServerError("auth.acceptTerms", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  return { ok: true };
}

export async function completeOnboardingAction(): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  if (error) {
    logServerError("auth.onboarding", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  return { ok: true };
}
