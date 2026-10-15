import type { Metadata } from "next";
import { RequestWizard } from "@/components/requests/request-wizard";
import { Notice } from "@/components/ui/display";
import { getAuthUser, getCurrentProfile, getSupabase } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";

export const metadata: Metadata = { title: "Pedir ajuda" };

/** Aberto a visitantes: o pedido é preenchido sem login; o cadastro só é pedido na hora de publicar. */
export default async function NewRequestPage() {
  const user = await getAuthUser();
  const profile = user ? await getCurrentProfile() : null;
  const categories = await listCategories(await getSupabase());
  return (
    <>
      {profile && profile.status !== "ACTIVE" && <div className="mb-4"><Notice tone="warning">Sua conta está com restrições e não pode publicar pedidos.</Notice></div>}
      <RequestWizard
        categories={categories}
        visitor={!profile}
        defaults={{ state: profile?.state ?? "", city: profile?.city ?? "", neighborhood: profile?.neighborhood ?? "" }}
      />
    </>
  );
}
