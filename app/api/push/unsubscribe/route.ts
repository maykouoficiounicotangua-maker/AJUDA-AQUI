import { NextResponse, type NextRequest } from "next/server";
import { getRouteUser } from "@/lib/auth/route";
import { pushUnsubscribeSchema } from "@/lib/validations";
import { logPush } from "@/lib/push/server";
import { logServerError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const ctx = await getRouteUser();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
  const { supabase, user } = ctx;

  const parsed = pushUnsubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Requisição inválida." }, { status: 400 });

  // RLS garante que só afeta assinaturas do próprio usuário
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("endpoint", parsed.data.endpoint);
  if (error) {
    logServerError("push.unsubscribe", error);
    return NextResponse.json({ ok: false, message: "Não conseguimos desativar agora." }, { status: 500 });
  }
  logPush("push_subscription_removed", { userId: user.id });
  return NextResponse.json({ ok: true });
}
