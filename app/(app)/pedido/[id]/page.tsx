import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, MessageCircle, Phone, Wallet } from "lucide-react";
import { Badge, Card, EmptyState, Notice } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { HelpTypeBadge, MatchBadge } from "@/components/requests/request-card";
import { CategoryIcon } from "@/components/requests/category-icon";
import { RequestActions } from "@/components/requests/request-actions";
import { FavoriteButton } from "@/components/requests/favorite-button";
import { OfferForm, MyOfferNotice } from "@/components/offers/offer-form";
import { OffersPanel, type OfferItem } from "@/components/offers/offers-panel";
import { ProfileMini } from "@/components/profile/profile-mini";
import { ReviewForm } from "@/components/reviews/review-form";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { availableActions, STATUS_LABELS, STATUS_TONE, viewerRole } from "@/lib/requests/state-machine";
import { formatApproxDistance, haversineKm } from "@/lib/geo/distance";
import { toMatchRequest } from "@/lib/matching/mappers";
import { matching } from "@/lib/matching/basic";
import { formatDuration, formatRequestDate, formatTime } from "@/lib/utils/format";
import { listCategories } from "@/services/categories";
import { getConversationIdForRequest } from "@/services/conversations";
import { loadHelperForUser } from "@/services/matching";
import { getMyOffer, listOffersForRequest } from "@/services/offers";
import { getPhone, getProfilesByIds, getStatsByIds } from "@/services/profiles";
import { getRequest, getRequestPrivate } from "@/services/requests";
import { getMyReview, listFavoriteIds } from "@/services/social";

export async function generateMetadata({ params }: PageProps<"/pedido/[id]">): Promise<Metadata> {
  await params;
  // Título genérico: o conteúdo do pedido não vai para metadados (privacidade/indexação)
  return { title: "Pedido de ajuda", robots: { index: false, follow: false } };
}

