import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/display";
import { RequestCard } from "@/components/requests/request-card";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";
import { getProfilesByIds } from "@/services/profiles";
import { REQUEST_COLUMNS } from "@/services/requests";
import { listFavoriteIds } from "@/services/social";
import type { HelpRequest } from "@/types";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  const { userId } = await requireUser();
  const db = await getSupabase();
  const [requestIds, userIds, categories] = await Promise.all([
    listFavoriteIds(db, userId, "REQUEST"), listFavoriteIds(db, userId, "USER"), listCategories(db, { includeInactive: true }),
  ]);
  const [{ data: reqRows }, profiles] = await Promise.all([
    requestIds.size ? db.from("help_requests").select(REQUEST_COLUMNS).in("id", [...requestIds]) : Promise.resolve({ data: [] }),
    getProfilesByIds(db, [...userIds]),
  ]);
  const requests = (reqRows as HelpRequest[] | null) ?? [];
  const catById = new Map(categories.map((c) => [c.id, c]));
  const empty = requests.length === 0 && profiles.size === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Favoritos" />
      {empty ? (
        <EmptyState title="Seus favoritos aparecerão aqui." icon={<Heart className="size-10" aria-hidden />} />
      ) : (
        <>
          {requests.length > 0 && (
            <section aria-labelledby="fav-pedidos" className="space-y-3">
              <h2 id="fav-pedidos" className="text-xl font-extrabold">Pedidos</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {requests.map((r) => <li key={r.id}><RequestCard request={r} category={catById.get(r.category_id)} showStatus /></li>)}
              </ul>
            </section>
          )}
          {profiles.size > 0 && (
            <section aria-labelledby="fav-pessoas" className="space-y-3">
              <h2 id="fav-pessoas" className="text-xl font-extrabold">Pessoas</h2>
              <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
                {[...profiles.values()].map((p) => (
                  <li key={p.id}>
                    <Link href={`/usuario/${p.id}`} className="flex min-h-16 items-center gap-3 p-4 hover:bg-slate-50">
                      <Avatar name={p.full_name} src={p.avatar_url} size={44} /> <span className="font-bold">{p.full_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
