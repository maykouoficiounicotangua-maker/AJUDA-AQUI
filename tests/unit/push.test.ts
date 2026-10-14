import { describe, expect, it } from "vitest";
import { buildPushPayload } from "@/lib/push/payload";
import { detectDevice } from "@/lib/push/device";

describe("payload de push", () => {
  const base = { id: "n1", type: "NEW_OFFER" as const, title: "Nova proposta", body: "João quer ajudar.", url: "/pedido/abc" };

  it("monta payload padronizado com ícone, badge, url interna e ação", () => {
    const p = buildPushPayload(base);
    expect(p).toMatchObject({ title: "Nova proposta", icon: "/icons/icon-192.png", badge: "/icons/badge-72.png", url: "/pedido/abc", notificationId: "n1", type: "NEW_OFFER" });
    expect(p.actions).toEqual([{ action: "open", title: "Ver proposta" }]);
  });

  it("nunca repassa URL externa (anti open-redirect)", () => {
    expect(buildPushPayload({ ...base, url: "https://evil.example" }).url).toBe("/notificacoes");
    expect(buildPushPayload({ ...base, url: "//evil.example" }).url).toBe("/notificacoes");
    expect(buildPushPayload({ ...base, url: null }).url).toBe("/notificacoes");
  });

  it("só repassa IDs de recursos em data — descarta telefone, endereço, token e afins", () => {
    const p = buildPushPayload({
      ...base,
      data: { request_id: "r1", conversation_id: "c1", phone: "+55 21 99999-0000", address: "Rua Secreta 1", token: "abc", offer_id: 42 },
    });
    expect(p.data).toEqual({ request_id: "r1", conversation_id: "c1" });
    expect(JSON.stringify(p)).not.toMatch(/99999|Secreta|token/);
  });

  it("limita o tamanho de título e corpo", () => {
    const p = buildPushPayload({ ...base, title: "T".repeat(500), body: "B".repeat(500) });
    expect(p.title.length).toBeLessThanOrEqual(80);
    expect(p.body.length).toBeLessThanOrEqual(160);
  });

  it("agrupa por tipo + recurso (tag) para não empilhar", () => {
    const a = buildPushPayload({ ...base, data: { request_id: "r1" } });
    const b = buildPushPayload({ ...base, id: "n2", data: { request_id: "r1" } });
    expect(a.tag).toBe(b.tag);
  });
});

describe("detecção de dispositivo", () => {
  it("reconhece desktop, mobile e navegador", () => {
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/120 Safari/537.36")).toEqual({ deviceType: "desktop", browser: "Chrome" });
    expect(detectDevice("Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit Chrome/120 Mobile Safari")).toMatchObject({ deviceType: "mobile" });
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537 Edg/120").browser).toBe("Edge");
    expect(detectDevice(null)).toEqual({ deviceType: "unknown", browser: "Outro" });
  });
});
