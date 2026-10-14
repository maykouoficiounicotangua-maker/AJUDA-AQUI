// Sonda de configuração da produção: entra com usuário temporário, lê /api/push/status e apaga o usuário.
import { chromium } from "@playwright/test";
import * as live from "../tests/e2e/support/live";
const base = process.argv[2];
const u = await live.createUser("sonda", "Sonda Config");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base + "/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha").fill(live.PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/inicio/, { timeout: 30000 });
  const status = await page.evaluate(async () => (await fetch("/api/push/status")).json());
  console.log("push configurado no servidor:", status.configured, "| chave pública presente:", Boolean(status.publicKey));
  const html = await (await page.request.get(base + "/")).text();
  const og = html.match(/property="og:url" content="([^"]+)"/)?.[1] ?? html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  console.log("URL canônica/OG:", og);
} finally {
  await browser.close();
  await live.cleanup();
}
