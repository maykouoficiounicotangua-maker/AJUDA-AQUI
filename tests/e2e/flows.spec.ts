/**
 * E2E dos fluxos completos (itens 87–92 do prompt mestre) contra um Supabase REAL.
 *
 * Os dados são autoprovisionados (usuários temporários via API admin, sem e-mail) e REMOVIDOS no final,
 * então pode rodar contra o projeto hospedado:
 *   E2E_FULL=1 E2E_BASE_URL=https://ajuda-aqui.vercel.app npx playwright test tests/e2e/flows.spec.ts
 * ou localmente (sem E2E_BASE_URL o Playwright sobe `next start` com o .env.local).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import * as live from "./support/live";

test.skip(!process.env.E2E_FULL || !live.liveConfigured, "Defina E2E_FULL=1 e as chaves do Supabase (.env.local)");

let maria: live.TestUser;
let joao: live.TestUser;
let carlos: live.TestUser;
let admin: live.TestUser;
let carlosRequest: string;
const signupEmail = live.emailFor("cadastro");

test.beforeAll(async () => {
  maria = await live.createUser("maria", "Maria Teste");
  joao = await live.createUser("joao", "João Teste", { categories: ["entregas", "tecnologia"], neighborhood: "Centro" });
  carlos = await live.createUser("carlos", "Carlos Teste", { city: "Niterói" });
  admin = await live.createUser("admin", "Admin Teste", { role: "ADMIN" });
  carlosRequest = await live.createOpenRequest(carlos, `Pedido do Carlos ${live.RUN}`);
});

test.afterAll(async () => {
  await live.cleanup([signupEmail]);
});

async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(live.PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/inicio/, { timeout: 20_000 });
}

async function session(browser: Browser, user: live.TestUser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user.email);
  return { context, page };
}

/** Acesso negado: o app responde a página "não encontrada" (com loading.tsx o Next transmite 200 + noindex). */
async function expectNotFound(page: Page, url: string, mustNotContain?: string) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  if (mustNotContain) await expect(page.getByText(mustNotContain)).toHaveCount(0);
}

const futureDate = () => new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);

test.describe("cadastro, login e logout", () => {
  test("cadastro pela interface → (confirmação) → onboarding → início → sair", async ({ page }) => {
    const settings = await live.authSettings();
    // Com confirmação de e-mail ligada, cadastrar pela UI enviaria um e-mail REAL e gastaria a cota do SMTP.
    test.skip(!settings.mailer_autoconfirm, "Confirmação de e-mail ligada: o cadastro é coberto pela API admin e pelos testes de formulário");
    await page.goto("/cadastrar");
    await page.getByLabel("Nome completo").fill("Cadastro Teste Silva");
    await page.getByLabel("E-mail").fill(signupEmail);
    await page.getByLabel(/Telefone/).fill("(21) 99999-0000");
    await page.getByLabel(/^Senha/).fill(live.PASSWORD);
    await page.getByLabel("Estado").selectOption("RJ");
    await page.getByRole("combobox", { name: /^Cidade/ }).fill("Niterói");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar minha conta" }).click();

    if (!settings.mailer_autoconfirm) {
      // Produção com confirmação de e-mail: a UI orienta e o teste confirma pela API admin.
      await expect(page.getByText("Quase lá!")).toBeVisible({ timeout: 20_000 });
      const id = await live.findUserIdByEmail(signupEmail);
      expect(id, "usuário criado pelo cadastro").toBeTruthy();
      // consentimento versionado gravado no cadastro
      const consents = await live.adminSelect<unknown[]>(`consents?user_id=eq.${id}&select=terms_version`);
      expect(consents).toHaveLength(1);
      await live.confirmEmail(id!);
      await login(page, signupEmail).catch(() => undefined);
      await page.goto("/boas-vindas");
    }
    await expect(page.getByRole("heading", { name: /Bem-vindo ao Ajuda Aqui/ })).toBeVisible({ timeout: 20_000 });
    for (const t of ["Precisa de ajuda?", "Quer ajudar?", "Ajude com segurança"]) {
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByRole("heading", { name: t })).toBeVisible();
    }
    await page.getByRole("button", { name: "COMEÇAR" }).click();
    await expect(page).toHaveURL(/\/inicio/);
    await expect(page.getByText("O que você precisa hoje?")).toBeVisible();

    await page.goto("/boas-vindas");
    await expect(page).toHaveURL(/\/inicio/); // onboarding não reaparece

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar/);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("senha errada mostra mensagem genérica", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(maria.email);
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });
});

