"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { withUser, toAction, toVoid, parseInput } from "@/lib/actions";
import { helperPrefsSchema, notificationPrefsSchema, privacySchema, profileUpdateSchema, uuid } from "@/lib/validations";
import { publicEnv } from "@/lib/env";
import * as helper from "@/services/helper";
import * as notifications from "@/services/notifications";
import { markAllRead, markRead } from "@/services/notifications";
import { getHelperPrefs, getProfile } from "@/services/profiles";
import type { ActionResult } from "@/types";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return withUser("profile.update", async ({ db, userId }) => {
    const p = parseInput(profileUpdateSchema, input);
    if (!p.ok) return p.result;
    const r = await helper.updateProfile(db, userId, p.data);
    if (r.ok) {
      revalidatePath("/perfil");
      revalidatePath("/inicio");
    }
    return toAction("profile.update", r, "Perfil atualizado!");
  });
}

export async function saveHelperPrefsAction(input: unknown): Promise<ActionResult> {
  return withUser("helper.prefs", async ({ db, userId }) => {
    const p = parseInput(helperPrefsSchema, input);
    if (!p.ok) return p.result;
    const profile = await getProfile(db, userId);
    const r = await helper.saveHelperPrefs(
      db, userId,
      { state: profile?.state ?? null, city: profile?.city ?? null, neighborhood: profile?.neighborhood ?? null },
      p.data,
    );
    if (r.ok) {
      revalidatePath("/perfil");
      revalidatePath("/inicio");
    }
    return toAction("helper.prefs", r, "Disponibilidade salva!");
  });
}

export async function updatePrivacyAction(input: unknown): Promise<ActionResult> {
  return withUser("profile.privacy", async ({ db, userId }) => {
    const p = parseInput(privacySchema, input);
    if (!p.ok) return p.result;
    const r = await helper.updatePrivacy(db, userId, p.data);
    if (r.ok) revalidatePath("/perfil");
    return toAction("profile.privacy", r, "Privacidade atualizada.");
  });
}

/** O arquivo é enviado direto do navegador ao Storage (pasta do próprio usuário). Aqui só gravamos a URL, validada. */
export async function setAvatarAction(url: string | null): Promise<ActionResult> {
  return withUser("profile.avatar", async ({ db, userId }) => {
    if (url !== null) {
      const expectedPrefix = `${publicEnv.supabaseUrl}/storage/v1/object/public/avatars/${userId}/`;
      if (!url.startsWith(expectedPrefix) || url.length > 500) return { ok: false, message: "Imagem inválida." };
    }
    const { error } = await db.from("profiles").update({ avatar_url: url }).eq("id", userId);
    if (error) return toAction("profile.avatar", { ok: false, error });
    revalidatePath("/perfil");
    return { ok: true, message: "Foto atualizada!" };
  });
}

export async function updateNotificationPrefsAction(input: unknown): Promise<ActionResult> {
  return withUser("notifications.prefs", async ({ db, userId }) => {
    const p = parseInput(notificationPrefsSchema, input);
    if (!p.ok) return p.result;
    const r = await notifications.updatePrefs(db, userId, p.data);
    if (r.ok) revalidatePath("/configuracoes");
    return toAction("notifications.prefs", r);
  });
}

/**
 * Configuração de notificações (tela de boas-vindas ao app instalado): grava as escolhas e,
 * se a pessoa quer avisos de novos pedidos, garante que ela tenha uma área de ajuda (cidade do perfil).
 */
export async function setupNotificationsAction(input: unknown): Promise<ActionResult> {
  return withUser("notifications.setup", async ({ db, userId }) => {
    const p = parseInput(notificationPrefsSchema, input);
    if (!p.ok) return p.result;
    const r = await notifications.updatePrefs(db, userId, { ...p.data, in_app_enabled: true });
    if (!r.ok) return toAction("notifications.setup", r);
    if (p.data.pref_matches) {
      const existing = await getHelperPrefs(db, userId);
      if (!existing) {
        const profile = await getProfile(db, userId);
        const created = await helper.saveHelperPrefs(
          db, userId,
          { state: profile?.state ?? null, city: profile?.city ?? null, neighborhood: profile?.neighborhood ?? null },
          { description: undefined, maxDistanceKm: 15, acceptsPaid: true, acceptsFree: true, acceptsExchange: true, availableDays: [0, 1, 2, 3, 4, 5, 6], availabilityStart: "07:00", availabilityEnd: "22:00", active: true },
        );
        if (!created.ok) return toAction("notifications.setup", created);
      } else if (!existing.active) {
        await db.from("helper_preferences").update({ active: true }).eq("user_id", userId);
      }
    }
    revalidatePath("/configuracoes");
    return { ok: true };
  });
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  return withUser("notifications.read", async ({ db, userId }) => {
    if (!uuid.safeParse(id).success) return { ok: false };
    const r = await markRead(db, userId, id);
    return toAction("notifications.read", r);
  });
}

/**
 * LGPD — exclusão de conta. Exige digitar EXCLUIR. O banco (gatilho profiles_before_delete)
 * reabre/cancela ajudas em andamento, avisa as contrapartes e anonimiza mensagens.
 */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  const res = await withUser("account.delete", async ({ db, userId }) => {
    if (confirmation.trim().toUpperCase() !== "EXCLUIR") return { ok: false, message: "Digite EXCLUIR para confirmar." };
    const profile = await getProfile(db, userId);
    if (profile && (profile.role === "ADMIN" || profile.role === "SUPER_ADMIN")) {
      return { ok: false, message: "Contas de administrador não podem ser excluídas por aqui." };
    }
    const { error } = await createAdminClient().auth.admin.deleteUser(userId);
    if (error) return toVoid("account.delete", { ok: false, error });
    await db.auth.signOut().catch(() => undefined);
    return { ok: true };
  });
  if (res.ok) redirect("/?conta=excluida");
  return res;
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return withUser("notifications.readAll", async ({ db, userId }) => {
    const r = await markAllRead(db, userId);
    if (r.ok) revalidatePath("/notificacoes");
    return toAction("notifications.readAll", r, "Tudo marcado como lido.");
  });
}
