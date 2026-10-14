import type { Metadata } from "next";
import { Badge, PageHeader } from "@/components/ui/display";
import { CategoryEditor } from "@/components/admin/admin-controls";
import { getSupabase } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";

export const metadata: Metadata = { title: "Categorias" };

export default async function AdminCategoriesPage() {
  const categories = await listCategories(await getSupabase(), { includeInactive: true });
  return (
    <div className="space-y-5">
      <PageHeader title="Categorias" />
      <section aria-labelledby="nova"><h2 id="nova" className="mb-2 text-lg font-bold">Nova categoria</h2><CategoryEditor /></section>
      <section aria-labelledby="existentes" className="space-y-3">
        <h2 id="existentes" className="text-lg font-bold">Existentes</h2>
        {categories.map((c) => (
          <div key={c.id} className="space-y-1">
            {!c.active && <Badge tone="neutral">Inativa</Badge>}
            <CategoryEditor category={c} />
          </div>
        ))}
      </section>
    </div>
  );
}
