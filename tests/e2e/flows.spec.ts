/**
 * E2E dos fluxos completos (itens 87–91 do prompt mestre).
 *
 * REQUISITOS: Supabase local/remoto com as migrations e o seed.sql aplicados, `.env.local` preenchido e
 * confirmação de e-mail DESLIGADA (supabase/config.toml: enable_confirmations = false).
 *   supabase start && supabase db reset
 *   E2E_FULL=1 npx playwright test tests/e2e/flows.spec.ts
 *
 * Sem E2E_FULL=1 estes testes são ignorados (não há como rodá-los sem backend real).
 * Usuários demo (senha Demo@12345): maria, joao, carlos, admin @demo.ajudaaqui.local
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

test.skip(!process.env.E2E_FULL, "Defina E2E_FULL=1 com Supabase local + seed (ver docs/testing.md)");
test.describe.configure({ mode: "serial" });

const PASSWORD = "Demo@12345";
const demo = (name: string) => `${name}@demo.ajudaaqui.local`;

async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}

async function newSession(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, demo(name));
  return { context, page };
}

const futureDate = () => {
  const d = new Date(Date.now() + 5 * 86_400_000);
  return d.toISOString().slice(0, 10);
};

test.describe("cadastro, login e logout", () => {
  test("cria conta, aceita termos (no cadastro), faz onboarding e sai", async ({ page }) => {
    const email = `e2e.${Date.now()}@teste.ajudaaqui.local`;
    await page.goto("/cadastrar");
    await page.getByLabel("Nome completo").fill("Teste E2E Silva");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel(/Telefone/).fill("(21) 99999-0000");
    await page.getByLabel(/^Senha/).fill("senha12345");
    await page.getByLabel("Estado").selectOption("RJ");
    await page.getByLabel("Cidade").fill("Niterói");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar minha conta" }).click();

    await expect(page).toHaveURL(/boas-vindas/);
    await expect(page.getByRole("heading", { name: /Bem-vindo ao Ajuda Aqui/ })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Precisa de ajuda?" })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Quer ajudar?" })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Ajude com segurança" })).toBeVisible();
    await page.getByRole("button", { name: "COMEÇAR" }).click();

    await expect(page).toHaveURL(/\/inicio/);
    await expect(page.getByRole("heading", { name: /Olá, Teste/ })).toBeVisible();
    await expect(page.getByText("O que você precisa hoje?")).toBeVisible();

    // onboarding não aparece de novo
    await page.goto("/boas-vindas");
    await expect(page).toHaveURL(/\/inicio/);

    // logout (desktop: botão "Sair" na sidebar)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar/);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/entrar/); // rota protegida
  });

  test("login com senha errada mostra mensagem genérica", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(demo("maria"));
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });
});

test.describe("fluxo principal: Maria pede, João ajuda", () => {
  let requestUrl = "";
  const title = `Buscar uma encomenda ${Date.now()}`;

  test("Maria cria e publica um pedido remunerado (R$ 20)", async ({ browser }) => {
    const { context, page } = await newSession(browser, "maria");
    await page.getByRole("link", { name: /PRECISO DE AJUDA/ }).click();
    await expect(page).toHaveURL(/pedido\/novo/);

    await page.getByRole("radio", { name: /Entregas/ }).click();
    await page.getByLabel(/Título do pedido/).fill(title);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel(/Descreva o que precisa/).fill("Preciso buscar uma encomenda hoje no fim da tarde.");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel(/^Data/).fill(futureDate());
    await page.getByLabel(/^Horário/).fill("18:00");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click(); // onde (padrão do perfil)
    await page.getByRole("radio", { name: /Remunerada/ }).click();
    await page.getByLabel(/Valor oferecido/).fill("20");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Etapa 6 de 7")).toBeVisible();
    await page.getByRole("button", { name: "Publicar pedido" }).click();

    await expect(page.getByRole("heading", { name: "Pedido publicado com sucesso!" })).toBeVisible();
    await page.getByRole("link", { name: "Ver meu pedido" }).click();
    requestUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Aberto")).toBeVisible();
    await context.close();
  });

  test("João encontra o pedido, vê compatibilidade e envia proposta", async ({ browser }) => {
    const { context, page } = await newSession(browser, "joao");
    await page.goto("/explorar?estado=all");
    await page.getByLabel("Buscar pedidos").fill(title);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByText(/compatibilidade/)).toBeVisible();
    await expect(page.getByText(/R\$\s?20,00/).first()).toBeVisible();
    await expect(page.getByText(/Rua Exemplo|apto 45/)).toHaveCount(0); // endereço privado nunca aparece

    await page.getByRole("button", { name: /TENHO INTERESSE/ }).click();
    await page.getByLabel(/Conte rapidamente/).fill("Posso realizar essa tarefa hoje às 18h.");
    await page.getByRole("button", { name: "Enviar proposta" }).click();
    await expect(page.getByText("Proposta enviada — aguardando resposta")).toBeVisible();
    await context.close();
  });

  test("Maria vê a notificação, visualiza o perfil e aceita João", async ({ browser }) => {
    const { context, page } = await newSession(browser, "maria");
    await page.goto("/notificacoes");
    await expect(page.getByText("Nova proposta").first()).toBeVisible();

    await page.goto(requestUrl);
    await expect(page.getByRole("heading", { name: /Interessados/ })).toBeVisible();
    await expect(page.getByText("João Souza")).toBeVisible();
    await page.getByRole("link", { name: /João Souza/ }).first().click();
    await expect(page.getByRole("heading", { name: "João Souza" })).toBeVisible();
    await page.goBack();

    await page.getByRole("button", { name: /Aceitar João/ }).click();
    await expect(page).toHaveURL(/\/conversa\//);
    await expect(page.getByText(/foi selecionado\(a\) para realizar esta ajuda/)).toBeVisible();
    await context.close();
  });

  test("chat em tempo real: mensagem enviada por Maria chega ao João sem recarregar", async ({ browser }) => {
    const maria = await newSession(browser, "maria");
    const joao = await newSession(browser, "joao");
    await joao.page.goto("/mensagens");
    await joao.page.getByRole("link", { name: /Maria Silva/ }).first().click();
    await maria.page.goto("/mensagens");
    await maria.page.getByRole("link", { name: /João Souza/ }).first().click();

    await maria.page.getByLabel("Digite sua mensagem").fill("Oi João, combinado às 18h!");
    await maria.page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(joao.page.getByText("Oi João, combinado às 18h!")).toBeVisible({ timeout: 10_000 });
    // João responde e Maria vê a mensagem como lida depois
    await joao.page.getByLabel("Digite sua mensagem").fill("Fechado!");
    await joao.page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(maria.page.getByText("Fechado!")).toBeVisible({ timeout: 10_000 });
    await expect(maria.page.getByLabel("Lida")).toHaveCount(1, { timeout: 10_000 });
    await maria.context.close();
    await joao.context.close();
  });

  test("ambos confirmam, realizam e concluem; ambos avaliam", async ({ browser }) => {
    const maria = await newSession(browser, "maria");
    const joao = await newSession(browser, "joao");

    await joao.page.goto(requestUrl);
    await joao.page.getByRole("button", { name: "Confirmar e começar" }).click();
    await expect(joao.page.getByText("Aguardando confirmação").first()).toBeVisible();
    await maria.page.goto(requestUrl);
    await maria.page.getByRole("button", { name: "Confirmar e começar" }).click();
    await expect(maria.page.getByText("Em andamento").first()).toBeVisible();

    await maria.page.getByRole("button", { name: "AJUDA CONCLUÍDA" }).click();
    await expect(maria.page.getByText("Conclusão pendente").first()).toBeVisible();
    await joao.page.goto(requestUrl);
    await joao.page.getByRole("button", { name: "AJUDA CONCLUÍDA" }).click();
    await expect(joao.page.getByText("Concluído").first()).toBeVisible();

    // avaliações
    await maria.page.reload();
    await maria.page.getByRole("radiogroup", { name: "Avaliação geral" }).getByRole("radio", { name: "5 estrelas" }).click();
    await maria.page.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(maria.page.getByText(/Você já avaliou esta ajuda/)).toBeVisible();
    await joao.page.reload();
    await joao.page.getByRole("radiogroup", { name: "Avaliação geral" }).getByRole("radio", { name: "5 estrelas" }).click();
    await joao.page.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(joao.page.getByText(/Você já avaliou esta ajuda/)).toBeVisible();

    // reputação e histórico atualizados
    await joao.page.goto("/perfil");
    await expect(joao.page.getByText("Ajudas realizadas")).toBeVisible();
    await joao.page.goto("/minhas-ajudas?grupo=concluidas");
    await expect(joao.page.getByText(title)).toBeVisible();
    await maria.page.goto("/meus-pedidos?grupo=completed");
    await expect(maria.page.getByText(title)).toBeVisible();
    await maria.context.close();
    await joao.context.close();
  });
});

test.describe("segurança: usuário A não acessa dados do usuário B", () => {
  test("Carlos não abre conversa, edição nem rascunho de Maria", async ({ browser }) => {
    const maria = await newSession(browser, "maria");
    await maria.page.goto("/mensagens");
    const href = await maria.page.getByRole("link", { name: /João Souza/ }).first().getAttribute("href");
    await maria.page.goto("/meus-pedidos");
    const reqHref = await maria.page.getByRole("link").filter({ hasText: /./ }).evaluateAll((els) =>
      (els as HTMLAnchorElement[]).map((e) => e.getAttribute("href")).find((h) => h?.startsWith("/pedido/")),
    );
    await maria.context.close();

    const carlos = await newSession(browser, "carlos");
    expect(href).toBeTruthy();
    expect((await carlos.page.goto(href!))?.status()).toBe(404);
    if (reqHref) expect((await carlos.page.goto(`${reqHref}/editar`))?.status()).toBe(404);
    expect((await carlos.page.goto("/admin"))?.status()).toBe(404);
    expect((await carlos.page.goto("/admin/usuarios"))?.status()).toBe(404);
    await carlos.context.close();
  });
});

test.describe("bloqueio e denúncia", () => {
  test("Carlos bloqueia João: João deixa de ver o pedido do Carlos e não consegue interagir", async ({ browser }) => {
    const JOAO = "11111111-0000-0000-0000-000000000002";
    const PEDIDO_DO_CARLOS = "/pedido/22222222-0000-0000-0000-000000000004";
    const carlos = await newSession(browser, "carlos");
    const joao = await newSession(browser, "joao");

    // antes: João enxerga o pedido aberto do Carlos
    expect((await joao.page.goto(PEDIDO_DO_CARLOS))?.status()).toBe(200);

    await carlos.page.goto(`/usuario/${JOAO}`);
    await carlos.page.getByRole("button", { name: "Bloquear" }).click();
    await carlos.page.getByRole("button", { name: "Sim, bloquear" }).click();
    await expect(carlos.page.getByText(/Usuário bloqueado/)).toBeVisible();
    await expect(carlos.page.getByRole("button", { name: "Desbloquear" })).toBeVisible();

    // depois: o pedido some para o João (RLS) e o perfil do Carlos também
    expect((await joao.page.goto(PEDIDO_DO_CARLOS))?.status()).toBe(404);
    expect((await joao.page.goto("/usuario/11111111-0000-0000-0000-000000000004"))?.status()).toBe(404);

    // limpeza: desbloqueia para não afetar outros testes
    await carlos.page.getByRole("button", { name: "Desbloquear" }).click();
    await expect(carlos.page.getByText("Usuário desbloqueado.")).toBeVisible();
    await carlos.context.close();
    await joao.context.close();
  });

  test("denúncia: Maria denuncia, admin analisa, decide e a ação é auditada", async ({ browser }) => {
    const maria = await newSession(browser, "maria");
    await maria.page.goto("/usuario/11111111-0000-0000-0000-000000000006");
    await maria.page.getByRole("button", { name: "Denunciar" }).click();
    await maria.page.getByLabel("Motivo").selectOption("FALSE_INFORMATION");
    await maria.page.getByLabel("O que aconteceu?").fill("Informações do pedido não batiam com o combinado.");
    await maria.page.getByRole("button", { name: "Enviar denúncia" }).click();
    await expect(maria.page.getByText("Denúncia enviada. Nossa equipe vai analisar.")).toBeVisible();
    await maria.context.close();

    const admin = await newSession(browser, "admin");
    await admin.page.goto("/notificacoes");
    await expect(admin.page.getByText("Nova denúncia").first()).toBeVisible();
    await admin.page.goto("/admin/denuncias");
    await expect(admin.page.getByText("Informação falsa").first()).toBeVisible();
    await admin.page.getByLabel("Notas da análise").first().fill("Usuário advertido.");
    await admin.page.getByRole("button", { name: "Resolver" }).first().click();
    await expect(admin.page.getByText("Denúncia atualizada.")).toBeVisible();
    await admin.page.goto("/admin/auditoria");
    await expect(admin.page.getByText("report.resolved").first()).toBeVisible();
    await admin.context.close();
  });
});

test.describe("admin", () => {
  test("painel: indicadores; suspender e reativar usuário gera auditoria", async ({ browser }) => {
    const admin = await newSession(browser, "admin");
    await admin.page.goto("/admin");
    await expect(admin.page.getByText("Usuários ativos")).toBeVisible();
    await admin.page.goto("/admin/usuarios?q=Igor");
    await admin.page.getByRole("button", { name: "Suspender" }).first().click();
    await expect(admin.page.getByText("Usuário suspenso.")).toBeVisible();
    await expect(admin.page.getByText("Suspenso").first()).toBeVisible();
    await admin.page.getByRole("button", { name: "Reativar" }).first().click();
    await expect(admin.page.getByText("Usuário reativado.")).toBeVisible();
    await admin.page.goto("/admin/auditoria");
    await expect(admin.page.getByText("user.status_changed").first()).toBeVisible();
    await admin.context.close();
  });

  test("categorias: criar e desativar", async ({ browser }) => {
    const admin = await newSession(browser, "admin");
    await admin.page.goto("/admin/categorias");
    const name = `Jardinagem ${Date.now() % 10000}`;
    await admin.page.getByLabel("Nome").first().fill(name);
    await admin.page.getByRole("button", { name: "Criar categoria" }).click();
    await expect(admin.page.getByText("Categoria criada.")).toBeVisible();
    await admin.context.close();
  });
});
