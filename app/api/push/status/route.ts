import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/auth/route";
import { isPushConfigured, serverEnv } from "@/lib/env";

/** Informa ao cliente se push está disponível e quantos dispositivos estão ativos. Só chave PÚBLICA. */
export async function GET() {
  const ctx = await getRouteUser();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
  const { supabase } = ctx;

  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  return NextResponse.json({
    ok: true,
    configured: isPushConfigured(),
    publicKey: isPushConfigured() ? serverEnv().vapidPublicKey : null,
    activeDevices: count ?? 0,
  });
}
