import { describe, expect, it } from "vitest";
import { createDb } from "./harness";
import { REQUEST_STATUSES } from "@/types";
import { canTransition } from "@/lib/requests/state-machine";

describe("paridade TypeScript ↔ SQL da máquina de estados", () => {
  it("todos os 121 pares (de → para) concordam", async () => {
    const db = await createDb();
    for (const from of REQUEST_STATUSES) {
      for (const to of REQUEST_STATUSES) {
        const r = await db.query<{ ok: boolean }>(
          `select public.request_transition_allowed($1::public.request_status, $2::public.request_status) as ok`,
          [from, to],
        );
        expect(r.rows[0].ok, `${from} → ${to}`).toBe(canTransition(from, to));
      }
    }
  });

  it("os enums do banco batem com types/index.ts", async () => {
    const db = await createDb();
    const r = await db.query<{ v: string }>(`select unnest(enum_range(null::public.request_status))::text as v`);
    expect(r.rows.map((x) => x.v)).toEqual([...REQUEST_STATUSES]);
  });
});
