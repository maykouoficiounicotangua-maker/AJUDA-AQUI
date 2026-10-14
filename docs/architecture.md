# Arquitetura

## Camadas
```
UI (app/, components/)  →  Server Actions / Route Handlers  →  services/  →  Supabase (RLS)  →  Postgres (constraints, funções RPC)
                                   ↘ lib/ (validations, permissions, matching, reputation, state machine)
```
- **Segurança**: Auth (Supabase) → autorização server-side (`lib/auth`) → RLS → constraints/triggers.
- **Escrita crítica** passa por funções SQL transacionais (RPC) para evitar estados inconsistentes e corridas.
- **Leitura** usa o cliente do usuário (RLS aplicada). O `service_role` só é usado em código de servidor para: envio de push, notificações para terceiros e seed — nunca exposto ao cliente.

## Decisões (ADR curtas)
| # | Decisão | Motivo |
|---|---------|--------|
| 1 | `proxy.ts` em vez de `middleware.ts` | Convenção do Next 16 |
| 2 | Usuário único (sem tipo solicitante/ajudante) | Requisito de produto |
| 3 | Dinheiro em centavos (`amount_cents integer`) | Evitar float |
| 4 | Endereço/coordenada exata em tabela separada `help_request_private`, liberada por RLS só ao dono e ao ajudante selecionado | Privacidade; RLS é por linha, não por coluna |
| 5 | Coordenada pública = arredondada (~1 km) + distância aproximada | Matching sem expor localização |
| 6 | Distância por Haversine em `lib/geo/distance.ts` (e `haversine_km` em SQL para ordenar/filtrar no servidor) | Sem API externa; trocável por PostGIS |
| 7 | Matching atrás da interface `MatchingService` (`BasicMatchingService`) | Permitir Advanced/AI no futuro |
| 8 | Transição de status validada em TS (`lib/requests/state-machine.ts`) **e** em função SQL `request_transition_allowed` (usada por `_set_request_status` em todas as RPCs) | Regra no domínio + garantia no banco |
| 9 | Rate limit via tabela `rate_limit_events` + `check_rate_limit`/`enforce_rate_limit` (usadas pelas RPCs e triggers) | Sem infra extra (Redis) no MVP; trocável |
| 10 | Notificação = camada interna (tabela) + push (Web Push/VAPID); falha de push nunca cancela a interna | Prompt de Push |
| 11 | Admin identificado por `profiles.role` verificado no banco (`is_admin()`), nunca pelo cliente | Segurança |
| 12 | Papéis: enum `user_role` = USER, ADMIN, MODERATOR, SUPER_ADMIN; só USER/ADMIN usados no MVP | Extensível |
| 13 | `cacheComponents` do Next **desligado** (o scaffold vinha ligado) | App inteiro depende de sessão/cookies; o modo exigiria Suspense em todo acesso dinâmico sem ganho real |
| 14 | Fila de push no banco (`notifications.push_status`, `claim_pending_push` com `SKIP LOCKED`), processada pelo servidor via `after()` + `/api/push/dispatch` | Desacopla as RPCs transacionais (que criam a notificação interna) do envio; sem envio duplicado; falha de push nunca desfaz a interna |
| 15 | Telefone em `profile_contacts` e endereço em `help_request_private` | RLS é por linha; separar tabelas é o único jeito de liberar dado sensível só à contraparte |
| 16 | Testes de RLS/RPC com PGlite aplicando as migrations reais | Roda em qualquer máquina/CI sem Docker; negativos e positivos de segurança de verdade |
| 17 | Route Handlers usam `getRouteUser()` | Sem Supabase configurado respondem 401, nunca 500 com stack trace |
| 18 | Exclusão de conta resolvida no banco (`profiles_before_delete`, `ON DELETE SET NULL`) | Descoberto pelo teste de idempotência do seed: sem isso nenhuma conta que já foi ajudante podia ser excluída (LGPD) |
| 20 | Formulários com `method="post"` | Envio antes da hidratação nunca coloca senha na URL |
| 21 | E2E autoprovisionado (`tests/e2e/support/live.ts`) | Roda contra o Supabase real/produção sem seed e sem enviar e-mails; limpa tudo ao final |
| 22 | Fan-out de matching em `after()` | Publicar responde rápido; só a contagem é calculada antes |
| 23 | `/auth/confirm` (token_hash) além de `/auth/callback` (PKCE) | Confirmação de e-mail funciona em outro aparelho |
| 19 | Coordenada pública = centróide da cidade (`lib/geo/locations.ts`) | Sem API externa de geocoding; privacidade por construção. Substituir por tabela IBGE para cobertura nacional completa |

## Máquina de estados do pedido
`DRAFT → PUBLISHED → OPEN → ASSIGNED → AWAITING_CONFIRMATION → IN_PROGRESS → COMPLETION_PENDING → COMPLETED`
Laterais: `OPEN→CANCELLED|EXPIRED`, `ASSIGNED/AWAITING_CONFIRMATION→OPEN|CANCELLED`, `IN_PROGRESS→DISPUTED|CANCELLED`, `COMPLETION_PENDING→DISPUTED`, `DISPUTED→COMPLETED|CANCELLED` (admin).
`PUBLISHED→OPEN` é automático na publicação (ver `publish_request`).

## Progresso e decisões
Atualize esta seção a cada fase concluída.
- Fase 0: projeto vazio; scaffold Next 16 + Tailwind 4.
- Fases 1–19 e 21–23: implementadas (docs, design system, migrations+RLS, auth/consent/onboarding, categorias, pedidos+wizard, explorar, propostas, matching, seleção/confirmação, chat realtime, conclusão/disputa, avaliações/reputação, notificações+push VAPID, bloqueio/denúncia, admin+auditoria, analytics, PWA, segurança, deploy).
- Fase 20 (E2E): específicos públicos rodam; fluxos completos escritos e protegidos por `E2E_FULL=1` (exigem Supabase real).
- 2026-10-15: verificação contra produção (fluxos completos passando com Supabase real); correções e melhorias listadas no commit.
- **Pendências conhecidas**: (a) rodar E2E completo contra Supabase real; (b) validar entrega de push em navegador real com chaves VAPID; (c) tabela IBGE de municípios/centróides; (d) prompt de Push chegou truncado na seção 23 — integração matching→push implementada em `lib/notifications/match-fanout.ts`.