test.describe("fluxo principal: Maria pede, João ajuda", () => {
  test.describe.configure({ mode: "serial" });
  let requestPath = "";
  const title = `Buscar uma encomenda ${live.RUN}`;

  test("Maria cria e publica um pedido remunerado (R$ 20)", async ({ browser }) => {
    const { context, page } = await session(browser, maria);
    await page.getByRole("link", { name: /PRECISO DE AJUDA/ }).click();
    await expect(page).toHaveURL(/pedido\/novo/);
    await page.getByRole("radio", { name: /Entregas/ }).click();
    await page.getByLabel(/Título do pedido/).fill(title);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel(/Descreva o que precisa/).fill("Preciso buscar uma encomenda no fim da tarde.");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel(/^Data/).fill(futureDate());
    await page.getByLabel(/^Horário/).fill("18:00");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel(/Endereço \(privado\)/).fill("Rua Teste Privada, 99");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("radio", { name: /Remunerada/ }).click();
    await page.getByLabel(/Valor oferecido/).fill("20");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Etapa 6 de 7")).toBeVisible();
    await page.getByRole("button", { name: "Publicar pedido" }).click();

    await expect(page.getByRole("heading", { name: "Pedido publicado com sucesso!" })).toBeVisible({ timeout: 20_000 });
    // matching encontrou João (categoria Entregas, mesma cidade)
    await expect(page.getByText(/Encontramos \d+ pessoas? que pode/)).toBeVisible();
    await page.getByRole("link", { name: "Ver meu pedido" }).click();
    await page.waitForURL(/\/pedido\/[0-9a-f-]{36}$/);
    requestPath = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await context.close();

    const [req] = await live.adminSelect<{ amount_cents: number; status: string }[]>(`help_requests?select=amount_cents,status&id=eq.${requestPath.split("/").pop()}`);
    expect(req).toMatchObject({ amount_cents: 2000, status: "OPEN" });
  });

  test("João recebe a notificação de pedido compatível, vê o pedido e envia proposta", async ({ browser }) => {
    const { context, page } = await session(browser, joao);
    await page.goto("/notificacoes");
    await expect(page.getByText("Nova oportunidade de ajuda").first()).toBeVisible();

    await page.goto("/explorar?estado=all");
    await page.getByLabel("Buscar pedidos").fill(title);
    await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByText(/compatibilidade/).first()).toBeVisible();
    await expect(page.getByText("Rua Teste Privada")).toHaveCount(0); // endereço privado nunca aparece antes da confirmação

    await page.getByRole("button", { name: /TENHO INTERESSE/ }).click();
    await page.getByLabel(/Conte rapidamente/).fill("Posso realizar essa tarefa hoje às 18h.");
    await page.getByRole("button", { name: "Enviar proposta" }).click();
    await expect(page.getByText("Proposta enviada — aguardando resposta")).toBeVisible();
    await context.close();
  });

  test("Maria vê a notificação, o perfil do João e o aceita", async ({ browser }) => {
    const { context, page } = await session(browser, maria);
    await page.goto("/notificacoes");
    await expect(page.getByText("Nova proposta").first()).toBeVisible();
    await page.goto(requestPath);
    await expect(page.getByRole("heading", { name: /Interessados/ })).toBeVisible();
    await page.getByRole("link", { name: /João Teste/ }).first().click();
    await expect(page.getByRole("heading", { name: "João Teste" })).toBeVisible();
    await page.goBack();
    await page.getByRole("button", { name: /Aceitar João/ }).click();
    await expect(page).toHaveURL(/\/conversa\//, { timeout: 20_000 });
    await expect(page.getByText(/foi selecionado\(a\) para realizar esta ajuda/)).toBeVisible();
    await context.close();
  });

  test("chat em tempo real e confirmação de leitura", async ({ browser }) => {
    const m = await session(browser, maria);
    const j = await session(browser, joao);
    await j.page.goto("/mensagens");
    await j.page.getByRole("link", { name: /Maria Teste/ }).first().click();
    await m.page.goto("/mensagens");
    await m.page.getByRole("link", { name: /João Teste/ }).first().click();
    await expect(m.page.getByRole("log")).toBeVisible();
    await j.page.waitForTimeout(1500); // inscrição do Realtime

    await m.page.getByLabel("Digite sua mensagem").fill("Oi João, combinado às 18h!");
    await m.page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(j.page.getByText("Oi João, combinado às 18h!")).toBeVisible({ timeout: 15_000 });
    await j.page.getByLabel("Digite sua mensagem").fill("Fechado!");
    await j.page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(m.page.getByText("Fechado!")).toBeVisible({ timeout: 15_000 });
    await expect(m.page.getByLabel("Lida").first()).toBeVisible({ timeout: 15_000 });
    await m.context.close();
    await j.context.close();
  });

  test("confirmação dos dois, conclusão, avaliações e reputação", async ({ browser }) => {
    const m = await session(browser, maria);
    const j = await session(browser, joao);

    await j.page.goto(requestPath);
    await j.page.getByRole("button", { name: "Confirmar e começar" }).click();
    await expect(j.page.getByText("Aguardando confirmação").first()).toBeVisible({ timeout: 15_000 });
    await j.page.reload();
    await expect(j.page.getByText("Rua Teste Privada, 99")).toBeVisible(); // liberado após o ajudante confirmar

    await m.page.goto(requestPath);
    await m.page.getByRole("button", { name: "Confirmar e começar" }).click();
    await expect(m.page.getByText("Em andamento").first()).toBeVisible({ timeout: 15_000 });

    await m.page.getByRole("button", { name: "AJUDA CONCLUÍDA" }).click();
    await expect(m.page.getByText("Conclusão pendente").first()).toBeVisible({ timeout: 15_000 });
    await j.page.reload();
    await j.page.getByRole("button", { name: "AJUDA CONCLUÍDA" }).click();
    await expect(j.page.getByText("Concluído").first()).toBeVisible({ timeout: 15_000 });

    for (const p of [m.page, j.page]) {
      await p.reload();
      await p.getByRole("radiogroup", { name: "Avaliação geral" }).getByRole("radio", { name: "5 estrelas" }).click();
      await p.getByRole("button", { name: "Enviar avaliação" }).click();
      await expect(p.getByText(/Você já avaliou esta ajuda/)).toBeVisible({ timeout: 15_000 });
    }

    await j.page.goto("/perfil");
    await expect(j.page.getByText("Ajudas realizadas")).toBeVisible();
    await j.page.goto("/minhas-ajudas?grupo=concluidas");
    await expect(j.page.getByText(title)).toBeVisible();
    await m.page.goto("/meus-pedidos?grupo=completed");
    await expect(m.page.getByText(title)).toBeVisible();
    await m.context.close();
    await j.context.close();
  });
  test("segurança: Carlos não abre conversa, edição de pedido nem admin", async ({ browser }) => {
    const m = await session(browser, maria);
    await m.page.goto("/mensagens");
    const conv = await m.page.getByRole("link", { name: /João Teste/ }).first().getAttribute("href");
    await m.context.close();
    const [req] = await live.adminSelect<{ id: string }[]>(`help_requests?select=id&requester_id=eq.${maria.id}&limit=1`);

    const c = await session(browser, carlos);
    await expectNotFound(c.page, conv!, "Oi João, combinado às 18h!");
    await expectNotFound(c.page, `/pedido/${req.id}/editar`);
    await expectNotFound(c.page, "/admin", "Usuários ativos");
    await expectNotFound(c.page, "/admin/usuarios");
    await c.context.close();
  });
});

