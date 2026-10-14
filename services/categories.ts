import type { Category } from "@/types";
import type { Db } from "./db";

const COLUMNS = "id, name, slug, icon, description, active";

export async function listCategories(db: Db, opts: { includeInactive?: boolean } = {}): Promise<Category[]> {
  let q = db.from("categories").select(COLUMNS).order("name");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data } = await q;
  // "Outros" sempre por último
  return ((data as Category[] | null) ?? []).sort((a, b) => Number(a.slug === "outros") - Number(b.slug === "outros"));
}
