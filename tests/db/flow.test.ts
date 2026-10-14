import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createOpenRequest, createUser, type Db } from "./harness";

let db: Db;
let maria: string;
let joao: string;
let carla: string;
let admin: string;

beforeAll(async () => {
  db = await createDb();
  maria = await createUser(db, "Maria Silva");
  joao = await createUser(db, "João Souza");
  carla = await createUser(db, "Carla Dias");
  admin = await createUser(db, "Admin Geral", { role: "ADMIN" });
});

const rpc = <T = unknown>(user: string, sql: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<T>(sql, params)).rows);

describe("fluxo principal: pedir → propor → aceitar → confirmar → concluir → avaliar", () => {
  let requestId: string;
  let offerJoao: string;
  let offerCarla: string;
  let conversationId: string;

  it("Maria publica pedido (DRAFT → OPEN)", async () => {
    requestId = await createOpenRequest(db, maria);
    const [r] = await rpc<{ status: string }>(maria, `select status from help_requests where id = $1`, [requestId]);
    expect(r.status).toBe("OPEN");
  });

  it("João e Carla enviam propostas; João não pode propor duas vezes", async () => {
    offerJoao = (await rpc<{ submit_offer: string }>(joao, `select submit_offer($1, 'Posso fazer hoje às 18h.')`, [requestId]))[0].submit_offer;
    offerCarla = (await rpc<{ submit_offer: string }>(carla, `select submit_offer($1, 'Tenho carro e posso ir.')`, [requestId]))[0].submit_offer;
    await expect(rpc(joao, `select submit_offer($1, 'Outra mensagem qualquer')`, [requestId])).rejects.toThrow(/ALREADY_OFFERED/);
  });

  it("Maria é notificada de cada proposta", async () => {
    const rows = await rpc<{ type: string }>(maria, `select type from notifications where type = 'NEW_OFFER'`);
    expect(rows).toHaveLength(2);
  });

  it("Maria não pode propor ao próprio pedido", async () => {
    await expect(rpc(maria, `select submit_offer($1, 'Eu mesma ajudo')`, [requestId])).rejects.toThrow(/OWN_REQUEST/);
  });

  it("só o dono aceita; aceitar é atômico (rejeita a outra, cria conversa, ASSIGNED)", async () => {
    await expect(rpc(joao, `select accept_offer($1)`, [offerJoao])).rejects.toThrow(/NOT_FOUND/);
    conversationId = (await rpc<{ accept_offer: string }>(maria, `select accept_offer($1)`, [offerJoao]))[0].accept_offer;

    const [r] = await rpc<{ status: string; selected_helper_id: string }>(maria, `select status, selected_helper_id from help_requests where id=$1`, [requestId]);
    expect(r.status).toBe("ASSIGNED");
    expect(r.selected_helper_id).toBe(joao);

    const offers = await rpc<{ id: string; status: string }>(maria, `select id, status from help_request_offers where request_id=$1`, [requestId]);
    expect(offers.find((o) => o.id === offerJoao)?.status).toBe("ACCEPTED");
    expect(offers.find((o) => o.id === offerCarla)?.status).toBe("REJECTED");

    const parts = await rpc(maria, `select 1 from conversation_participants where conversation_id=$1`, [conversationId]);
    expect(parts).toHaveLength(2);
  });

  it("não é possível aceitar duas vezes (concorrência/estado)", async () => {
    await expect(rpc(maria, `select accept_offer($1)`, [offerCarla])).rejects.toThrow(/REQUEST_NOT_OPEN/);
  });

  it("endereço privado só aparece ao ajudante depois que ele confirma", async () => {
    await rpc(maria, `insert into help_request_private (request_id, address) values ($1, 'Rua Secreta 123')`, [requestId]);
    expect(await rpc(joao, `select address from help_request_private where request_id=$1`, [requestId])).toHaveLength(0);
    await rpc(joao, `select confirm_start($1)`, [requestId]);
    expect(await rpc(joao, `select address from help_request_private where request_id=$1`, [requestId])).toHaveLength(1);
    expect(await rpc(carla, `select address from help_request_private where request_id=$1`, [requestId])).toHaveLength(0);
  });

  it("os dois confirmam → IN_PROGRESS", async () => {
    const [mid] = await rpc<{ status: string }>(joao, `select status from help_requests where id=$1`, [requestId]);
    expect(mid.status).toBe("AWAITING_CONFIRMATION");
    const [res] = await rpc<{ confirm_start: string }>(maria, `select confirm_start($1)`, [requestId]);
    expect(res.confirm_start).toBe("IN_PROGRESS");
  });

  it("conclusão em duas confirmações → COMPLETED", async () => {
    const [a] = await rpc<{ mark_done: string }>(maria, `select mark_done($1)`, [requestId]);
    expect(a.mark_done).toBe("COMPLETION_PENDING");
    const [b] = await rpc<{ mark_done: string }>(joao, `select mark_done($1)`, [requestId]);
    expect(b.mark_done).toBe("COMPLETED");
  });

  it("chat: mensagens entre participantes; Carla não vê nem escreve", async () => {
    // conversa fechada após conclusão => ninguém envia
    await expect(
      rpc(maria, `insert into messages (conversation_id, sender_id, content) values ($1, $2, 'oi')`, [conversationId, maria]),
    ).rejects.toThrow();
    expect(await rpc(carla, `select 1 from messages where conversation_id=$1`, [conversationId])).toHaveLength(0);
    expect((await rpc(maria, `select 1 from messages where conversation_id=$1`, [conversationId])).length).toBeGreaterThan(0);
  });

  it("avaliações: só participantes, uma por avaliador; reputação atualiza", async () => {
    await expect(rpc(carla, `select submit_review($1, 5)`, [requestId])).rejects.toThrow(/NOT_FOUND/);
    await rpc(maria, `select submit_review($1, 5, 'Excelente!', 5, 5, 5, 5)`, [requestId]);
    await expect(rpc(maria, `select submit_review($1, 4)`, [requestId])).rejects.toThrow(/ALREADY_REVIEWED/);
    await rpc(joao, `select submit_review($1, 4, 'Tudo certo')`, [requestId]);

    const [stats] = await rpc<{ avg_rating: string; helps_completed: number }>(
      maria, `select avg_rating, helps_completed from profile_stats where user_id=$1`, [joao]);
    expect(Number(stats.avg_rating)).toBe(5);
    expect(stats.helps_completed).toBe(1);
  });

  it("Maria é notificada da avaliação e tem histórico de analytics", async () => {
    const n = await rpc(maria, `select 1 from notifications where type='NEW_REVIEW'`);
    expect(n).toHaveLength(1);
    const ev = await db.query<{ event: string }>(`select distinct event from analytics_events`);
    expect(ev.rows.map((r) => r.event)).toEqual(
      expect.arrayContaining(["SIGNUP", "REQUEST_CREATED", "OFFER_SENT", "OFFER_ACCEPTED", "CHAT_STARTED", "REQUEST_COMPLETED", "REVIEW_CREATED"]),
    );
  });
});