test.describe("bloqueio e denúncia", () => {
  test("Carlos bloqueia João: o pedido e o perfil do Carlos somem para o João", async ({ browser }) => {
    const c = await session(browser, carlos);
    const j = await session(browser, joao);
    await j.page.goto(`/pedido/${carlosRequest}`);
    await expect(j.page.getByRole("heading", { name: `Pedido do Carlos ${live.RUN}` })).toBeVisible();

    await c.page.goto(`/usuario/${joao.id}`);
    await c.page.getByRole("button", { name: "Bloquear" }).click();
    await c.page.getByRole("button", { name: "Sim, bloquear" }).click();
    await expect(c.page.getByRole("button", { name: "Desbloquear" })).toBeVisible({ timeout: 15_000 });

    await expectNotFound(j.page, `/pedido/${carlosRequest}`, `Pedido do Carlos ${live.RUN}`);
    await expectNotFound(j.page, `/usuario/${carlos.id}`, "Carlos Teste");

    await c.page.goto("/configuracoes");
    await expect(c.page.getByText("João Teste")).toBeVisible(); // lista de bloqueados mostra o nome
    await c.page.getByRole("button", { name: "Desbloquear" }).click();
    await expect(c.page.getByText("Você não bloqueou ninguém.")).toBeVisible({ timeout: 15_000 });
    await c.context.close();
    await j.context.close();
  });

  test("denúncia → admin notificado → resolve → auditoria", async ({ browser }) => {
    const m = await session(browser, maria);
    await m.page.goto(`/usuario/${carlos.id}`);
    await m.page.getByRole("button", { name: "Denunciar" }).click();
    await m.page.getByLabel("Motivo").selectOption("FALSE_INFORMATION");
    await m.page.getByLabel("O que aconteceu?").fill("Teste automatizado de denúncia — pode ignorar.");
    await m.page.getByRole("button", { name: "Enviar denúncia" }).click();
    await expect(m.page.getByText("Denúncia enviada. Nossa equipe vai analisar.")).toBeVisible({ timeout: 15_000 });
    await m.context.close();

    const a = await session(browser, admin);
    await a.page.goto("/notificacoes");
    await expect(a.page.getByText("Nova denúncia").first()).toBeVisible();
    await a.page.goto("/admin/denuncias");
    const card = a.page.locator("li", { hasText: "Teste automatizado de denúncia" });
    await card.getByLabel("Notas da análise").fill("Teste E2E.");
    await card.getByRole("button", { name: "Resolver" }).click();
    await expect(a.page.getByText("Denúncia atualizada.")).toBeVisible({ timeout: 15_000 });
    await a.page.goto("/admin/auditoria");
    await expect(a.page.getByText("report.resolved").first()).toBeVisible();
    await a.context.close();
  });
});

test.describe("admin", () => {
  test("indicadores; suspender e reativar usuário com auditoria", async ({ browser }) => {
    const a = await session(browser, admin);
    await a.page.goto("/admin");
    await expect(a.page.getByText("Usuários ativos")).toBeVisible();
    await a.page.goto(`/admin/usuarios?q=${encodeURIComponent("Carlos Teste")}`);
    const row = a.page.locator("li", { hasText: "Carlos Teste" });
    await row.getByRole("button", { name: "Suspender" }).click();
    await expect(a.page.getByText("Usuário suspenso.")).toBeVisible({ timeout: 15_000 });

    // usuário suspenso vê o aviso e não consegue publicar
    const c = await session(browser, carlos);
    await expect(c.page.getByText("Sua conta está com restrições").first()).toBeVisible();
    await c.context.close();

    await row.getByRole("button", { name: "Reativar" }).click();
    await expect(a.page.getByText("Usuário reativado.")).toBeVisible({ timeout: 15_000 });
    await a.page.goto("/admin/auditoria");
    await expect(a.page.getByText("user.status_changed").first()).toBeVisible();
    await a.context.close();
  });
});
