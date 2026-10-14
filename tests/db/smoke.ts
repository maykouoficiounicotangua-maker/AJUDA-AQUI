import { createDb } from "./harness";

createDb()
  .then(async (db) => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.categories`);
    console.log("OK migrations aplicadas. categorias:", r.rows[0].n);
  })
  .catch((e) => {
    console.error(String(e.message ?? e));
    process.exit(1);
  });
