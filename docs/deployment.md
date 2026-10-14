# Deploy

Produção atual: **https://ajuda-aqui.vercel.app** (Vercel) + Supabase hospedado.

## 1. Variáveis no Vercel (Settings → Environment Variables → Production e Preview)
| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://ajuda-aqui.vercel.app` (sem barra no final; se ausente, o app usa o domínio de produção do Vercel) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | do Supabase (**só servidor**) |
| `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | mesma chave pública do `.env.local` |
| `VAPID_PRIVATE_KEY` | do `.env.local` (**só servidor**) |
| `VAPID_SUBJECT` | `mailto:<seu e-mail de contato>` |
| `CRON_SECRET` | do `.env.local` (o Vercel Cron envia `Authorization: Bearer $CRON_SECRET`) |

Depois de salvar, faça **Redeploy**: variáveis `NEXT_PUBLIC_*` são embutidas no build.

## 2. Supabase
### Migrations
Aplique todas as de `supabase/migrations/` em ordem (CLI: `supabase link --project-ref <ref>` + `supabase db push`, ou cole cada arquivo no SQL Editor). A `…0007_improvements.sql` é independente: o app funciona sem ela, mas sem os lembretes e o filtro de pedidos vencidos no feed.

### E-mail (IMPORTANTE)
O SMTP padrão do Supabase envia **~2 e-mails por hora para o projeto inteiro**: cadastros e recuperações de senha além disso falham (`email rate limit exceeded`). Configure um SMTP próprio em *Authentication → Emails → SMTP Settings* (ex.: Resend, Brevo, Amazon SES) e aumente o limite em *Authentication → Rate Limits*.

### URLs de autenticação
*Authentication → URL Configuration*:
- **Site URL**: `https://ajuda-aqui.vercel.app`
- **Redirect URLs**: `https://ajuda-aqui.vercel.app/auth/callback`, `https://ajuda-aqui.vercel.app/auth/confirm`, `http://localhost:3000/**`

### Templates de e-mail (recomendado — funciona em qualquer aparelho)
O link padrão (PKCE) só funciona no MESMO navegador em que a pessoa se cadastrou. Troque em *Authentication → Emails → Templates*:
- **Confirm signup**: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/boas-vindas">Confirmar meu e-mail</a>`
- **Reset password**: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha">Criar nova senha</a>`

Traduza assunto e corpo para português.

### Primeiro administrador
No SQL Editor: `update public.profiles set role = 'ADMIN' where id = (select id from auth.users where email = 'seu@email');`

## 3. Jobs (vercel.json)
`/api/cron/expire` (diário): expira pedidos vencidos, envia lembretes "ajuda próxima" e entrega pushes pendentes. `/api/push/dispatch` (diário, fallback). Pushes de eventos são entregues na hora, após cada ação. No plano Pro, aumente a frequência (ex.: a cada hora).

## 4. Verificação pós-deploy
```bash
E2E_BASE_URL=https://ajuda-aqui.vercel.app npx playwright test tests/e2e/public.spec.ts
E2E_FULL=1 E2E_BASE_URL=https://ajuda-aqui.vercel.app npx playwright test tests/e2e/flows.spec.ts --workers=1
```
O segundo cria usuários temporários (`*@ajudaaqui.test`, sem enviar e-mail) e apaga tudo no final.
