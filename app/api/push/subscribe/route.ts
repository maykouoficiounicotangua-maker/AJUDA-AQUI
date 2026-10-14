import { NextResponse, type NextRequest } from "next/server";
import { getRouteUser } from "@/lib/auth/route";
import { pushSubscriptionSchema } from "@/lib/validations";
import { detectDevice } from "@/lib/push/device";
import { logPush } from "@/lib/push/server";
import { humanizeError, logServerError } from "@/lib/errors";

/** Registra a PushSubscription do usuário LOGADO. O user_id vem da sessão, nunca do corpo. */
export async function POST(request: NextRequest) {
  const ctx = await getRouteUser();
  if (!ctx) return NextResponse.json({ ok: false, message: "Faça login para ativar notificações." }, { status: 401 });
  const { supabase, user } = ctx;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Requisição inválida." }, { status: 400 });
  }
  const parsed = pushSubscriptionSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Assinatura inválida." }, { status: 400 });

  const ua = request.headers.get("user-agent");
  const detected = detectDevice(ua);
  const { data, error } = await supabase.rpc("upsert_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: ua,
    p_device_type: parsed.data.deviceType !== "unknown" ? parsed.data.deviceType : detected.deviceType,
    p_browser: parsed.data.browser ?? detected.browser,
  });
  if (error) {
    logServerError("push.subscribe", error);
    const limited = /RATE_LIMITED|TOO_MANY_DEVICES/.test(error.message);
    return NextResponse.json({ ok: false, message: humanizeError(error) }, { status: limited ? 429 : 400 });
  }
  logPush("push_subscription_created", { userId: user.id, subscriptionId: data });
  return NextResponse.json({ ok: true });
}
