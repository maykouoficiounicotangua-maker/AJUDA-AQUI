import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// E2E_BASE_URL aponta para um ambiente já publicado (ex.: Vercel) e dispensa o servidor local
const REMOTE = process.env.E2E_BASE_URL;

/**
 * E2E. Duas camadas:
 *  - public.spec.ts  → roda SEM Supabase (páginas públicas, PWA, headers, responsividade).
 *  - flows.spec.ts   → exige Supabase local com seed (E2E_FULL=1). Ver docs/testing.md.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: REMOTE ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: REMOTE ? undefined : {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
