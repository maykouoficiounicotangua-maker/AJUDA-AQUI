import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Valida "Authorization: Bearer <CRON_SECRET>" em tempo constante. Sem segredo configurado => sempre nega. */
export function isAuthorizedJob(request: Request): boolean {
  const secret = serverEnv().cronSecret;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
