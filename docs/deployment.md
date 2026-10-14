# Deploy

## Supabase
1. Crie o projeto em supabase.com (ou `supabase start` localmente — requer Docker).
2. `supabase link --project-ref <ref>` e `supabase db push` (aplica `supabase/migrations`).
3. Para demo local: `supabase db reset` (aplica seed.sql). **Nunca rodar seed em produção.**
4. Auth → URL de site e redirects: `https://seu-dominio/auth/callback`.
5. Realtime: habilitado para `messages` e `notifications` pela migration.

## Variáveis de ambiente
Ver `.env.example`. No Vercel: configure todas em Production e Preview. `SUPABASE_SERVICE_ROLE_KEY` e `VAPID_PRIVATE_KEY` só no servidor.

## Vercel
Conecte o repositório GitHub; framework Next.js; `npm run build`. Service Worker em `/sw.js` é servido com `Cache-Control: no-cache` (ver `next.config.ts`).

## VAPID
`npm run vapid:generate` imprime o par de chaves. Copie para `.env.local`/Vercel. `VAPID_SUBJECT` = `mailto:contato@seudominio` ou URL https.
