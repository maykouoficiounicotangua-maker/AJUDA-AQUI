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
| E2E fluxos | `tests/e2e/flows.spec.ts` | Maria↔João até avaliação; matching→notificação; chat realtime com leitura; endereço liberado só após confirmar; bloqueio; denúncia→admin→auditoria; suspensão; acesso negado | **não**: `E2E_FULL=1` + Supabase real (autoprovisiona e limpa) |

## Rodando o E2E completo
```bash
# contra produção (sem servidor local)
E2E_FULL=1 E2E_BASE_URL=https://ajuda-aqui.vercel.app npx playwright test tests/e2e/flows.spec.ts --workers=1
# contra build local usando o .env.local
E2E_FULL=1 npx playwright test tests/e2e/flows.spec.ts --workers=1
```
`scripts/visual-audit.mts` captura as telas logadas e roda o axe (WCAG 2 AA).
O servidor é iniciado pelo próprio Playwright (`next build && next start` na porta 3100).

## O que NÃO é coberto automaticamente (limites conhecidos)
- Integração PostgREST/GoTrue/Realtime/Storage reais (só no E2E com Supabase).
- Entrega real de Web Push a um navegador (requer VAPID + HTTPS/localhost e permissão do usuário). Cobertos: payload, fila, preferências, assinaturas, limpeza.
- Entrega real de push no celular/desktop do usuário final (depende das variáveis VAPID no Vercel).

## Auditoria por módulo (item 94)
Antes de fechar um módulo: lint, typecheck, testes, build; procurar `TODO`, botões sem ação, dados hardcoded e `SELECT *`.
