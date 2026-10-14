# CLAUDE.md — AJUDA AQUI

> "Pessoas ajudando pessoas." Consulte este arquivo ANTES de alterar o projeto e atualize-o quando uma decisão arquitetural importante for tomada. Detalhes em [docs/](docs/).

## Visão
Plataforma que conecta quem precisa de uma pequena ajuda com quem quer ajudar. Fluxo: **PRECISO → ENCONTRO → REALIZAMOS → AVALIAMOS**. Não é rede social: sem feed, seguidores, curtidas, ranking público ou gamificação pesada. Foco: simplicidade, confiança, segurança, localização, matching.

## Stack
Next.js 16 (App Router, TypeScript, **`proxy.ts` no lugar de `middleware.ts`**) · React 19 · Tailwind v4 · Lucide · React Hook Form + Zod · Supabase (Postgres, Auth, RLS, Storage, Realtime) · Web Push (VAPID, lib `web-push`) · Vitest · Playwright · Vercel.
O `AGENTS.md` avisa que o Next 16 tem breaking changes: leia `node_modules/next/dist/docs/` antes de usar uma API que você não tenha certeza.

## Comandos
```
npm run dev          # desenvolvimento
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest (unit)
npm run test:e2e     # playwright
npm run build        # build de produção (deve passar sem erros)
npm run vapid:generate  # gera chaves VAPID
```
Banco: `supabase start`, `supabase db reset` (aplica migrations + seed.sql). Ver [docs/deployment.md](docs/deployment.md).

## Arquitetura (resumo)
```
app/            rotas (public)/(auth)/(app), admin, api
components/     UI por domínio (ui, layout, requests, chat, ...)
lib/            supabase/, auth/, permissions/, validations/, matching/, notifications/, push/, reputation/, security/, utils/
services/       acesso a dados por domínio (única camada que fala com Supabase)
supabase/       migrations/ (SQL versionado), seed.sql, tests/ (RLS)
tests/          unit/ integration/ e2e/
```
Fluxo obrigatório: `componente → service/server action → Supabase`. Componentes não chamam o Supabase diretamente.

## Regras de ouro
1. **Segurança vive no banco.** Camadas: Auth → Autorização server-side → RLS → constraints. `user.role === 'admin'` na UI é só cosmético.
2. **Uma regra, um lugar.** Máquina de estados do pedido, matching, reputação e permissões ficam em `lib/` (e espelhadas por funções SQL/trigger onde precisam ser atômicas). Nunca duplicar em componentes.
3. **Operações críticas são transacionais** via funções SQL `SECURITY DEFINER` (aceitar proposta, confirmar, concluir). Nunca meia operação.
4. **Localização privada nunca vira pública.** Endereço e coordenada exata ficam em `help_request_private`; o público vê só cidade/bairro/distância aproximada (`public_latitude/longitude` arredondadas).
5. **Dinheiro em centavos (`integer`)**, nunca float. Datas em UTC no banco.
6. **Sem mocks como fonte de dados.** Dados fictícios só em `supabase/seed.sql` e testes.
7. **Erros**: logar detalhe técnico no servidor; ao usuário, mensagem humana em português. Nunca expor erro de constraint.
8. **Um único tipo de usuário**: qualquer pessoa pede e ajuda. `role` é só `USER`/`ADMIN` (preparado para `MODERATOR`/`SUPER_ADMIN`).
9. **Matching nunca usa atributos sensíveis** (raça, religião, gênero, orientação, política). Reputação é só fator de confiança; sem ranking público.
10. **Segredos**: `VAPID_PRIVATE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` jamais com `NEXT_PUBLIC_`, jamais em log/cliente. `.env.local` nunca no Git.

## Convenções
- TypeScript estrito, sem `any`. Zod para toda entrada externa (formulário, action, route handler).
- Server Components por padrão; `"use client"` só quando necessário.
- UI mobile-first (320px→1440px), rótulos em português, acessível (labels, foco, aria, contraste).
- Toda tela relevante tem loading, empty, error e success.
- Nada de `SELECT *` sem necessidade; listas paginadas e filtradas no servidor.
- Enums do banco espelhados em `types/` e `lib/` (fonte única das constantes).

## Definition of Done (por funcionalidade)
UI · responsivo · validação (Zod) · tabela/relacionamentos · service · autorização server-side · RLS (testada positivo e negativo) · estados (loading/empty/erro/sucesso) · teste · documentação. Ao fim de cada fase: `lint` + `typecheck` + `test` + `build`.

## Estado atual
Ver [docs/architecture.md](docs/architecture.md) seção "Progresso e decisões" (inclui pendências). Verificação padrão: `npm run lint && npm run typecheck && npm test && npm run build`. Notas de ambiente:
- Máquina de desenvolvimento original: Windows, sem Docker/Supabase CLI → RLS e RPCs são testados com PGlite (`tests/db`), não com Supabase real.
- Sem acesso ao banco real, **não** declare uma tela autenticada "validada visualmente": só testes de componente cobrem isso.
- Não há instância Supabase configurada por padrão; sem `.env.local` o app mostra aviso de configuração em vez de quebrar.
- Prompt complementar de Push (VAPID) foi recebido truncado na seção 23 (integração matching↔push); seções 1–22 foram implementadas, a 23 segue o desenho natural `NotificationService.notify` chamado pelo matching.
