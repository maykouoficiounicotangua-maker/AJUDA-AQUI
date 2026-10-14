import type { Offer } from "@/types";
import { fail, ok, type Db, type ServiceResult } from "./db";

const OFFER_COLUMNS = "id, request_id, helper_id, message, status, created_at";

export async function listOffersForRequest(db: Db, requestId: string): Promise<Offer[]> {
  const { data } = await db
    .from("help_request_offers")
    .select(OFFER_COLUMNS)
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  return (data as Offer[] | null) ?? [];
}

export async function getMyOffer(db: Db, requestId: string, userId: string): Promise<Offer | null> {
  const { data } = await db
    .from("help_request_offers")
    .select(OFFER_COLUMNS)
    .eq("request_id", requestId)
    .eq("helper_id", userId)
    .maybeSingle();
  return (data as Offer | null) ?? null;
}

export interface MyOfferRow extends Offer {
  request: { id: string; title: string; status: string; scheduled_date: string; city: string } | null;
}

/** Minhas ajudas → propostas que enviei. */
export async function listMyOffers(db: Db, userId: string, limit = 30): Promise<MyOfferRow[]> {
  const { data } = await db
    .from("help_request_offers")
    .select(`${OFFER_COLUMNS}, request:help_requests(id, title, status, scheduled_date, city)`)
    .eq("helper_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as unknown as MyOfferRow[] | null) ?? [];
}

export async function submitOffer(db: Db, requestId: string, message: string): Promise<ServiceResult<string>> {
  const { data, error } = await db.rpc("submit_offer", { p_request_id: requestId, p_message: message });
  return error ? fail(error) : ok(data as string);
}

export async function acceptOffer(db: Db, offerId: string): Promise<ServiceResult<string>> {
  const { data, error } = await db.rpc("accept_offer", { p_offer_id: offerId });
  return error ? fail(error) : ok(data as string); // id da conversa
}

export async function rejectOffer(db: Db, offerId: string): Promise<ServiceResult> {
  const { error } = await db.rpc("reject_offer", { p_offer_id: offerId });
  return error ? fail(error) : ok(undefined);
}

export async function withdrawOffer(db: Db, offerId: string): Promise<ServiceResult> {
  const { error } = await db.rpc("withdraw_offer", { p_offer_id: offerId });
  return error ? fail(error) : ok(undefined);
}
