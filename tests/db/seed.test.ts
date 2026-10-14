import { beforeAll, describe, expect, it } from "vitest";
import { applySeed, asUser, createDb, type Db } from "./harness";

const MARIA = "11111111-0000-0000-0000-000000000001";
const JOAO = "11111111-0000-0000-0000-000000000002";
const ADMIN = "11111111-0000-0000-0000-000000000099";

let db: Db;
const q = <T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<T>(sql, params)).rows);
const count = async (sql: string) => Number((await db.query<{ n: string }>(sql)).rows[0].n);

beforeAll(async () => {
  db = await createDb();
  await applySeed(db);
});

describe("seed.sql (dados de demonstração)", () => {
  it("cria 11 usuários demo, 15 pedidos, propostas, conversas e avaliações", async () => {
    expect(await count(`select count(*) n from profiles where is_demo`)).toBe(11);
    expect(await count(`select count(*) n from help_requests where is_demo`)).toBe(15);
    expect(await count(`select count(*) n from help_request_offers`)).toBeGreaterThanOrEqual(8);
    expect(await count(`select count(*) n from conversations`)).toBe(4);
    expect(await count(`select count(*) n from reviews`)).toBe(4);
    expect(await count(`select count(*) n from messages`)).toBeGreaterThan(8);
  });

  it("é idempotente: rodar de novo recria os dados sem duplicar (reset do seed)", async () => {
    await applySeed(db);
    expect(await count(`select count(*) n from profiles where is_demo`)).toBe(11);
    expect(await count(`select count(*) n from help_requests where is_demo`)).toBe(15);
  });

  it("marca tudo como demonstração e há exatamente um admin", async () => {
    expect(await count(`select count(*) n from help_requests where not is_demo`)).toBe(0);
    expect(await count(`select count(*) n from profiles where role = 'ADMIN'`)).toBe(1);
  });

  it("cobre estados variados e os três tipos de ajuda", async () => {
    const st = await db.query<{ status: string }>(`select distinct status from help_requests`);
    expect(st.rows.map((r) => r.status)).toEqual(expect.arrayContaining(["OPEN", "AWAITING_CONFIRMATION", "IN_PROGRESS", "COMPLETED", "CANCELLED"]));
    const ty = await db.query<{ help_type: string }>(`select distinct help_type from help_requests`);
    expect(ty.rows).toHaveLength(3);
  });

  it("a RLS vale para os dados demo: João vê pedidos abertos, mas não o endereço do pedido de Maria", async () => {
    const open = await q(JOAO, `select id from help_requests where status = 'OPEN'`);
    expect(open.length).toBeGreaterThanOrEqual(10);
    const addr = await q(JOAO, `select address from help_request_private where request_id = '22222222-0000-0000-0000-000000000001'`);
    expect(addr).toHaveLength(0);
    const mine = await q(MARIA, `select address from help_request_private where request_id = '22222222-0000-0000-0000-000000000001'`);
    expect(mine).toHaveLength(1);
  });

  it("reputação calculada: João tem 1 ajuda concluída e nota 5", async () => {
    const [s] = await q<{ helps_completed: number; avg_rating: string }>(MARIA, `select helps_completed, avg_rating from profile_stats where user_id = $1`, [JOAO]);
    expect(s.helps_completed).toBe(1);
    expect(Number(s.avg_rating)).toBe(5);
  });

  it("admin vê a denúncia e as estatísticas; usuário comum não", async () => {
    expect(await q(ADMIN, `select 1 from reports`)).toHaveLength(1);
    const [stats] = await q<{ admin_dashboard_stats: { users_total: number } }>(ADMIN, `select admin_dashboard_stats()`);
    expect(stats.admin_dashboard_stats.users_total).toBe(11);
    await expect(q(MARIA, `select admin_dashboard_stats()`)).rejects.toThrow(/FORBIDDEN/);
  });

  it("push das notificações demo nunca fica pendente (não dispara envio real)", async () => {
    expect(await count(`select count(*) n from notifications where push_status = 'PENDING'`)).toBe(0);
  });
});
