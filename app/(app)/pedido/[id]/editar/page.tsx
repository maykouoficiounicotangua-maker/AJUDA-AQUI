import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestWizard } from "@/components/requests/request-wizard";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";
import { getRequest, getRequestPrivate } from "@/services/requests";

export const metadata: Metadata = { title: "Editar pedido" };

export default async function EditRequestPage({ params }: PageProps<"/pedido/[id]/editar">) {
  const { id } = await params;
  const { userId, profile } = await requireUser();
  const db = await getSupabase();
  const request = await getRequest(db, id);
  // Só o dono edita, e só enquanto é rascunho ou está aberto (a RLS também impede)
  if (!request || request.requester_id !== userId || !["DRAFT", "OPEN"].includes(request.status)) notFound();
  const [categories, priv] = await Promise.all([listCategories(db), getRequestPrivate(db, id)]);

  return (
    <RequestWizard
      categories={categories}
      requestId={id}
      initialStatus={request.status as "DRAFT" | "OPEN"}
      defaults={{ state: profile.state ?? "", city: profile.city ?? "", neighborhood: profile.neighborhood ?? "" }}
      initial={{
        categoryId: request.category_id,
        title: request.title,
        description: request.description,
        scheduledDate: request.scheduled_date,
        scheduledTime: request.scheduled_time.slice(0, 5),
        durationMinutes: request.duration_minutes,
        state: request.state,
        city: request.city,
        neighborhood: request.neighborhood ?? "",
        address: priv?.address ?? "",
        helpType: request.help_type,
        amountCents: request.amount_cents ?? undefined,
        exchangeDescription: request.exchange_description ?? "",
      }}
    />
  );
}
