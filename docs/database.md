# Banco de dados

PostgreSQL via Supabase. Toda mudança estrutural é uma **migration** em `supabase/migrations/` (ordem por timestamp):

| Arquivo | Conteúdo |
|---|---|
| `…0001_core.sql` | enums, `profiles`, `profile_contacts`, helpers `is_admin`/`is_active_user`, `categories` (+12 iniciais), `user_categories`, `helper_preferences`, `consents` |
| `…0002_requests_social.sql` | `help_requests`, `help_request_private`, `help_request_offers`, `blocks`, `favorites`, `conversations`, `conversation_participants`, `messages`, `reviews`, `reports`, `disputes`, funções de visibilidade (`can_view_profile`, `can_see_contact`, `shares_context`…) |
| `…0003_notifications_audit.sql` | `notification_preferences`, `notifications`, `push_subscriptions`, `audit_logs`, `analytics_events`, rate limit, `create_notification`, `write_audit`, `handle_new_user` |
| `…0004_functions.sql` | RPCs transacionais, `search_requests`, máquina de estados, expiração, funções admin, `profile_stats`, fila de push, exclusão de conta, **grants de execução** |
| `…0005_rls.sql` | RLS em todas as tabelas + grants por coluna + Realtime |
| `…0007_improvements.sql` | feed sem pedidos vencidos, proposta bloqueada em pedido vencido, filtros cidade/bairro sem diferenciar maiúsculas, lembretes `send_upcoming_reminders` (+ `REQUEST_REMINDER`), permissões |
| `…0006_storage.sql` | buckets `avatars` (público) e `evidence` (privado) — só em projetos Supabase |

## Desvios intencionais do prompt mestre (e por quê)
- **Telefone não está em `profiles`**: RLS é por linha, não por coluna. `profile_contacts` permite liberar o telefone só à contraparte de uma ajuda ativa.
- **Endereço/coordenada exata em `help_request_private`**: liberada só ao dono e ao ajudante que já confirmou. `help_requests` guarda apenas cidade/bairro e coordenada arredondada (~1 km, forçada por trigger).
- **Dinheiro**: `amount_cents integer`.
- **Sem `latitude/longitude` exatas em pedidos**: a coordenada pública vem do centróide da cidade (`lib/geo/locations.ts`). Cidades fora da lista funcionam, só sem distância numérica (o matching cai para cidade/bairro).
- **`accepts_exchange` e `max_distance_km`** adicionados a `helper_preferences`; **`timezone`** a `help_requests`.
- `ASSIGNED` = ajudante escolhido; `AWAITING_CONFIRMATION` = uma das partes já confirmou; `IN_PROGRESS` = ambas confirmaram.

## Segurança por camadas
- **RLS em todas as tabelas expostas** (`rate_limit_events` não tem política: só funções `SECURITY DEFINER`).
- **Grants por coluna**: o usuário não consegue `UPDATE` em `profiles.role/status`, `help_requests.status/selected_helper_id`, flags de confirmação etc.
- **Escrita crítica só via RPC** (`publish_request`, `submit_offer`, `accept_offer`, `confirm_start`, `mark_done`, `report_problem`, `submit_review`, `submit_report`, `cancel_request`, `helper_withdraw`, `admin_*`). Todas travam a linha (`FOR UPDATE`) e validam a transição.
- **Concorrência**: índice único parcial garante no máximo 1 proposta `ACCEPTED` por pedido; `accept_offer` trava o pedido antes da proposta.
- **Execução de funções**: `REVOKE ALL … FROM public, anon, authenticated` e grant explícito só do que é público.

## Máquina de estados
`DRAFT → PUBLISHED → OPEN → ASSIGNED → AWAITING_CONFIRMATION → IN_PROGRESS → COMPLETION_PENDING → COMPLETED`;
laterais: `OPEN→CANCELLED|EXPIRED`, `ASSIGNED|AWAITING_CONFIRMATION→OPEN|CANCELLED`, `IN_PROGRESS→DISPUTED|CANCELLED`, `COMPLETION_PENDING→DISPUTED`, `DISPUTED→COMPLETED|CANCELLED`.
Fonte da verdade: `request_transition_allowed()` (SQL); espelho em `lib/requests/state-machine.ts` (teste de paridade).

## Índices
Conforme o item 73 do prompt: `help_requests` (status, category, requester, helper, date, city/state, created, feed parcial `OPEN`), `help_request_offers` (request, helper, status, parcial `ACCEPTED`), `messages` (conversation+created), `notifications` (user, read, created; fila de push pendente), `reports` (status, created), além de lookups de rate limit e favoritos únicos.

## Exclusão de conta (LGPD)
`DELETE` em `auth.users` cascateia para `profiles`. Antes, `profiles_before_delete` reabre/cancela ajudas em que a pessoa era ajudante e avisa o solicitante. Mensagens do usuário ficam anonimizadas (`sender_id = NULL`), `resolved_by`/`audit_logs.admin_id` viram `NULL`.

## Jobs
`expire_requests()` (marca `EXPIRED` pedidos abertos cujo horário passou) — chamada por `/api/cron/expire`. `claim_pending_push()` — fila de push (`FOR UPDATE SKIP LOCKED`).
