import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedJob } from "@/lib/security/cron-auth";
import { logServerError } from "@/lib/errors";
import { dispatchNow } from "@/lib/notifications/service";

/**
 * Job diário (Vercel Cron): 1) expira pedidos abertos cujo horário passou;
 * 2) envia lembretes "ajuda próxima"; 3) entrega os pushes pendentes.
 * Cada etapa é independente: falha em uma não impede as outras.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedJob(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const result: Record<string, unknown> = {};

  const expired = await admin.rpc("expire_requests");
  if (expired.error) logServerError("cron.expire", expired.error);
  result.expired = expired.data ?? null;

  const reminders = await admin.rpc("send_upcoming_reminders");
  // antes da migration 0007 a função não existe: registra e segue
  if (reminders.error) logServerError("cron.reminders", reminders.error);
  result.reminders = reminders.data ?? null;

  await dispatchNow(admin);
  return NextResponse.json({ ok: !expired.error, ...result });
}
