import type { Metadata } from "next";
import { RequestWizard } from "@/components/requests/request-wizard";
import { Notice } from "@/components/ui/display";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";

export const metadata: Metadata = { title: "Criar pedido" };

export default async function NewRequestPage() {
  const { profile } = await requireUser();
  const categories = await listCategories(await getSupabase());
  return (
    <>
      {profile.status !== "ACTIVE" && <div className="mb-4"><Notice tone="warning">Sua conta está com restrições e não pode publicar pedidos.</Notice></div>}
      <RequestWizard
        categories={categories}
        defaults={{ state: profile.state ?? "", city: profile.city ?? "", neighborhood: profile.neighborhood ?? "" }}
      />
    </>
  );
}
