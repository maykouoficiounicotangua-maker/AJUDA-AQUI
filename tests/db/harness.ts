/**
 * Harness de testes de banco: sobe um Postgres em memória (PGlite), emula o mínimo do
 * Supabase (schema auth, auth.uid(), roles anon/authenticated/service_role) e aplica
 * as migrations REAIS de supabase/migrations. Permite testar RLS e RPCs de verdade.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text, role text, email text, last_sign_in_at timestamptz,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  confirmation_token text, recovery_token text, email_change text, email_change_token_new text
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users (id) on delete cascade,
  identity_data jsonb, provider text, provider_id text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export type Db = PGlite;

export async function createDb(): Promise<Db> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (e) {
      throw new Error(`Falha na migration ${file}: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Aplica supabase/seed.sql (dados de demonstração). */
export async function applySeed(db: Db): Promise<void> {
  await db.exec(readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8"));
}

/** Cria um usuário (dispara handle_new_user) e devolve o id. */
export async function createUser(
  db: Db,
  name: string,
  opts: { city?: string; state?: string; role?: "USER" | "ADMIN"; phone?: string } = {},
): Promise<string> {
  const meta = {
    full_name: name,
    city: opts.city ?? "Niterói",
    state: opts.state ?? "RJ",
    phone: opts.phone ?? "+55 21 99999-0000",
  };
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [`${name.toLowerCase().replace(/\s+/g, ".")}@teste.local`, JSON.stringify(meta)],
  );
  const id = res.rows[0].id;
  if (opts.role === "ADMIN") {
    await db.query(`update public.profiles set role = 'ADMIN' where id = $1`, [id]);
  }
  return id;
}

/** Executa `fn` como o usuário autenticado (RLS ativa). Sem userId => anon. */
export async function asUser<T>(db: Db, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    userId
      ? `set role authenticated; set request.jwt.claim.sub = '${userId}';`
      : `set role anon; set request.jwt.claim.sub = '';`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub;`);
  }
}

export async function categoryId(db: Db, slug: string): Promise<string> {
  const r = await db.query<{ id: string }>(`select id from public.categories where slug = $1`, [slug]);
  return r.rows[0].id;
}

/** Rascunho + publicação de um pedido como `userId`. Retorna o id. */
export async function createOpenRequest(
  db: Db,
  userId: string,
  over: Partial<{ title: string; slug: string; type: "FREE" | "PAID" | "EXCHANGE"; amount: number }> = {},
): Promise<string> {
  const cat = await categoryId(db, over.slug ?? "entregas");
  return asUser(db, userId, async () => {
    const type = over.type ?? "PAID";
    const ins = await db.query<{ id: string }>(
      `insert into public.help_requests
        (requester_id, category_id, title, description, help_type, amount_cents, exchange_description,
         state, city, neighborhood, public_latitude, public_longitude, scheduled_date, scheduled_time)
       values ($1,$2,$3,'Descrição suficiente do pedido',$4::help_type,$5,$6,'RJ','Niterói','Icaraí',
               -22.9068, -43.1064, (now() at time zone 'America/Sao_Paulo')::date + 2, '18:00')
       returning id`,
      [
        userId,
        cat,
        over.title ?? "Buscar uma encomenda",
        type,
        type === "PAID" ? (over.amount ?? 2000) : null,
        type === "EXCHANGE" ? "Troco por um bolo" : null,
      ],
    );
    await db.query(`select public.publish_request($1)`, [ins.rows[0].id]);
    return ins.rows[0].id;
  });
}
