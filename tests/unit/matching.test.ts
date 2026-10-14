import { describe, expect, it } from "vitest";
import { BasicMatchingService, MATCH_WEIGHTS } from "@/lib/matching/basic";
import type { MatchHelper, MatchRequest } from "@/lib/matching/types";

const TECH = "cat-tech";
const ANIMALS = "cat-animals";

// Pedido: Niterói / Tecnologia / hoje 18h (uma segunda-feira: 2026-10-12)
const request: MatchRequest = {
  id: "r1", requesterId: "maria", categoryId: TECH, helpType: "PAID",
  state: "RJ", city: "Niterói", neighborhood: "Icaraí", lat: -22.9, lng: -43.1,
  scheduledDate: "2026-10-12", scheduledTime: "18:00", durationMinutes: 60,
};

const base: MatchHelper = {
  userId: "x", categoryIds: [], state: "RJ", city: "Niterói", neighborhood: null, lat: null, lng: null,
  maxDistanceKm: 15, acceptsPaid: true, acceptsFree: true, acceptsExchange: true,
  availableDays: [0, 1, 2, 3, 4, 5, 6], availabilityStart: "08:00", availabilityEnd: "20:00", trust: 0.5,
};

// Cenário do item 85 do prompt mestre
const userA: MatchHelper = { ...base, userId: "A", categoryIds: [TECH], state: "SP", city: "São Paulo", lat: -23.55, lng: -46.63, availableDays: [6] };
const userB: MatchHelper = { ...base, userId: "B", categoryIds: [ANIMALS], state: "RJ", city: "Rio de Janeiro", lat: -22.91, lng: -43.17, availableDays: [1] };
const userC: MatchHelper = { ...base, userId: "C", categoryIds: [TECH], lat: -22.915, lng: -43.1, availableDays: [1], availabilityStart: "17:00", availabilityEnd: "20:00", trust: 0.9 };

describe("BasicMatchingService", () => {
  const svc = new BasicMatchingService();

  it("os pesos somam 100", () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("cenário nacional: C (Niterói, Tecnologia, 2 km, disponível) é altamente compatível", () => {
    const r = svc.score(request, userC);
    expect(r.label).toBe("Alta compatibilidade");
    expect(r.distanceKm).toBeLessThan(3);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("A (São Paulo, só sábado) e B (outra categoria) ficam bem abaixo de C e sem selo alto", () => {
    const [a, b, c] = [userA, userB, userC].map((h) => svc.score(request, h));
    expect(c.score).toBeGreaterThan(a.score);
    expect(c.score).toBeGreaterThan(b.score);
    expect(a.label).not.toBe("Alta compatibilidade");
    expect(b.label).not.toBe("Alta compatibilidade");
  });

  it("categoria diferente + longe => sem rótulo (não sugerir)", () => {
    const far: MatchHelper = { ...userB, state: "SP", city: "São Paulo", lat: -23.55, lng: -46.63 };
    expect(svc.score(request, far).label).toBeNull();
  });

  it("fora do raio máximo do ajudante nunca é 'Alta compatibilidade'", () => {
    const h: MatchHelper = { ...userC, lat: -23.55, lng: -46.63, maxDistanceKm: 20 };
    const r = svc.score(request, h);
    expect(r.breakdown.distance).toBe(0);
    expect(r.label).not.toBe("Alta compatibilidade");
  });

  it("disponibilidade: dentro > começa dentro > dia ok fora do horário > dia indisponível", () => {
    const at = (over: Partial<MatchHelper>) => svc.score(request, { ...userC, ...over }).breakdown.availability;
    const inside = at({});
    const spills = at({ availabilityEnd: "18:30" });
    const outside = at({ availabilityStart: "07:00", availabilityEnd: "12:00" });
    const wrongDay = at({ availableDays: [3] });
    expect(inside).toBeGreaterThan(spills);
    expect(spills).toBeGreaterThan(outside);
    expect(outside).toBeGreaterThan(wrongDay);
    expect(wrongDay).toBe(0);
  });

  it("tipo de ajuda: ajudante que não aceita remunerado perde os pontos de tipo", () => {
    const r = svc.score(request, { ...userC, acceptsPaid: false });
    expect(r.breakdown.helpType).toBe(0);
  });

  it("reputação é só um fator pequeno (máx. 5 pontos) — nunca decide sozinha", () => {
    const hi = svc.score(request, { ...userC, trust: 1 });
    const lo = svc.score(request, { ...userC, trust: 0 });
    expect(hi.score - lo.score).toBeLessThanOrEqual(5);
  });

  it("sem coordenadas, usa cidade/bairro", () => {
    const sameCity = svc.score(request, { ...base, categoryIds: [TECH] });
    const sameHood = svc.score(request, { ...base, categoryIds: [TECH], neighborhood: "Icaraí" });
    const otherState = svc.score(request, { ...base, categoryIds: [TECH], state: "SP", city: "Santos" });
    expect(sameHood.breakdown.distance).toBeGreaterThan(sameCity.breakdown.distance);
    expect(sameCity.breakdown.distance).toBeGreaterThan(otherState.breakdown.distance);
  });

  it("taxonomia opcional dá crédito parcial a categorias relacionadas", () => {
    const withTax = new BasicMatchingService({ [TECH]: ["cat-phone"] });
    const h = { ...userC, categoryIds: ["cat-phone"] };
    expect(withTax.score(request, h).breakdown.category).toBeGreaterThan(0);
    expect(svc.score(request, h).breakdown.category).toBe(0);
  });

  it("ranking: ordena por score e nunca sugere o próprio solicitante", () => {
    const ranked = svc.rankHelpersForRequest(request, [userA, userB, userC, { ...userC, userId: "maria" }]);
    expect(ranked[0].userId).toBe("C");
    expect(ranked.find((h) => h.userId === "maria")).toBeUndefined();
  });

  it("rankRequestsForHelper ordena pedidos para um ajudante", () => {
    const farRequest: MatchRequest = { ...request, id: "r2", state: "SP", city: "Santos", lat: -23.96, lng: -46.33 };
    const ranked = svc.rankRequestsForHelper(userC, [farRequest, request]);
    expect(ranked.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("não usa atributos sensíveis (os tipos nem os aceitam)", () => {
    const keys = Object.keys(userC).join(",");
    expect(keys).not.toMatch(/gender|genero|race|raca|religion|religiao|orientation|politic/i);
  });
});
