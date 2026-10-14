import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPendingPush } from "@/lib/notifications/service";
import { isAuthorizedJob } from "@/lib/security/cron-auth";
import { isPushConfigured } from "@/lib/env";

/** Processa a fila de push. Protegido por CRON_SECRET (Vercel Cron / webhook do banco). */
async function handle(request: NextRequest) {
  if (!isAuthorizedJob(request)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ ok: true, skipped: "push não configurado" });
  const result = await dispatchPendingPush(createAdminClient(), 100);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
