# Segurança

## Camadas
1. **Autenticação**: Supabase Auth. Sessão renovada em `proxy.ts`. Rotas `(app)` e `/admin` exigem sessão.
2. **Autorização server-side**: `lib/auth` (`requireUser`, `requireAdmin`) em toda action/route; `profiles.status` ≠ ACTIVE bloqueia ações restritas.
3. **RLS** em todas as tabelas expostas. Políticas testadas em `supabase/tests/`.
4. **Constraints**: FK, UNIQUE (1 proposta por usuário/pedido, 1 avaliação por avaliador/pedido, bloqueio único), CHECK (valores, enums, datas).

## Privacidade de localização
`help_requests` guarda só dados públicos (cidade, bairro, coordenada arredondada). Endereço/coordenada exata vão em `help_request_private`: visível ao solicitante e, após seleção, ao ajudante selecionado.

## Dados sensíveis
Telefone só é visível ao próprio usuário e à contraparte de uma ajuda ativa (função `can_see_contact`). Senha nunca fica em `profiles`.

## Push
`VAPID_PRIVATE_KEY` apenas no servidor, nunca logada. `push_subscriptions` com RLS (cada um só vê as suas). Payload sem dado sensível. Endpoints com Zod + rate limit + auth.

## Entrada e saída
Zod em toda fronteira. React escapa HTML por padrão; não usar `dangerouslySetInnerHTML` com conteúdo de usuário. Headers de segurança em `next.config.ts`. Páginas privadas com `noindex`.

## Rate limiting
`check_rate_limit(user, action, max, window)` em pedidos, propostas, mensagens, denúncias e push.

## LGPD
Tabela `consents` versionada (termos, privacidade, segurança). Exportação/exclusão de conta preparadas via `profiles.status = DELETED` (anonimização) — fluxo completo é item de roadmap.
