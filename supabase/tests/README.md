# Testes de banco (RLS e RPCs)

Os testes de RLS/RPC rodam em **Vitest + PGlite** (Postgres em WASM) aplicando as migrations reais deste diretório,
com um stub mínimo do schema `auth` do Supabase. Ficam em [`tests/db/`](../../tests/db):

- `flow.test.ts` — fluxo completo, concorrência, cancelamento, desistência, disputa, expiração.
- `security.test.ts` — tudo que o usuário A **não** pode fazer com dados do B; bloqueios; denúncias; auditoria; rate limit; exclusão de conta.
- `push.test.ts` — fila de push, preferências, assinaturas.
- `seed.test.ts` — valida `seed.sql` (contagens, idempotência, visibilidade via RLS).
- `state-machine-parity.test.ts` — TypeScript e SQL concordam nos 121 pares de transição.

```bash
npm run test:db
```

Limitação honesta: PGlite não emula PostgREST/GoTrue/Realtime/Storage. Esses pontos de integração são cobertos
pelo E2E com Supabase real (`E2E_FULL=1`, ver docs/testing.md).
