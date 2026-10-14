/** Acesso centralizado às variáveis de ambiente. Nada aqui é lido no cliente além de NEXT_PUBLIC_*. */

/**
 * URL pública: NEXT_PUBLIC_SITE_URL → domínio de produção do Vercel → URL do deploy → localhost.
 * Sempre sem barra final (evita "//sitemap.xml").
 */
function resolveSiteUrl(): string {
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelDeploy = process.env.VERCEL_URL;
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (vercelProd ? `https://${vercelProd}` : "") ||
    (vercelDeploy ? `https://${vercelDeploy}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export const publicEnv = {
  siteUrl: resolveSiteUrl(),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/** Somente servidor. */
export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? publicEnv.vapidPublicKey,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    vapidSubject: process.env.VAPID_SUBJECT ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

export function isPushConfigured(): boolean {
  const e = serverEnv();
  return Boolean(e.vapidPublicKey && e.vapidPrivateKey && e.vapidSubject);
}
