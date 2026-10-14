import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createOpenRequest, createUser, type Db } from "./harness";

let db: Db;
let owner: string;
let helper: string;

const q = <T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<T>(sql, params)).rows);

beforeAll(async () => {
  db = await createDb();
  owner = await createUser(db, "Dona Pedido");
  helper = await createUser(db, "Ajudante Lembrete");
});

describe("migration 0007", () => {
  it("o feed esconde pedidos abertos cujo horário já passou (mesmo antes do cron)", async () => {
    const vivo = await createOpenRequest(db, owner, { title: "Pedido ainda no futuro" });
    const vencido = await createOpenRequest(db, owner, { title: "Pedido que já passou" });
    await db.query(`update help_requests set scheduled_date = current_date - 1 where id = $1`, [vencido]);
    const ids = (await q<{ id: string }>(helper, `select id from search_requests()`)).map((r) => r.id);
    expect(ids).toContain(vivo);
    expect(ids).not.toContain(vencido);
    // proposta para pedido vencido é recusada
    await expect(q(helper, `select submit_offer($1, 'Ainda dá tempo?')`, [vencido])).rejects.toThrow(/REQUEST_NOT_OPEN/);
  });

  it("filtro de cidade/bairro ignora maiúsculas", async () => {
    const id = await createOpenRequest(db, owner, { title: "Pedido para filtro de cidade" });
    const rows = await q<{ id: string }>(helper, `select id from search_requests(p_city => 'NITERÓI', p_neighborhood => 'icaraí')`);
    expect(rows.map((r) => r.id)).toContain(id);
  });

  it("lembrete 'ajuda próxima' avisa as duas partes uma única vez", async () => {
    const id = await createOpenRequest(db, owner, { title: "Ajuda que vai acontecer" });
    const oid = (await q<{ submit_offer: string }>(helper, `select submit_offer($1, 'Posso ajudar sim')`, [id]))[0].submit_offer;
    await q(owner, `select accept_offer($1)`, [oid]);
    // aproxima a ajuda para daqui a ~2 h
    await db.query(
      `update help_requests set scheduled_date = (now() at time zone timezone + interval '2 hours')::date,
                                scheduled_time = (now() at time zone timezone + interval '2 hours')::time where id = $1`, [id]);

    const first = await db.query<{ n: number }>(`select send_upcoming_reminders() as n`);
    expect(first.rows[0].n).toBe(1);
    const second = await db.query<{ n: number }>(`select send_upcoming_reminders() as n`);
    expect(second.rows[0].n).toBe(0);

    for (const u of [owner, helper]) {
      const rows = await q(u, `select 1 from notifications where type = 'REQUEST_REMINDER'`);
      expect(rows).toHaveLength(1);
    }
  });

  it("usuário comum não executa o job de lembretes", async () => {
    await expect(q(owner, `select send_upcoming_reminders()`)).rejects.toThrow(/permission denied/i);
  });
});
