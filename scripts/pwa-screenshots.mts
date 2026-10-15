// Gera as capturas usadas no diálogo de instalação do PWA (manifest.screenshots).
// Uso: npx tsx scripts/pwa-screenshots.mts http://localhost:3100
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:3100";
const b = await chromium.launch();
const shots: [string, string, number, number][] = [
  ["mobile-1", "/", 390, 844],
  ["mobile-2", "/pedido/novo", 390, 844],
  ["desktop-1", "/", 1280, 800],
];
for (const [name, path, w, h] of shots) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.addInitScript(() => localStorage.setItem("aa:install-dismissed-at", String(Date.now())));
  await p.goto(base + path);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  await p.screenshot({ path: `public/screenshots/${name}.png` });
  console.log("ok", name);
}
await b.close();
