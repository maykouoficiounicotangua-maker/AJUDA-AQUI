import { expect, test } from "@playwright/test";

const VIEWPORTS = [320, 375, 390, 430, 768, 1024, 1280, 1440];

test.describe("páginas públicas", () => {
  test("landing explicativa: CTAs sem login, demonstração animada, como funciona e FAQ", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AJUDA AQUI — Pessoas ajudando pessoas\./);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("mãozinha");
    // os CTAs levam direto ao app, sem exigir cadastro
    await expect(page.getByRole("link", { name: /Pedir ajuda agora/ })).toHaveAttribute("href", "/pedido/novo");
    await expect(page.getByRole("link", { name: /Ver quem precisa de ajuda/ })).toHaveAttribute("href", "/explorar");
    // demonstração animada com 4 etapas navegáveis
    const steps = page.getByRole("tablist", { name: "Etapas da demonstração" }).getByRole("tab");
    await expect(steps).toHaveCount(4);
    await steps.nth(2).click();
    await expect(page.getByText("3. Eles combinam tudo pelo chat do app")).toBeVisible();
    // como funciona: alterna entre pedir e ajudar
    await page.getByRole("tab", { name: /Quero ajudar/ }).click();
    await expect(page.getByRole("heading", { name: "Veja pedidos perto de você" })).toBeVisible();
    // FAQ
    await page.getByText("Preciso me cadastrar para ver os pedidos?").click();
    await expect(page.getByText(/O cadastro só é pedido quando você quiser/)).toBeVisible();
  });

  test("visitante navega sem login: pedidos e criação de pedido abrem direto", async ({ page }) => {
    await page.goto("/explorar");
    await expect(page).toHaveURL(/\/explorar/);
    await expect(page.getByRole("heading", { name: "Pedidos de ajuda" })).toBeVisible();
    await expect(page.getByText(/só nessa hora pedimos seu cadastro/)).toBeVisible();
    await page.goto("/pedido/novo");
    await expect(page.getByRole("heading", { name: "Do que você precisa?" })).toBeVisible();
    // área pessoal continua protegida e volta para onde ia depois do login
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/entrar\?next=%2Finicio/);
  });

  test("visitante preenche o pedido inteiro e só na publicação é levado ao cadastro, com o pedido salvo", async ({ page }) => {
    await page.goto("/pedido/novo");
    await page.getByRole("radio").first().click();
    await page.getByLabel(/Título do pedido/).fill("Pedido de visitante para teste");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel(/Descreva o que precisa/).fill("Descrição feita antes de criar a conta.");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel(/^Data/).fill("2099-05-10");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Estado").selectOption("RJ");
    await page.getByRole("combobox", { name: /^Cidade/ }).fill("Niterói");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click(); // gratuita
    await expect(page.getByText(/Para publicar, você cria sua conta grátis/)).toBeVisible();
    await page.getByRole("button", { name: /Publicar pedido \(criar conta\)/ }).click();
    await expect(page).toHaveURL(/\/cadastrar\?next=%2Fpedido%2Fnovo/);
    await expect(page.getByText(/Seu pedido está salvo neste aparelho/)).toBeVisible();
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("aa:request-wizard") ?? "{}"));
    expect(draft.title).toBe("Pedido de visitante para teste");
  });

  test("página offline existe para o Service Worker", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "Você está sem internet" })).toBeVisible();
  });

  test("segurança: orientações e aviso de responsabilidade", async ({ page }) => {
    await page.goto("/seguranca");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Segurança no Ajuda Aqui");
    for (const t of ["Não compartilhe senhas", "Evite locais isolados", "Avise alguém de confiança", "Denuncie situações inadequadas"]) {
      await expect(page.getByRole("heading", { name: t })).toBeVisible();
    }
    await expect(page.getByText("não substitui o seu julgamento pessoal de segurança")).toBeVisible();
  });

  test("termos e privacidade carregam", async ({ page }) => {
    await page.goto("/termos");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Termos de Uso");
    await page.goto("/privacidade");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de Privacidade");
    await expect(page.getByText(/nunca são públicos/)).toBeVisible();
  });

  test("cadastro: validação no cliente mostra erros claros e exige aceite dos termos", async ({ page }) => {
    await page.goto("/cadastrar");
    await page.getByRole("button", { name: "Criar minha conta" }).click();
    await expect(page.getByText("Informe um e-mail válido")).toBeVisible();
    await expect(page.getByText("Você precisa aceitar os termos para continuar")).toBeVisible();
    await page.getByLabel(/^Senha/).fill("somenteletras");
    await page.getByLabel(/^Senha/).blur();
    await expect(page.getByText("Use letras e números na senha")).toBeVisible();
  });

  test("login: campos obrigatórios", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe um e-mail válido")).toBeVisible();
    await expect(page.getByText("Informe sua senha")).toBeVisible();
    await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toBeVisible();
  });

  test("formulários de credenciais nunca usam GET (senha não pode ir para a URL)", async ({ page }) => {
    for (const path of ["/entrar", "/cadastrar", "/recuperar-senha"]) {
      await page.goto(path);
      const methods = await page.locator("form").evaluateAll((fs) => fs.map((f) => (f as HTMLFormElement).method));
      expect(methods.length, path).toBeGreaterThan(0);
      for (const m of methods) expect(m, path).toBe("post");
    }
  });

  test("recuperar senha é acessível", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  });

  test("rota inexistente mostra 404 amigável", async ({ page }) => {
    const res = await page.goto("/nao-existe-mesmo");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });
});

