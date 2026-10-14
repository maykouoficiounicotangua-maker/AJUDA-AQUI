import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createUser, type Db } from "./harness";

let db: Db;
let ana: string;
let bia: string;

const q = <T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<T>(sql, params)).rows);
const notify = (user: string, type = "NEW_MATCH") =>
  db.query<{ id: string | null }>(`select public.create_notification($1, $2, 'Título', 'Corpo', '/notificacoes') as id`, [user, type]);

beforeAll(async () => {
  db = await createDb();
  ana = await createUser(db, "Ana Push");
  bia = await createUser(db, "Bia Push");
});

describe("fila de push (notifications.push_status)", () => {
  it("a notificação interna nasce PENDING quando o push está ligado", async () => {
    const { rows } = await notify(ana);
    const n = await db.query<{ push_status: string }>(`select push_status from notifications where id = $1`, [rows[0].id]);
    expect(n.rows[0].push_status).toBe("PENDING");
  });

  it("respeita preferências: push desligado => SKIPPED (interna continua existindo)", async () => {
    await q(bia, `update notification_preferences set push_enabled = false where user_id = $1`, [bia]);
    const { rows } = await notify(bia);
    const n = await db.query<{ push_status: string }>(`select push_status from notifications where id = $1`, [rows[0].id]);
    expect(n.rows[0].push_status).toBe("SKIPPED");
  });

  it("grupo desligado => nenhuma notificação criada; in-app desligado => nenhuma", async () => {
    await q(bia, `update notification_preferences set pref_matches = false where user_id = $1`, [bia]);
    expect((await notify(bia, "NEW_MATCH")).rows[0].id).toBeNull();
    expect((await notify(bia, "NEW_MESSAGE")).rows[0].id).not.toBeNull(); // outro grupo continua
    await q(bia, `update notification_preferences set in_app_enabled = false where user_id = $1`, [bia]);
    expect((await notify(bia, "NEW_MESSAGE")).rows[0].id).toBeNull();
  });

  it("destinatário inexistente é ignorado sem erro", async () => {
    const { rows } = await notify("00000000-0000-0000-0000-00000000dead");
    expect(rows[0].id).toBeNull();
  });

  it("claim_pending_push reivindica cada notificação UMA vez (sem envio duplicado)", async () => {
    await notify(ana);
    await notify(ana);
    const first = await db.query(`select * from public.claim_pending_push(50)`);
    expect(first.rows.length).toBeGreaterThanOrEqual(3);
    expect(first.rows.every((r) => (r as { push_status: string }).push_status === "SENDING")).toBe(true);
    const second = await db.query(`select * from public.claim_pending_push(50)`);
    expect(second.rows).toHaveLength(0);
  });

  it("usuário comum não pode chamar a fila nem criar notificações", async () => {
    await expect(q(ana, `select * from public.claim_pending_push(10)`)).rejects.toThrow(/permission denied/i);
    await expect(q(ana, `select public.create_notification($1,'NEW_MATCH','x','y')`, [ana])).rejects.toThrow(/permission denied/i);
  });
});

describe("push_subscriptions", () => {
  const endpoint = (n: number) => `https://push.example.com/send/${n}-` + "x".repeat(30);
  const sub = (user: string, ep: string) =>
    q(user, `select upsert_push_subscription($1, $2, $3, 'UA', 'desktop', 'Chrome')`, [ep, "p".repeat(30), "a".repeat(20)]);

  it("limita 10 dispositivos ativos por usuário", async () => {
    const u = await createUser(db, "Multi Device");
    for (let i = 0; i < 10; i++) await sub(u, endpoint(i));
    await expect(sub(u, endpoint(99))).rejects.toThrow(/TOO_MANY_DEVICES/);
    // reassinar um endpoint já existente continua permitido
    await expect(sub(u, endpoint(3))).resolves.toBeDefined();
  });

  it("usuário pode desativar (is_active=false) e remover só a própria assinatura", async () => {
    const u = await createUser(db, "Dono Sub");
    const other = await createUser(db, "Outro Sub");
    await sub(u, endpoint(500));
    expect(await q(other, `update push_subscriptions set is_active = false returning id`)).toHaveLength(0);
    expect(await q(u, `update push_subscriptions set is_active = false returning id`)).toHaveLength(1);
    // colunas de chave não são editáveis pelo cliente
    await expect(q(u, `update push_subscriptions set endpoint = 'https://evil.example/x' `)).rejects.toThrow(/permission denied/i);
  });

  it("rejeita endpoint/chaves absurdos pelo CHECK do banco", async () => {
    const u = await createUser(db, "Check Sub");
    await expect(q(u, `select upsert_push_subscription('x', 'p', 'a')`)).rejects.toThrow(/check/i);
  });
});
