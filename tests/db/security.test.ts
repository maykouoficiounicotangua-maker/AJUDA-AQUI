import { beforeAll, describe, expect, it } from "vitest";
import { asUser, categoryId, createDb, createOpenRequest, createUser, type Db } from "./harness";

let db: Db;
let a: string; // Usuário A (atacante)
let b: string; // Usuário B (vítima)
let helper: string;
let admin: string;
let reqB: string;
let draftB: string;
let offerId: string;
let convId: string;

const q = <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
  asUser(db, user, async () => (await db.query<T>(sql, params)).rows);

beforeAll(async () => {
  db = await createDb();
  a = await createUser(db, "Usuario A", { phone: "+55 21 91111-1111" });
  b = await createUser(db, "Usuario B", { phone: "+55 21 92222-2222" });
  helper = await createUser(db, "Ajudante H", { phone: "+55 21 93333-3333" });
  admin = await createUser(db, "Admin", { role: "ADMIN" });

  reqB = await createOpenRequest(db, b, { title: "Pedido privado do B" });
  const cat = await categoryId(db, "casa");
  draftB = (await q<{ id: string }>(b,
    `insert into help_requests (requester_id, category_id, title, description, state, city, scheduled_date, scheduled_time)
     values ($1,$2,'Rascunho secreto do B','Rascunho de teste ok','RJ','Niterói', current_date + 3, '10:00') returning id`,
    [b, cat]))[0].id;

  offerId = (await q<{ submit_offer: string }>(helper, `select submit_offer($1, 'Posso ajudar com isso')`, [reqB]))[0].submit_offer;
  convId = (await q<{ accept_offer: string }>(b, `select accept_offer($1)`, [offerId]))[0].accept_offer;
  await q(b, `insert into messages (conversation_id, sender_id, content) values ($1,$2,'Segredo entre B e H')`, [convId, b]);
  await q(b, `insert into help_request_private (request_id, address) values ($1,'Rua Privada 99')`, [reqB]);
});