export default async function RequestDetailPage({ params }: PageProps<"/pedido/[id]">) {
  const { id } = await params;
  const { userId } = await requireUser();
  const db = await getSupabase();

  const request = await getRequest(db, id);
  if (!request) notFound(); // não existe OU a RLS não permite ver (mesma resposta)

  const role = viewerRole(request, userId);
  const isOwner = role === "requester";
  const [categories, offers, myOffer, favorites] = await Promise.all([
    listCategories(db, { includeInactive: true }),
    isOwner ? listOffersForRequest(db, id) : Promise.resolve([]),
    role === "other" ? getMyOffer(db, id, userId) : Promise.resolve(null),
    listFavoriteIds(db, userId, "REQUEST"),
  ]);
  const category = categories.find((c) => c.id === request.category_id);

  const counterpartId = isOwner ? request.selected_helper_id : role === "helper" ? request.requester_id : null;
  const profileIds = [request.requester_id, ...offers.map((o) => o.helper_id), ...(counterpartId ? [counterpartId] : [])];
  const [profiles, stats] = await Promise.all([getProfilesByIds(db, profileIds), getStatsByIds(db, profileIds)]);
  const requester = profiles.get(request.requester_id);

  // matching para quem pode se candidatar
  let match = null;
  let distanceKm: number | null = null;
  if (role === "other" && request.status === "OPEN") {
    const { helper } = await loadHelperForUser(db, userId);
    match = matching.score(toMatchRequest(request), helper);
    if (helper.lat != null && request.public_latitude != null && request.public_longitude != null)
      distanceKm = haversineKm({ lat: helper.lat, lng: helper.lng! }, { lat: request.public_latitude, lng: request.public_longitude });
    // registra visualização (evento estruturado de analytics)
    await db.from("analytics_events").insert({ user_id: userId, event: "REQUEST_VIEWED", properties: { request_id: id } });
  }

  const hasReviewed = request.status === "COMPLETED" ? Boolean(await getMyReview(db, id, userId)) : false;
  const actions = availableActions(request, userId, { hasOffer: !!myOffer, hasReviewed });

  // Liberações controladas (a RLS decide; se não houver permissão, vem vazio)
  const [conversationId, priv, counterpartPhone] = await Promise.all([
    role !== "other" ? getConversationIdForRequest(db, id) : Promise.resolve(null),
    role !== "other" ? getRequestPrivate(db, id) : Promise.resolve(null),
    counterpartId && role !== "other" ? getPhone(db, counterpartId) : Promise.resolve(null),
  ]);

  const counterpart = counterpartId ? profiles.get(counterpartId) : null;
  const offerItems: OfferItem[] = offers.map((o) => {
    const p = profiles.get(o.helper_id);
    return {
      id: o.id, helperId: o.helper_id, message: o.message, status: o.status, createdAt: o.created_at,
      helperName: p?.full_name.split(" ")[0] ?? "ajudante",
      profile: p ? <ProfileMini profile={p} stats={stats.get(p.id)} /> : <span className="text-ink-muted">Usuário indisponível</span>,
    };
  });
  const where = [request.neighborhood, request.city, request.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <CategoryIcon name={category?.icon} className="size-4" /> {category?.name}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl leading-tight font-extrabold sm:text-3xl">{request.title}</h1>
          {role === "other" && <FavoriteButton type="REQUEST" id={id} initial={favorites.has(id)} label="Favoritar pedido" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABELS[request.status]}</Badge>
          <HelpTypeBadge type={request.help_type} amountCents={request.amount_cents} />
          <MatchBadge match={match} />
        </div>
      </header>

      <Card className="space-y-4">
        <p className="break-words whitespace-pre-line">{request.description}</p>
        <ul className="grid gap-2 text-ink-muted sm:grid-cols-2">
          <li className="flex items-center gap-2"><CalendarDays className="size-5" aria-hidden /> {formatRequestDate(request.scheduled_date)}</li>
          <li className="flex items-center gap-2"><Clock className="size-5" aria-hidden /> {formatTime(request.scheduled_time)} · {formatDuration(request.duration_minutes)}</li>
          <li className="flex items-center gap-2"><MapPin className="size-5" aria-hidden /> {where}{formatApproxDistance(distanceKm) ? ` · ${formatApproxDistance(distanceKm)}` : ""}</li>
          {request.help_type === "PAID" && <li className="flex items-center gap-2"><Wallet className="size-5" aria-hidden /> Valor combinado: <HelpTypeBadge type="PAID" amountCents={request.amount_cents} /></li>}
          {request.help_type === "EXCHANGE" && <li className="flex items-center gap-2 sm:col-span-2"><Wallet className="size-5" aria-hidden /> Troca: {request.exchange_description}</li>}
        </ul>
      </Card>

      {requester && !isOwner && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">Quem pediu</h2>
          <ProfileMini profile={requester} stats={stats.get(requester.id)} />
        </Card>
      )}

      {/* ---- Candidatura (outros usuários) ---- */}
      {role === "other" && request.status === "OPEN" && (
        myOffer ? <MyOfferNotice offerId={myOffer.id} requestId={id} status={myOffer.status} message={myOffer.message} />
          : actions.includes("offer") ? <OfferForm requestId={id} /> : null
      )}
      {role === "other" && request.status === "OPEN" && myOffer?.status === "WITHDRAWN" && <OfferForm requestId={id} />}

      {/* ---- Interessados (solicitante) ---- */}
      {isOwner && ["OPEN", "ASSIGNED", "AWAITING_CONFIRMATION", "IN_PROGRESS", "COMPLETION_PENDING", "DISPUTED", "COMPLETED"].includes(request.status) && (
        <section aria-labelledby="interessados" className="space-y-3">
          <h2 id="interessados" className="text-xl font-extrabold">Interessados {offers.length > 0 && `(${offers.length})`}</h2>
          {offerItems.length === 0 ? (
            <EmptyState title="Ainda não há interessados." description="Avisamos você assim que alguém se candidatar." />
          ) : (
            <OffersPanel requestId={id} offers={offerItems} canDecide={request.status === "OPEN"} />
          )}
        </section>
      )}

      {/* ---- Ajuda em andamento (solicitante e ajudante) ---- */}
      {counterpart && role !== "other" && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">{isOwner ? "Quem vai ajudar" : "Quem pediu a ajuda"}</h2>
          <ProfileMini profile={counterpart} stats={stats.get(counterpart.id)} />
          {conversationId && (
            <LinkButton href={`/conversa/${conversationId}`} variant="secondary" className="w-full"><MessageCircle className="size-5" aria-hidden /> Abrir conversa</LinkButton>
          )}
          {counterpartPhone && (
            <p className="flex items-center gap-2"><Phone className="size-5" aria-hidden /> <a href={`tel:${counterpartPhone}`} className="font-semibold underline">{counterpartPhone}</a></p>
          )}
          {priv?.address && <p className="rounded-2xl bg-slate-50 p-3"><span className="block text-xs font-semibold text-ink-muted uppercase">Endereço (privado)</span>{priv.address}</p>}
          {role === "helper" && !priv?.address && ["ASSIGNED"].includes(request.status) && (
            <Notice tone="info">O endereço, se houver, será liberado depois que você confirmar a ajuda.</Notice>
          )}
        </Card>
      )}

      {request.status === "DISPUTED" && <Notice tone="warning" title="Em análise">Um problema foi relatado. Nossa equipe vai avaliar e entrar em contato pelo app.</Notice>}
      {request.status === "COMPLETION_PENDING" && actions.includes("mark_done") && <Notice tone="info">A outra pessoa já marcou como concluída. Confirme se deu tudo certo.</Notice>}

      {/* ---- Ações do fluxo ---- */}
      {actions.some((a) => a !== "offer" && a !== "review") && <RequestActions requestId={id} actions={actions} />}

      {request.status === "COMPLETED" && counterpart && !hasReviewed && actions.includes("review") && (
        <ReviewForm requestId={id} otherName={counterpart.full_name.split(" ")[0]} />
      )}
      {request.status === "COMPLETED" && hasReviewed && <Notice tone="success">Você já avaliou esta ajuda. Obrigado!</Notice>}

      {!isOwner && requester && (
        <p className="text-center text-sm text-ink-muted">
          Algo errado? <Link href={`/usuario/${requester.id}`} className="font-semibold underline">Ver perfil para bloquear ou denunciar</Link>
        </p>
      )}
    </div>
  );
}
