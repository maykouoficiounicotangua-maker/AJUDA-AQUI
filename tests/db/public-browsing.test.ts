import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createOpenRequest, createUser, type Db } from "./harness";

let db: Db;
let owner: string;
let reqId: string;

const anon = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  asUser(db, null, async () => (await db.query<T>(sql, params)).rows);

beforeAll(async () => {
  db = await createDb();
  owner = await createUser(db, "Rosa Maria Pereira");
  reqId = await createOpenRequest(db, owner, { title: "Pedido visível para visitantes" });
  await asUser(db, owner, () => db.query(`insert into help_request_private (request_id, address) values ($1, 'Rua Secreta 7')`, [reqId]));
});

describe("navegação sem login (migration 0008)", () => {
  it("visitante vê o feed público com dados mínimos (só o primeiro nome)", async () => {
    const rows = await anon<{ id: string; requester_first_name: string }>(`select * from public_feed()`);
    const r = rows.find((x) => x.id === reqId)!;
    expect(r).toBeTruthy();
    expect(r.requester_first_name).toBe("Rosa");
    expect(Object.keys(r)).not.toEqual(expect.arrayContaining(["requester_id", "public_latitude", "address"]));
  });

  it("detalhe público não expõe endereço nem sobrenome", async () => {
    const [r] = await anon<Record<string, unknown>>(`select * from public_request($1)`, [reqId]);
    expect(r.title).toBe("Pedido visível para visitantes");
    expect(JSON.stringify(r)).not.toMatch(/Secreta|Pereira|requester_id/);
  });

  it("perfil privado aparece como 'Membro'; pedidos vencidos, rascunhos e de suspensos não aparecem", async () => {
    await db.query(`update profiles set profile_visibility = 'PRIVATE' where id = $1`, [owner]);
    expect((await anon<{ requester_first_name: string }>(`select * from public_request($1)`, [reqId]))[0].requester_first_name).toBe("Membro");
    await db.query(`update profiles set profile_visibility = 'PUBLIC' where id = $1`, [owner]);

    const vencido = await createOpenRequest(db, owner, { title: "Pedido que já passou do horário" });
    await db.query(`update help_requests set scheduled_date = current_date - 1 where id = $1`, [vencido]);
    expect(await anon(`select * from public_request($1)`, [vencido])).toHaveLength(0);

    await db.query(`update profiles set status = 'SUSPENDED' where id = $1`, [owner]);
    expect(await anon(`select * from public_request($1)`, [reqId])).toHaveLength(0);
    expect((await anon<{ id: string }>(`select id from public_feed()`)).map((r) => r.id)).not.toContain(reqId);
    await db.query(`update profiles set status = 'ACTIVE' where id = $1`, [owner]);
  });

  it("as tabelas continuam fechadas para visitantes", async () => {
    await expect(anon(`select 1 from help_requests`)).rejects.toThrow(/permission denied/i);
    await expect(anon(`select 1 from help_request_private`)).rejects.toThrow(/permission denied/i);
    await expect(anon(`select * from search_requests()`)).rejects.toThrow(/permission denied/i);
  });

  it("usuário pode escolher o alcance dos avisos; valor inválido é recusado", async () => {
    await asUser(db, owner, () => db.query(`update notification_preferences set match_scope = 'NEARBY' where user_id = $1`, [owner]));
    const r = await db.query<{ match_scope: string }>(`select match_scope from notification_preferences where user_id = $1`, [owner]);
    expect(r.rows[0].match_scope).toBe("NEARBY");
    await expect(asUser(db, owner, () => db.query(`update notification_preferences set match_scope = 'TUDO' where user_id = $1`, [owner]))).rejects.toThrow(/check/i);
  });
});

describe("helper_candidates (quem recebe aviso de novo pedido)", () => {
  it("inclui quem está na cidade com avisos ligados; exclui desligados, bloqueados, outra cidade e o próprio solicitante", async () => {
    const dona = await createUser(db, "Dona Aviso");
    const perto = await createUser(db, "Perto Ligado");
    const desligado = await createUser(db, "Perto Desligado");
    const bloqueado = await createUser(db, "Perto Bloqueado");
    const longe = await createUser(db, "Longe Ajudante", { city: "Curitiba", state: "PR" });
    const prefs = (u: string, city = "Niterói", state = "RJ", lat = -22.88, lng = -43.1) =>
      db.query(`insert into helper_preferences (user_id, state, city, latitude, longitude) values ($1,$2,$3,$4,$5)`, [u, state, city, lat, lng]);
    for (const u of [dona, perto, desligado, bloqueado]) await prefs(u);
    await prefs(longe, "Curitiba", "PR", -25.43, -49.27);
    await db.query(`update notification_preferences set pref_matches = false where user_id = $1`, [desligado]);
    await db.query(`update notification_preferences set match_scope = 'NEARBY' where user_id = $1`, [perto]);
    await db.query(`insert into blocks (blocker_id, blocked_id) values ($1, $2)`, [bloqueado, dona]);

    const req = await createOpenRequest(db, dona, { title: "Pedido para avisar vizinhos" });
    const rows = (await db.query<{ user_id: string; match_scope: string }>(`select user_id, match_scope from helper_candidates($1)`, [req])).rows;
    const ids = rows.map((r) => r.user_id);
    expect(ids).toContain(perto);
    expect(rows.find((r) => r.user_id === perto)?.match_scope).toBe("NEARBY");
    for (const u of [dona, desligado, bloqueado, longe]) expect(ids).not.toContain(u);
  });

  it("só o servidor (service role) chama a função", async () => {
    const u = await createUser(db, "Curioso Candidatos");
    await expect(asUser(db, u, () => db.query(`select * from helper_candidates(gen_random_uuid())`))).rejects.toThrow(/permission denied/i);
  });
});