test.describe("PWA, SEO e segurança de borda", () => {
  test("manifest válido com ícones", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({ short_name: "Ajuda Aqui", display: "standalone", lang: "pt-BR", id: "/", start_url: "/?origem=app" });
    expect(m.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBe(true);
    // capturas para o diálogo de instalação "rico" (Android/Chrome)
    expect(m.screenshots.some((x: { form_factor: string }) => x.form_factor === "narrow")).toBe(true);
    for (const shot of m.screenshots) expect((await request.get(shot.src)).ok()).toBe(true);
  });

  test("service worker servido sem cache, com tipo JavaScript e sem segredos", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("javascript");
    expect(res.headers()["cache-control"]).toContain("no-cache");
    const body = await res.text();
    expect(body).toContain('addEventListener("push"');
    expect(body).toContain("notificationclick");
    expect(body).not.toMatch(/VAPID_PRIVATE|PRIVATE_KEY/);
  });

  test("robots: só institucional indexável; áreas privadas bloqueadas", async ({ request }) => {
    const txt = await (await request.get("/robots.txt")).text();
    for (const p of ["/admin", "/pedido", "/usuario", "/conversa", "/api/"]) expect(txt).toContain(`Disallow: ${p}`);
    expect(txt).toContain("Allow: /seguranca");
  });

  test("cabeçalhos de segurança presentes", async ({ request }) => {
    const h = (await request.get("/")).headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["strict-transport-security"]).toBeTruthy();
  });

  test("rotas de push e de jobs exigem autenticação / segredo", async ({ request }) => {
    expect((await request.get("/api/push/status")).status()).toBe(401);
    expect((await request.post("/api/push/subscribe", { data: {} })).status()).toBe(401);
    expect((await request.post("/api/push/unsubscribe", { data: {} })).status()).toBe(401);
    expect((await request.get("/api/push/dispatch")).status()).toBe(401);
    expect((await request.get("/api/cron/expire")).status()).toBe(401);
    expect((await request.get("/api/cron/expire", { headers: { authorization: "Bearer errado" } })).status()).toBe(401);
  });

  test("nenhuma chave privada vaza no HTML das páginas públicas", async ({ request }) => {
    for (const p of ["/", "/entrar", "/cadastrar", "/seguranca"]) {
      const html = await (await request.get(p)).text();
      expect(html).not.toMatch(/VAPID_PRIVATE_KEY|SERVICE_ROLE|service_role/i);
    }
  });
});

test.describe("responsividade: sem rolagem horizontal", () => {
  for (const width of VIEWPORTS) {
    test(`${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/", "/entrar", "/cadastrar", "/seguranca"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} em ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("acessibilidade básica", () => {
  test("campos do cadastro têm rótulos associados", async ({ page }) => {
    await page.goto("/cadastrar");
    for (const label of ["Nome completo", "E-mail", "Telefone", "Estado", "Cidade"]) {
      await expect(page.getByLabel(new RegExp(label)).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Criar minha conta" })).toBeVisible();
  });

  test("link 'pular para o conteúdo' recebe foco por teclado", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  });
});
