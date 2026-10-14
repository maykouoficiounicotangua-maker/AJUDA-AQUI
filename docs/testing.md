# Testes

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Camadas
| Camada | Onde | O que cobre | Roda sem backend? |
|---|---|---|---|
| Unitários | `tests/unit/*.test.ts` | máquina de estados, matching (cenário nacional do item 85), reputação/selos, geo, formatação, erros humanos, validações Zod, catálogo de notificações, payload de push | sim |
| Componentes | `tests/unit/components.test.tsx` (jsdom) | wizard completo até publicar (R$ 20 → 2000 centavos), proposta, avaliação, cartão de pedido, perfil | sim (Server Actions mockadas) |
| **Banco / RLS / RPC** | `tests/db/*.test.ts` (PGlite) | migrations reais, fluxo completo, concorrência, **negativos de segurança**, bloqueios, denúncias, auditoria, rate limit, push, seed, exclusão de conta, paridade TS↔SQL | sim |
| E2E público | `tests/e2e/public.spec.ts` | páginas públicas, validações, PWA (manifest, SW), headers, robots, rotas protegidas, 8 viewports sem rolagem horizontal, acessibilidade básica | sim |
| E2E fluxos | `tests/e2e/flows.spec.ts` | cadastro→onboarding→logout; Maria↔João até avaliação; chat realtime; bloqueio; denúncia→admin→auditoria; admin; acesso negado | **não**: `E2E_FULL=1` + Supabase + seed |

## Rodando o E2E completo
```bash
supabase start && supabase db reset          # migrations + seed
# .env.local com URL/anon/service_role do `supabase status`
E2E_FULL=1 npx playwright test
```
O servidor é iniciado pelo próprio Playwright (`next build && next start` na porta 3100).

## O que NÃO é coberto automaticamente (limites conhecidos)
- Integração PostgREST/GoTrue/Realtime/Storage reais (só no E2E com Supabase).
- Entrega real de Web Push a um navegador (requer VAPID + HTTPS/localhost e permissão do usuário). Cobertos: payload, fila, preferências, assinaturas, limpeza.
- Telas autenticadas em layout real: validadas por testes de componente, não por captura visual.

## Auditoria por módulo (item 94)
Antes de fechar um módulo: lint, typecheck, testes, build; procurar `TODO`, botões sem ação, dados hardcoded e `SELECT *`.
