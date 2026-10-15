// Verificação REAL do Web Push: Chrome assina no serviço de push do Google (FCM), o servidor do Ajuda Aqui
// envia com as chaves VAPID e o Service Worker recebe. Usa usuários temporários e apaga tudo no final.
// Uso: npx tsx scripts/push-e2e.mts <baseUrl> [chrome|msedge]
import { chromium } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as live from "../tests/e2e/support/live";

const base = process.argv[2] ?? "http://localhost:3100";
const channel = process.argv[3] ?? "chrome";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const receiver = await live.createUser("pushdest", "Destino Push");
const sender = await live.createUser("pushorig", "Origem Push", { categories: ["compras"] });
// Perfil PERSISTENTE (não anônimo): o Chrome desliga a Push API em janelas anônimas.
const profileDir = mkdtempSync(join(tmpdir(), "aa-push-"));
const browser = await chromium.launchPersistentContext(profileDir, { channel, headless: process.env.HEADED !== "1", args: process.env.HEADED === "1" ? [] : ["--headless=new"] });
let ok = false;
try {
  const ctx = browser;
  await ctx.grantPermissions(["notifications"], { origin: base });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log("[navegador]", m.text()));

  await page.goto(base + "/entrar");
  await page.getByLabel("E-mail").fill(receiver.email);
  await page.getByLabel("Senha").fill(live.PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/inicio/, { timeout: 30000 });

  // 1) Mesmo caminho do app: registra o SW, pega a chave pública no servidor, assina e envia ao /api/push/subscribe
  const sub = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const status = await (await fetch("/api/push/status")).json();
    if (!status.configured) return { error: "servidor sem VAPID" };
    const pad = "=".repeat((4 - (status.publicKey.length % 4)) % 4);
    const raw = atob((status.publicKey + pad).replace(/-/g, "+").replace(/_/g, "/"));
    const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    try {
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s.toJSON()) });
      return { endpointHost: new URL(s.endpoint).host, saved: res.status };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log("assinatura:", sub);
  if ("error" in sub) throw new Error(String(sub.error));

  // 2) Escuta o que o Service Worker recebe (mensagem quando a aba está em foco, ou notificação exibida)
  await page.evaluate(() => {
    (window as unknown as { __push: unknown[] }).__push = [];
    navigator.serviceWorker.addEventListener("message", (e) => (window as unknown as { __push: unknown[] }).__push.push(e.data));
  });

  // 3) Evento real: o "Origem" envia uma proposta para um pedido do "Destino" (RPC como usuário) …
  const reqId = await live.createOpenRequest(receiver, "Pedido para teste de push");
  const token = await (await fetch(`${live.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: sender.email, password: live.PASSWORD }),
  })).json();
  const offer = await fetch(`${live.SUPABASE_URL}/rest/v1/rpc/submit_offer`, {
    method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_request_id: reqId, p_message: "Posso ajudar sim!" }),
  });
  console.log("proposta criada:", offer.status);

  // … e o servidor do Ajuda Aqui processa a fila de push (mesma rotina do after() e do cron)
  const dispatch = await fetch(base + "/api/push/dispatch", { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
  console.log("dispatch:", dispatch.status, await dispatch.text());

  // 4) Confere no navegador
  for (let i = 0; i < 20 && !ok; i++) {
    await page.waitForTimeout(1000);
    const got = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const shown = (await reg.getNotifications()).map((n) => ({ title: n.title, body: n.body, url: (n.data as { url?: string })?.url }));
      return { messages: (window as unknown as { __push: unknown[] }).__push, shown };
    });
    if (got.messages.length || got.shown.length) {
      console.log("RECEBIDO PELO SERVICE WORKER:", JSON.stringify(got));
      ok = true;
    }
  }
  // 5) App FECHADO: nenhuma aba do Ajuda Aqui aberta → o SW precisa EXIBIR a notificação do sistema
  if (ok) {
    ok = false;
    // Instrumenta o Service Worker real: registra cada showNotification que o código do app fizer
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
    await sw.evaluate(() => {
      const g = self as unknown as { __shown: unknown[]; registration: ServiceWorkerRegistration };
      g.__shown = [];
      const orig = g.registration.showNotification.bind(g.registration);
      g.registration.showNotification = (title: string, opts?: NotificationOptions) => {
        g.__shown.push({ title, body: opts?.body, url: (opts?.data as { url?: string })?.url, icon: opts?.icon, badge: opts?.badge, tag: opts?.tag });
        return orig(title, opts);
      };
    });
    const keepAlive = await ctx.newPage(); // aba de outro site mantém o navegador aberto
    await keepAlive.goto("data:text/html,<title>outro site</title>");
    await page.close(); // fecha o Ajuda Aqui, como quem sai do app
    const svcHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
    await fetch(`${live.SUPABASE_URL}/rest/v1/rpc/create_notification`, {
      method: "POST", headers: svcHeaders,
      body: JSON.stringify({ p_user: receiver.id, p_type: "NEW_MESSAGE", p_title: "Nova mensagem", p_body: "Você recebeu uma mensagem de Origem.", p_url: "/mensagens" }),
    });
    const d2 = await fetch(base + "/api/push/dispatch", { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
    console.log("dispatch (app fechado):", d2.status, await d2.text());
    await keepAlive.waitForTimeout(5000);
    const shown = (await sw.evaluate(() => (self as unknown as { __shown: unknown[] }).__shown)) as { title: string; url?: string }[];
    console.log("NOTIFICAÇÕES EXIBIDAS NO SISTEMA:", JSON.stringify(shown));
    ok = shown.some((n) => n.title === "Nova mensagem" && n.url === "/mensagens");
  }

  const [row] = await live.adminSelect<{ push_status: string }[]>(`notifications?select=push_status&user_id=eq.${receiver.id}&type=eq.NEW_OFFER`);
  console.log("status no banco:", row?.push_status);
} finally {
  await browser.close();
  await live.cleanup();
}
console.log(ok ? "✅ PUSH FUNCIONANDO DE PONTA A PONTA" : "❌ push não chegou");
process.exit(ok ? 0 : 1);
