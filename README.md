# AJUDA AQUI — Pessoas ajudando pessoas.

Plataforma web (PWA) que conecta quem precisa de uma pequena ajuda com quem quer ajudar. Nasce local, mas é modelada para todo o Brasil (estado → cidade → bairro, coordenadas aproximadas e matching por distância).

> Não é rede social: sem feed, seguidores, curtidas ou ranking. Foco em confiança, segurança, localização e conclusão real das ajudas.

## Stack
Next.js 16 (App Router) · TypeScript · React 19 · Tailwind 4 · React Hook Form + Zod · Supabase (Postgres, Auth, RLS, Storage, Realtime) · Web Push (VAPID) · Vitest · Playwright · Vercel.

## Começando

```bash
npm install
cp .env.example .env.local      # preencha as variáveis (veja abaixo)
npm run dev                     # http://localhost:3000
```

Sem Supabase configurado o app abre as páginas públicas e mostra um aviso de configuração nas privadas.

### Supabase local (requer Docker + Supabase CLI)
```bash
supabase start                  # sobe Postgres/Auth/Realtime/Storage (usa supabase/config.toml)
supabase db reset               # aplica supabase/migrations/* e supabase/seed.sql (dados demo)
```
Copie `API URL` e `anon key` impressos para `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, e a `service_role key` para `SUPABASE_SERVICE_ROLE_KEY`.

**Usuários demo** (senha `Demo@12345`): `maria@`, `joao@`, `ana@`, `carlos@`, `beatriz@`, `diego@`, `fernanda@`, `gustavo@`, `helena@`, `igor@` e `admin@` + `demo.ajudaaqui.local`.
Resetar o seed = `supabase db reset` (ou rodar `supabase/seed.sql` de novo: ele apaga e recria os dados demo). **Nunca em produção.**

### Supabase hospedado
```bash
supabase link --project-ref <ref>
supabase db push                # só migrations; NÃO aplica o seed
```
Em *Authentication → URL Configuration* adicione `https://seu-dominio/auth/callback` aos redirects.

## Variáveis de ambiente
Todas documentadas em [.env.example](.env.example).

| Variável | Onde | Observação |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | cliente/servidor | URL pública do app |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente/servidor | protegidas pela RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | ignora RLS; usada p/ push e jobs |
| `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | servidor/cliente | chave pública |
| `VAPID_PRIVATE_KEY` | **só servidor** | nunca em `NEXT_PUBLIC_`, nunca em log |
| `VAPID_SUBJECT` | servidor | `mailto:contato@seudominio` ou URL https |
| `CRON_SECRET` | **só servidor** | protege `/api/push/dispatch` e `/api/cron/expire` |

### Notificações push (VAPID)
```bash
npm run vapid:generate          # imprime o par de chaves
```
Cole nas variáveis acima. Fluxo: a ação cria a notificação interna no banco → a fila `push_status = PENDING` é processada pelo servidor (`after()` após cada ação e por `/api/push/dispatch`) → Service Worker (`public/sw.js`) exibe e, no clique, abre a página certa. Falha de push **nunca** cancela a notificação interna. O convite para ativar só aparece na Home, e a permissão só é pedida após o clique em "Ativar notificações".

## Comandos
| Comando | O que faz |
|---|---|
| `npm run dev` | desenvolvimento |
| `npm run build` / `npm start` | produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | gera tipos de rota + `tsc --noEmit` |
| `npm test` | Vitest: unitários, componentes e **banco/RLS** (PGlite) |
| `npm run test:db` | somente testes de banco/RLS |
| `npm run test:e2e` | Playwright (públicos; fluxos completos com `E2E_FULL=1`) |
| `npm run vapid:generate` | chaves VAPID |

## Estrutura
```
app/            rotas: (public) (auth) (gate) (app) admin, api, actions
components/     ui, layout, auth, requests, offers, chat, profile, notifications, reviews, admin
lib/            supabase, auth, validations (Zod), matching, reputation, requests (máquina de estados),
                notifications, push, geo, security, utils
services/       único lugar que fala com o Supabase (por domínio)
supabase/       migrations/ (SQL versionado), seed.sql, config.toml
tests/          unit/ db/ (RLS e RPCs reais) e2e/
docs/           architecture, product, database, security, workflows, testing, deployment
```
Leia [CLAUDE.md](CLAUDE.md) antes de contribuir: ele define regras, convenções e o Definition of Done.

## Deploy (Vercel)
1. Importe o repositório no Vercel (framework Next.js, `npm run build`).
2. Configure as variáveis em *Production* e *Preview*.
3. `vercel.json` agenda `/api/cron/expire` e `/api/push/dispatch` (diários, compatível com o plano Hobby; aumente a frequência no Pro). O Vercel envia `Authorization: Bearer $CRON_SECRET`.
4. Detalhes em [docs/deployment.md](docs/deployment.md).

## Segurança em resumo
Autenticação (Supabase Auth) → autorização server-side → **RLS em todas as tabelas** → constraints. Endereço exato nunca é público; telefone só para a contraparte de uma ajuda ativa; escritas críticas via funções SQL transacionais; rate limiting no banco; auditoria de ações administrativas. Veja [docs/security.md](docs/security.md).
