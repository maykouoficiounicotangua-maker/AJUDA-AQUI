import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/auth/route";
import { logServerError } from "@/lib/errors";

/**
 * LGPD — portabilidade: devolve, em JSON, os dados do PRÓPRIO usuário.
 * Usa o cliente do usuário: a RLS garante que nada de terceiros sai daqui
 * (ex.: telefone da contraparte não entra, endereço só dos próprios pedidos).
 */
export async function GET() {
  const ctx = await getRouteUser();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
  const { supabase, user } = ctx;
  const me = user.id;

  try {
    const [profile, contact, consents, categories, helperPrefs, requests, offers, messages, reviewsGiven, reviewsReceived, notifications, favorites, blocks, reports] =
      await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, country_code, state, city, neighborhood, bio, profile_visibility, show_rating, show_help_count, created_at").eq("id", me).maybeSingle(),
        supabase.from("profile_contacts").select("phone").eq("user_id", me).maybeSingle(),
        supabase.from("consents").select("terms_version, privacy_version, safety_version, accepted_at").eq("user_id", me),
        supabase.from("user_categories").select("category:categories(name)").eq("user_id", me),
        supabase.from("helper_preferences").select("description, state, city, neighborhood, max_distance_km, accepts_paid, accepts_free, accepts_exchange, available_days, availability_start, availability_end, active").eq("user_id", me).maybeSingle(),
        supabase.from("help_requests").select("id, title, description, help_type, amount_cents, exchange_description, state, city, neighborhood, scheduled_date, scheduled_time, duration_minutes, status, created_at, private:help_request_private(address, notes)").eq("requester_id", me),
        supabase.from("help_request_offers").select("request_id, message, status, created_at").eq("helper_id", me),
        supabase.from("messages").select("conversation_id, content, created_at").eq("sender_id", me).limit(5000),
        supabase.from("reviews").select("request_id, rating, comment, created_at").eq("reviewer_id", me),
        supabase.from("reviews").select("request_id, rating, comment, created_at").eq("reviewee_id", me),
        supabase.from("notifications").select("type, title, body, read, created_at").eq("user_id", me).limit(1000),
        supabase.from("favorites").select("favorite_type, request_id, category_id, target_user_id, created_at").eq("user_id", me),
        supabase.from("blocks").select("blocked_id, created_at").eq("blocker_id", me),
        supabase.from("reports").select("reason, description, status, created_at").eq("reporter_id", me),
      ]);

    const body = {
      gerado_em: new Date().toISOString(),
      conta: { id: me, email: user.email, criada_em: user.created_at },
      perfil: profile.data, telefone: contact.data?.phone ?? null, consentimentos: consents.data,
      categorias: categories.data, disponibilidade: helperPrefs.data,
      pedidos: requests.data, propostas: offers.data, mensagens_enviadas: messages.data,
      avaliacoes_feitas: reviewsGiven.data, avaliacoes_recebidas: reviewsReceived.data,
      notificacoes: notifications.data, favoritos: favorites.data, bloqueios: blocks.data, denuncias_feitas: reports.data,
    };
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ajuda-aqui-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logServerError("account.export", err);
    return NextResponse.json({ ok: false, message: "Não conseguimos gerar o arquivo agora." }, { status: 500 });
  }
}
