/**
 * Provisionamento de dados de teste para E2E contra um Supabase REAL (local ou hospedado).
 * Cria usuários temporários pela API admin (sem enviar e-mails) e remove TUDO no final.
 * Todos os e-mails usam o domínio reservado `.test` (RFC 2606): nunca entregáveis.
 */
import { readFileSync, existsSync } from "node:fs";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

const env = loadEnv();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const liveConfigured = Boolean(SUPABASE_URL && SERVICE);

const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

async function call<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export const RUN = `e2e${Date.now().toString(36)}`;
export const PASSWORD = "E2e-Senha-12345";
export const emailFor = (name: string) => `${RUN}.${name}@ajudaaqui.test`;

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

const created: TestUser[] = [];

export async function createUser(
  name: string,
  full: string,
  opts: { role?: "ADMIN"; city?: string; neighborhood?: string; categories?: string[] } = {},
): Promise<TestUser> {
  const email = emailFor(name);
  const user = await call<{ id: string }>("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: full, phone: "+55 21 98888-0000", state: "RJ", city: opts.city ?? "Niterói", neighborhood: opts.neighborhood ?? "Icaraí",
        terms_version: "2026-10-14", privacy_version: "2026-10-14", safety_version: "2026-10-14",
      },
    }),
  });
  const u = { id: user.id, email, name: full };
  created.push(u);
  await call(`/rest/v1/profiles?id=eq.${u.id}`, {
    method: "PATCH",
    body: JSON.stringify({ onboarding_completed: true, ...(opts.role ? { role: opts.role } : {}) }),
  });
  if (opts.categories?.length) {
    const cats = await call<{ id: string; slug: string }[]>(`/rest/v1/categories?select=id,slug&slug=in.(${opts.categories.join(",")})`);
    await call("/rest/v1/user_categories", { method: "POST", body: JSON.stringify(cats.map((c) => ({ user_id: u.id, category_id: c.id }))) });
    await call("/rest/v1/helper_preferences", {
      method: "POST",
      body: JSON.stringify({ user_id: u.id, state: "RJ", city: opts.city ?? "Niterói", neighborhood: opts.neighborhood ?? "Icaraí", latitude: -22.88, longitude: -43.1 }),
    });
  }
  return u;
}

/** Pedido aberto criado direto no banco (service role), para cenários que não testam o wizard. */
export async function createOpenRequest(owner: TestUser, title: string): Promise<string> {
  const [cat] = await call<{ id: string }[]>("/rest/v1/categories?select=id&slug=eq.compras");
  const d = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const [row] = await call<{ id: string }[]>("/rest/v1/help_requests", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      requester_id: owner.id, category_id: cat.id, title, description: "Pedido criado pelo teste automatizado.",
      help_type: "FREE", state: "RJ", city: "Niterói", neighborhood: "Icaraí", public_latitude: -22.88, public_longitude: -43.1,
      scheduled_date: d, scheduled_time: "10:00", status: "OPEN", published_at: new Date().toISOString(),
    }),
  });
  return row.id;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const res = await call<{ users: { id: string; email: string }[] }>("/auth/v1/admin/users?per_page=1000");
  return res.users.find((u) => u.email === email)?.id ?? null;
}

export async function confirmEmail(userId: string) {
  await call(`/auth/v1/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ email_confirm: true }) });
}

export async function authSettings(): Promise<{ mailer_autoconfirm: boolean }> {
  return call("/auth/v1/settings");
}

/** Remove tudo que o teste criou: rastros que não cascateiam (auditoria, analytics, rate limit) e os usuários. */
export async function cleanup(extraEmails: string[] = []) {
  const ids = [...created.map((u) => u.id)];
  for (const e of extraEmails) {
    const id = await findUserIdByEmail(e);
    if (id) ids.push(id);
  }
  if (!ids.length) return;
  const list = `(${ids.join(",")})`;
  await call(`/rest/v1/audit_logs?admin_id=in.${list}`, { method: "DELETE" }).catch(() => undefined);
  await call(`/rest/v1/audit_logs?entity_id=in.${list}`, { method: "DELETE" }).catch(() => undefined);
  await call(`/rest/v1/analytics_events?user_id=in.${list}`, { method: "DELETE" }).catch(() => undefined);
  await call(`/rest/v1/rate_limit_events?user_id=in.${list}`, { method: "DELETE" }).catch(() => undefined);
  for (const id of ids) await call(`/auth/v1/admin/users/${id}`, { method: "DELETE" }).catch(() => undefined);
  created.length = 0;
}

/** Lê dados com service role (para asserções que a UI não mostra). */
export const adminSelect = <T = unknown>(path: string) => call<T>(`/rest/v1/${path}`);
