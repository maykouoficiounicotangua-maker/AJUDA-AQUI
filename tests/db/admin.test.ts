import { beforeAll, describe, expect, it } from "vitest";
import { applySeed, asUser, createDb, createUser, type Db } from "./harness";

let db: Db;
const ADMIN = "11111111-0000-0000-0000-000000000099";
const MARIA = "11111111-0000-0000-0000-000000000001";
const JOAO = "11111111-0000-0000-0000-000000000002";

const q = <T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<T>(sql, params)).rows);

beforeAll(async () => {
  db = await createDb();
  await applySeed(db);
});

describe("admin (migration 0009)", () => {
  it("e-mail da lista vira ADMIN automaticamente ao se cadastrar; os demais não", async () => {
    await db.query(`insert into admin_allowlist (email) values ('chefe@teste.local')`);
    const chefe = await createUser(db, "chefe"); // gera chefe@teste.local
    const comum = await createUser(db, "comum");
    const roles = await db.query<{ id: string; role: string }>(`select id, role from profiles where id in ($1, $2)`, [chefe, comum]);
    expect(roles.rows.find((r) => r.id === chefe)?.role).toBe("ADMIN");
    expect(roles.rows.find((r) => r.id === comum)?.role).toBe("USER");
  });

  it("ninguém além do servidor lê ou altera a lista de admins", async () => {
    await expect(q(MARIA, `select * from admin_allowlist`)).rejects.toThrow(/permission denied/i);
    await expect(q(MARIA, `insert into admin_allowlist (email) values ('eu@x.com')`)).rejects.toThrow(/permission denied/i);
  });

  it("métricas completas para o admin, com rankings de quem mais ajuda e mais pede", async () => {
    const [{ admin_metrics: m }] = await q<{ admin_metrics: import("@/services/admin").AdminMetrics }>(ADMIN, `select admin_metrics(30)`);
    expect(m.users.total).toBeGreaterThanOrEqual(11);
    expect(m.requests.completed).toBe(2);
    expect(m.top_helpers[0]).toMatchObject({ helps: 1 });
    expect(m.top_requesters.map((r) => r.name)).toContain("Maria Silva");
    expect(m.series).toHaveLength(30);
    expect(m.categories.length).toBe(12);
    expect(m.engagement.avg_rating).not.toBeNull();
    expect(m.funnel).toHaveProperty("first_completion");
  });

  it("usuário comum não acessa métricas, ficha nem aviso geral", async () => {
    await expect(q(MARIA, `select admin_metrics()`)).rejects.toThrow(/FORBIDDEN/);
    await expect(q(MARIA, `select admin_user_overview($1)`, [JOAO])).rejects.toThrow(/FORBIDDEN/);
    await expect(q(MARIA, `select admin_broadcast('Oi pessoal', 'Mensagem para todos')`)).rejects.toThrow(/FORBIDDEN/);
  });

  it("ficha do usuário traz e-mail e números; consulta fica auditada", async () => {
    const [{ admin_user_overview: o }] = await q<{ admin_user_overview: Record<string, unknown> }>(ADMIN, `select admin_user_overview($1)`, [JOAO]);
    expect(o.email).toBe("joao@demo.ajudaaqui.local");
    expect(o.helps_completed).toBe(1);
    expect(await q(ADMIN, `select 1 from audit_logs where action = 'user.viewed' and entity_id = $1`, [JOAO])).toHaveLength(1);
  });

  it("aviso geral chega a todos os usuários ativos (ou de um estado) e é auditado", async () => {
    const [{ admin_broadcast: n }] = await q<{ admin_broadcast: number }>(ADMIN, `select admin_broadcast('Novidade', 'Agora dá para instalar o app!', '/inicio', 'SP')`);
    expect(n).toBe(2); // Beatriz e Diego (SP)
    expect(await q(JOAO, `select 1 from notifications where title = 'Novidade'`)).toHaveLength(0); // João é do RJ
    expect(await q(ADMIN, `select 1 from audit_logs where action = 'broadcast.sent'`)).toHaveLength(1);
    await expect(q(ADMIN, `select admin_broadcast('Oi', 'Link externo', 'https://golpe.com')`)).rejects.toThrow(/INVALID_INPUT/);
  });
});