describe("cancelamento, desistência, expiração e disputa", () => {
  it("cancelar pedido expira propostas pendentes", async () => {
    const id = await createOpenRequest(db, maria, { title: "Passear com o cachorro" });
    await rpc(joao, `select submit_offer($1, 'Posso levar o cachorro')`, [id]);
    await rpc(maria, `select cancel_request($1)`, [id]);
    const [r] = await rpc<{ status: string }>(maria, `select status from help_requests where id=$1`, [id]);
    expect(r.status).toBe("CANCELLED");
    const [o] = await rpc<{ status: string }>(joao, `select status from help_request_offers where request_id=$1`, [id]);
    expect(o.status).toBe("EXPIRED");
  });

  it("ajudante desiste e o pedido volta a OPEN", async () => {
    const id = await createOpenRequest(db, maria, { title: "Montar uma estante" });
    const oid = (await rpc<{ submit_offer: string }>(joao, `select submit_offer($1, 'Monto sem problema')`, [id]))[0].submit_offer;
    await rpc(maria, `select accept_offer($1)`, [oid]);
    await rpc(joao, `select helper_withdraw($1)`, [id]);
    const [r] = await rpc<{ status: string; selected_helper_id: string | null }>(maria, `select status, selected_helper_id from help_requests where id=$1`, [id]);
    expect(r.status).toBe("OPEN");
    expect(r.selected_helper_id).toBeNull();
  });

  it("disputa: TIVE UM PROBLEMA → DISPUTED; admin resolve com auditoria", async () => {
    const id = await createOpenRequest(db, maria, { title: "Buscar documento no cartório" });
    const oid = (await rpc<{ submit_offer: string }>(joao, `select submit_offer($1, 'Vou buscar hoje')`, [id]))[0].submit_offer;
    await rpc(maria, `select accept_offer($1)`, [oid]);
    await rpc(joao, `select confirm_start($1)`, [id]);
    await rpc(maria, `select confirm_start($1)`, [id]);
    const [d] = await rpc<{ report_problem: string }>(maria, `select report_problem($1, 'Não compareceu', 'O ajudante não apareceu no horário combinado.')`, [id]);

    const [st] = await rpc<{ status: string }>(maria, `select status from help_requests where id=$1`, [id]);
    expect(st.status).toBe("DISPUTED");
    // admin foi notificado
    expect(await rpc(admin, `select 1 from notifications where type='DISPUTE_OPENED'`)).not.toHaveLength(0);

    await expect(rpc(maria, `select admin_resolve_dispute($1, 'RESOLVED', 'ok', 'CANCELLED')`, [d.report_problem])).rejects.toThrow(/FORBIDDEN/);
    await rpc(admin, `select admin_resolve_dispute($1, 'RESOLVED', 'Pedido cancelado', 'CANCELLED')`, [d.report_problem]);
    const [after] = await rpc<{ status: string }>(maria, `select status from help_requests where id=$1`, [id]);
    expect(after.status).toBe("CANCELLED");
    const logs = await rpc<{ action: string }>(admin, `select action from audit_logs where action like 'dispute.%'`);
    expect(logs).toHaveLength(1);
  });

  it("expira pedidos cujo horário passou", async () => {
    const id = await createOpenRequest(db, maria, { title: "Pedido que vai expirar" });
    await db.query(`update help_requests set scheduled_date = current_date - 3 where id = $1`, [id]);
    const res = await db.query<{ expire_requests: number }>(`select expire_requests()`);
    expect(res.rows[0].expire_requests).toBeGreaterThanOrEqual(1);
    const r = await db.query<{ status: string }>(`select status from help_requests where id=$1`, [id]);
    expect(r.rows[0].status).toBe("EXPIRED");
  });

  it("não publica pedido com data no passado", async () => {
    const cat = (await db.query<{ id: string }>(`select id from categories where slug='casa'`)).rows[0].id;
    await expect(
      asUser(db, maria, async () => {
        const ins = await db.query<{ id: string }>(
          `insert into help_requests (requester_id, category_id, title, description, state, city, scheduled_date, scheduled_time)
           values ($1,$2,'Pedido no passado','Descrição de teste ok','RJ','Niterói', current_date - 1, '10:00') returning id`,
          [maria, cat]);
        await db.query(`select publish_request($1)`, [ins.rows[0].id]);
      }),
    ).rejects.toThrow(/DATE_IN_PAST/);
  });
});
