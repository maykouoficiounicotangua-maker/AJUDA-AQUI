import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedJob } from "@/lib/security/cron-auth";
import { logServerError } from "@/lib/errors";

/** Marca como EXPIRED os pedidos abertos cujo horário já passou. Rodar periodicamente (Vercel Cron). */
export async function GET(request: NextRequest) {
  if (!isAuthorizedJob(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await createAdminClient().rpc("expire_requests");
  if (error) {
    logServerError("cron.expire", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, expired: data });
}
