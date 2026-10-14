// Auditoria visual + acessibilidade (axe) das telas LOGADAS, com dados temporários no Supabase real.
// Uso: npx tsx scripts/visual-audit.mts <baseUrl> <pastaDeSaida>
import { chromium, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as live from "../tests/e2e/support/live";

const [base, out] = process.argv.slice(2);
const maria = await live.createUser("vmaria", "Maria Visual");
const joao = await live.createUser("vjoao", "João Visual", { categories: ["compras", "entregas"] });
const reqId = await live.createOpenRequest(maria, "Fazer compras no mercado do bairro");
await live.createOpenRequest(maria, "Ajuda para montar uma estante pequena");

const browser = await chromium.launch();
const issues: string[] = [];

async function login(page: Page, email: string) {
  await page.goto(base + "/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(live.PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/inicio/, { timeout: 30000 });
}

async function audit(page: Page, name: string, path: string) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
  const w = page.viewportSize()!.width;
  await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) issues.push(`[${w}px] ${path}: rolagem horizontal de ${overflow}px`);
  if (w === 390) {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    for (const v of r.violations) issues.push(`[axe] ${path}: ${v.id} (${v.impact}) — ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  }
}

try {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, locale: "pt-BR" });
    const j = await ctx.newPage();
    await login(j, joao.email);
    await audit(j, "inicio", "/inicio");
    await audit(j, "explorar", "/explorar");
    await audit(j, "pedido", `/pedido/${reqId}`);
    await audit(j, "novo", "/pedido/novo");
    await audit(j, "perfil", "/perfil");
    await audit(j, "editar", "/perfil/editar");
    await audit(j, "config", "/configuracoes");
    await audit(j, "mensagens", "/mensagens");
    await audit(j, "notificacoes", "/notificacoes");
    await ctx.close();
  }
  console.log(issues.length ? issues.join("\n") : "Sem problemas de acessibilidade (axe) nem rolagem horizontal.");
} finally {
  await browser.close();
  await live.cleanup();
}