describe("Usuário A NÃO consegue…", () => {
  it("editar o pedido de B", async () => {
    const rows = await q(a, `update help_requests set title = 'HACKEADO por A' where id = $1 returning id`, [reqB]);
    expect(rows).toHaveLength(0);
    const [t] = await q<{ title: string }>(b, `select title from help_requests where id=$1`, [reqB]);
    expect(t.title).toBe("Pedido privado do B");
  });

  it("apagar o pedido de B", async () => {
    expect(await q(a, `delete from help_requests where id=$1 returning id`, [draftB])).toHaveLength(0);
  });

  it("ver o rascunho de B", async () => {
    expect(await q(a, `select 1 from help_requests where id=$1`, [draftB])).toHaveLength(0);
  });

  it("ver conversa e mensagens de B", async () => {
    expect(await q(a, `select 1 from conversations where id=$1`, [convId])).toHaveLength(0);
    expect(await q(a, `select 1 from messages where conversation_id=$1`, [convId])).toHaveLength(0);
  });

  it("escrever na conversa de B", async () => {
    await expect(
      q(a, `insert into messages (conversation_id, sender_id, content) values ($1,$2,'invadindo')`, [convId, a]),
    ).rejects.toThrow();
  });

  it("falsificar mensagem em nome de outro", async () => {
    await expect(
      q(a, `insert into messages (conversation_id, sender_id, content) values ($1,$2,'sou o B')`, [convId, b]),
    ).rejects.toThrow();
  });

  it("ver proposta privada de B (feita ao pedido de B)", async () => {
    expect(await q(a, `select 1 from help_request_offers where id=$1`, [offerId])).toHaveLength(0);
  });

  it("editar o perfil de B", async () => {
    expect(await q(a, `update profiles set full_name='Hackeado' where id=$1 returning id`, [b])).toHaveLength(0);
  });

  it("virar admin ou mudar o próprio status/role (colunas protegidas)", async () => {
    await expect(q(a, `update profiles set role='ADMIN' where id=$1`, [a])).rejects.toThrow(/permission denied/i);
    await expect(q(a, `update profiles set status='ACTIVE' where id=$1`, [a])).rejects.toThrow(/permission denied/i);
  });

  it("acessar recursos admin (RPCs, auditoria, denúncias de terceiros)", async () => {
    await expect(q(a, `select admin_dashboard_stats()`)).rejects.toThrow(/FORBIDDEN/);
    await expect(q(a, `select admin_set_user_status($1,'BLOCKED')`, [b])).rejects.toThrow(/FORBIDDEN/);
    expect(await q(a, `select 1 from audit_logs`)).toHaveLength(0);
    await expect(q(a, `update categories set active=false`)).resolves.toHaveLength(0);
  });

  it("alterar reputação (reviews)", async () => {
    await expect(
      q(a, `insert into reviews (request_id, reviewer_id, reviewee_id, rating) values ($1,$2,$3,1)`, [reqB, a, b]),
    ).rejects.toThrow(/permission denied/i);
    await expect(q(a, `select submit_review($1, 1)`, [reqB])).rejects.toThrow();
  });

  it("acessar endereço privado sem autorização", async () => {
    expect(await q(a, `select address from help_request_private where request_id=$1`, [reqB])).toHaveLength(0);
    expect(await q(helper, `select address from help_request_private where request_id=$1`, [reqB])).toHaveLength(0); // ajudante ainda não confirmou
    expect(await q(admin, `select address from help_request_private where request_id=$1`, [reqB])).toHaveLength(0);
    expect(await q(b, `select address from help_request_private where request_id=$1`, [reqB])).toHaveLength(1);
  });

  it("manipular status arbitrariamente", async () => {
    await expect(q(b, `update help_requests set status='COMPLETED' where id=$1`, [reqB])).rejects.toThrow(/permission denied/i);
    await expect(q(b, `update help_requests set selected_helper_id=$2 where id=$1`, [reqB, a])).rejects.toThrow(/permission denied/i);
    await expect(q(a, `select confirm_start($1)`, [reqB])).rejects.toThrow(/NOT_FOUND/);
    await expect(q(a, `select cancel_request($1)`, [reqB])).rejects.toThrow(/NOT_FOUND/);
    await expect(q(a, `select mark_done($1)`, [reqB])).rejects.toThrow(/NOT_FOUND/);
  });

  it("criar pedido em nome de outro ou já publicado", async () => {
    const cat = await categoryId(db, "casa");
    await expect(
      q(a, `insert into help_requests (requester_id, category_id, title, description, state, city, scheduled_date, scheduled_time)
            values ($1,$2,'Em nome do B','Descrição de teste ok','RJ','Niterói', current_date+2,'10:00')`, [b, cat]),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      q(a, `insert into help_requests (requester_id, category_id, title, description, state, city, scheduled_date, scheduled_time, status)
            values ($1,$2,'Já publicado','Descrição de teste ok','RJ','Niterói', current_date+2,'10:00','OPEN')`, [a, cat]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("criar notificações, auditoria ou forjar analytics", async () => {
    await expect(q(a, `insert into notifications (user_id, type, title, body) values ($1,'SYSTEM_ALERT','x','y')`, [b])).rejects.toThrow(/permission denied/i);
    await expect(q(a, `select create_notification($1,'SYSTEM_ALERT','x','y')`, [b])).rejects.toThrow(/permission denied/i);
    await expect(q(a, `select write_audit('x','y','z',null,null)`)).rejects.toThrow(/permission denied/i);
    await expect(q(a, `insert into analytics_events (user_id, event) values ($1,'REQUEST_COMPLETED')`, [a])).rejects.toThrow(/row-level security/i);
  });

  it("ler a tabela de rate limit", async () => {
    await expect(q(a, `select * from rate_limit_events`)).rejects.toThrow(/permission denied/i);
  });
});

describe("privacidade de dados pessoais", () => {
  it("telefone é privado; só a contraparte de uma ajuda ativa enxerga", async () => {
    expect(await q(a, `select phone from profile_contacts where user_id=$1`, [b])).toHaveLength(0);
    expect(await q(a, `select phone from profile_contacts where user_id=$1`, [a])).toHaveLength(1);
    // B e o ajudante selecionado (ajuda ASSIGNED) veem o telefone um do outro
    expect(await q(b, `select phone from profile_contacts where user_id=$1`, [helper])).toHaveLength(1);
    expect(await q(helper, `select phone from profile_contacts where user_id=$1`, [b])).toHaveLength(1);
  });

  it("perfil PRIVATE some para quem não tem relação, mas continua visível a quem se relaciona", async () => {
    await q(b, `update profiles set profile_visibility='PRIVATE' where id=$1`, [b]);
    expect(await q(a, `select 1 from profiles where id=$1`, [b])).toHaveLength(0);
    expect(await q(helper, `select 1 from profiles where id=$1`, [b])).toHaveLength(1);
    await q(b, `update profiles set profile_visibility='PUBLIC' where id=$1`, [b]);
  });

  it("anônimo não vê pedidos, perfis nem notificações", async () => {
    await expect(q(null, `select 1 from help_requests`)).rejects.toThrow(/permission denied/i);
    await expect(q(null, `select 1 from profiles`)).rejects.toThrow(/permission denied/i);
  });

  it("push_subscriptions: cada um só vê as suas; mesmo endpoint migra de dono", async () => {
    const ep = "https://push.example.com/endpoint-" + "x".repeat(30);
    await q(a, `select upsert_push_subscription($1, $2, $3)`, [ep, "p".repeat(20), "a".repeat(20)]);
    expect(await q(a, `select 1 from push_subscriptions`)).toHaveLength(1);
    expect(await q(b, `select 1 from push_subscriptions`)).toHaveLength(0);
    await q(b, `select upsert_push_subscription($1, $2, $3)`, [ep, "p".repeat(20), "a".repeat(20)]);
    expect(await q(a, `select 1 from push_subscriptions`)).toHaveLength(0);
    expect(await q(b, `select 1 from push_subscriptions`)).toHaveLength(1);
    expect(await q(a, `delete from push_subscriptions returning id`)).toHaveLength(0);
  });

  it("notificações: cada um só vê as suas", async () => {
    expect((await q(b, `select 1 from notifications`)).length).toBeGreaterThan(0);
    const mine = await q<{ user_id: string }>(a, `select user_id from notifications`);
    expect(mine.every((n) => n.user_id === a)).toBe(true);
  });
});

describe("bloqueios", () => {
  let reqOpen: string;
  beforeAll(async () => {
    reqOpen = await createOpenRequest(db, b, { title: "Pedido para teste de bloqueio" });
  });

  it("A bloqueia B: A deixa de ver pedidos de B e não pode propor", async () => {
    await q(a, `insert into blocks (blocker_id, blocked_id) values ($1,$2)`, [a, b]);
    expect(await q(a, `select 1 from help_requests where id=$1`, [reqOpen])).toHaveLength(0);
    await expect(q(a, `select submit_offer($1, 'Quero ajudar mesmo assim')`, [reqOpen])).rejects.toThrow();
  });

  it("B (bloqueado por A) também não vê/propõe nos pedidos de A, nem envia proposta", async () => {
    const reqA = await createOpenRequest(db, a, { title: "Pedido do usuário A" });
    expect(await q(b, `select 1 from help_requests where id=$1`, [reqA])).toHaveLength(0);
    await expect(q(b, `select submit_offer($1, 'Quero ajudar o A')`, [reqA])).rejects.toThrow();
  });

  it("bloqueio é único e não pode bloquear a si mesmo", async () => {
    await expect(q(a, `insert into blocks (blocker_id, blocked_id) values ($1,$2)`, [a, b])).rejects.toThrow(/duplicate|unique/i);
    await expect(q(a, `insert into blocks (blocker_id, blocked_id) values ($1,$1)`, [a])).rejects.toThrow();
  });

  it("mensagens entre bloqueados são impedidas mesmo com conversa aberta", async () => {
    await q(helper, `insert into blocks (blocker_id, blocked_id) values ($1,$2)`, [helper, b]);
    await expect(
      q(b, `insert into messages (conversation_id, sender_id, content) values ($1,$2,'oi')`, [convId, b]),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      q(helper, `insert into messages (conversation_id, sender_id, content) values ($1,$2,'oi')`, [convId, helper]),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe("denúncias", () => {
  it("denúncia chega ao admin, é privada ao denunciante e gera auditoria ao resolver", async () => {
    const rid = (await q<{ submit_report: string }>(a,
      `select submit_report($1, 'HARASSMENT', 'Me enviou mensagens agressivas várias vezes.')`, [b]))[0].submit_report;
    expect(await q(admin, `select 1 from notifications where type='REPORT_CREATED'`)).not.toHaveLength(0);
    expect(await q(a, `select 1 from reports`)).toHaveLength(1);
    expect(await q(b, `select 1 from reports`)).toHaveLength(0);
    expect(await q(helper, `select 1 from reports`)).toHaveLength(0);

    await expect(q(a, `select admin_resolve_report($1,'RESOLVED','ok')`, [rid])).rejects.toThrow(/FORBIDDEN/);
    await q(admin, `select admin_resolve_report($1,'RESOLVED','Usuário advertido', true)`, [rid]);

    const [p] = await q<{ status: string }>(admin, `select status from profiles where id=$1`, [b]);
    expect(p.status).toBe("SUSPENDED");
    const logs = await q<{ action: string }>(admin, `select action from audit_logs order by created_at`);
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["user.status_changed", "report.resolved"]));
    expect((await q(a, `select 1 from notifications where type='REPORT_UPDATED'`))).toHaveLength(1);
  });

  it("usuário suspenso não consegue usar funcionalidades restritas", async () => {
    await expect(q(b, `select submit_offer($1, 'Estou suspenso mas tento')`, [reqB])).rejects.toThrow();
    await expect(q(b, `select publish_request($1)`, [draftB])).rejects.toThrow(/ACCOUNT_RESTRICTED/);
    await expect(q(b, `update profiles set bio='x' where id=$1 returning id`, [b])).resolves.toHaveLength(0);
  });

  it("não é possível denunciar a si mesmo; admin não pode ser suspenso por outro fluxo", async () => {
    await expect(q(a, `select submit_report($1,'OTHER','Denúncia contra mim mesmo...')`, [a])).rejects.toThrow(/INVALID_INPUT/);
    await expect(q(admin, `select admin_set_user_status($1,'BLOCKED')`, [admin])).rejects.toThrow(/INVALID_INPUT/);
  });
});

describe("categorias (admin)", () => {
  it("admin cria categoria com auditoria; usuário comum não", async () => {
    await expect(
      q(a, `insert into categories (name, slug) values ('Hack','hack')`),
    ).rejects.toThrow(/row-level security/i);
    await q(admin, `insert into categories (name, slug, icon) values ('Jardinagem','jardinagem','Flower')`);
    const logs = await q(admin, `select 1 from audit_logs where action='category.insert'`);
    expect(logs).toHaveLength(1);
    await q(admin, `update categories set active=false where slug='jardinagem'`);
    expect(await q(a, `select 1 from categories where slug='jardinagem'`)).toHaveLength(0); // inativa some
  });
});

describe("rate limiting", () => {
  it("limita criação excessiva de propostas", async () => {
    const u = await createUser(db, "Spammer");
    let blocked = false;
    for (let i = 0; i < 22 && !blocked; i++) {
      const owner = await createUser(db, `Dono Pedido ${i}`); // um dono por pedido evita o limite de publicação
      const id = await createOpenRequest(db, owner, { title: `Pedido número ${i} para spam` });
      try {
        await q(u, `select submit_offer($1, 'Proposta repetitiva')`, [id]);
      } catch (e) {
        expect(String(e)).toMatch(/RATE_LIMITED/);
        blocked = true;
      }
    }
    expect(blocked).toBe(true);
  });
});

describe("exclusão de conta (LGPD)", () => {
  it("apagar um usuário com mensagens, pedidos e propostas funciona (sem violar constraints)", async () => {
    const owner = await createUser(db, "Dono Exclusão");
    const gone = await createUser(db, "Vai Sair");
    const req = await createOpenRequest(db, owner, { title: "Pedido para teste de exclusão" });
    const offer = (await q<{ submit_offer: string }>(gone, `select submit_offer($1, 'Posso ajudar com isso')`, [req]))[0].submit_offer;
    const conv = (await q<{ accept_offer: string }>(owner, `select accept_offer($1)`, [offer]))[0].accept_offer;
    await q(gone, `insert into messages (conversation_id, sender_id, content) values ($1,$2,'Mensagem do usuário que vai sair')`, [conv, gone]);

    await db.query(`delete from auth.users where id = $1`, [gone]);

    expect(await db.query(`select 1 from profiles where id = $1`, [gone])).toHaveProperty("rows", []);
    const msgs = await db.query<{ sender_id: string | null }>(`select sender_id from messages where conversation_id = $1 and message_type = 'TEXT'`, [conv]);
    expect(msgs.rows.every((m) => m.sender_id === null)).toBe(true); // histórico anonimizado, não apagado
    const [r] = (await db.query<{ selected_helper_id: string | null }>(`select selected_helper_id from help_requests where id = $1`, [req])).rows;
    expect(r.selected_helper_id).toBeNull();
  });
});
