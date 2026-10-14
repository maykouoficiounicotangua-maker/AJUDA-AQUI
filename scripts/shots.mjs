import { chromium } from "@playwright/test";
const out = process.argv[2];
const browser = await chromium.launch();
for (const [name, w, h] of [["m", 390, 844], ["d", 1280, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const [slug, path] of [["landing", "/"], ["entrar", "/entrar"], ["cadastrar", "/cadastrar"], ["seguranca", "/seguranca"]]) {
    await page.goto("http://localhost:3100" + path);
    await page.screenshot({ path: `${out}/${slug}-${name}.png`, fullPage: slug === "landing" });
  }
}
await browser.close();
