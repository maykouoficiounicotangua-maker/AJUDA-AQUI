import { describe, expect, it } from "vitest";
import { TRANSITIONS, availableActions, canTransition, isTerminal } from "@/lib/requests/state-machine";
import { computeBadge, trustSignal } from "@/lib/reputation";
import { formatApproxDistance, haversineKm, toPublicCoords } from "@/lib/geo/distance";
import { cityCentroid } from "@/lib/geo/locations";
import { formatBRL, formatRequestDate, parseBRLToCents } from "@/lib/utils/format";
import { isInPast } from "@/lib/utils/time";
import { humanizeError } from "@/lib/errors";
import { safeInternalUrl, preferenceGroup, NOTIFICATION_TYPES } from "@/lib/notifications/catalog";
import {
  pushSubscriptionSchema, requestInputSchema, reviewSchema, signUpSchema, helperPrefsSchema, sanitizeText,
} from "@/lib/validations";

describe("máquina de estados", () => {
  it("segue o fluxo principal", () => {
    const path = ["DRAFT", "PUBLISHED", "OPEN", "ASSIGNED", "AWAITING_CONFIRMATION", "IN_PROGRESS", "COMPLETION_PENDING", "COMPLETED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("bloqueia atalhos e saídas de estados terminais", () => {
    expect(canTransition("OPEN", "COMPLETED")).toBe(false);
    expect(canTransition("DRAFT", "IN_PROGRESS")).toBe(false);
    for (const s of ["COMPLETED", "CANCELLED", "EXPIRED"] as const) expect(isTerminal(s)).toBe(true);
    expect(canTransition("COMPLETED", "OPEN")).toBe(false);
  });
  it("disputa só resolve para COMPLETED ou CANCELLED", () => {
    expect(TRANSITIONS.DISPUTED).toEqual(["COMPLETED", "CANCELLED"]);
  });
  it("ações por papel", () => {
    const req = { status: "OPEN" as const, requester_id: "m", selected_helper_id: null, requester_confirmed_start: false, helper_confirmed_start: false, requester_confirmed_done: false, helper_confirmed_done: false };
    expect(availableActions(req, "m")).toEqual(["edit", "cancel"]);
    expect(availableActions(req, "j")).toEqual(["offer"]);
    expect(availableActions(req, "j", { hasOffer: true })).toEqual([]);
    expect(availableActions(req, null)).toEqual([]); // sem sessão, nenhuma ação
  });
});

describe("reputação e selos", () => {
  it("regras de selo", () => {
    expect(computeBadge({ helps_completed: 0, avg_rating: null })).toBe("NOVO");
    expect(computeBadge({ helps_completed: 3, avg_rating: 3 })).toBe("PARTICIPANTE");
    expect(computeBadge({ helps_completed: 10, avg_rating: 3 })).toBe("COLABORADOR");
    expect(computeBadge({ helps_completed: 25, avg_rating: 4.8 })).toBe("CONFIAVEL");
    expect(computeBadge({ helps_completed: 25, avg_rating: 3.9 })).toBe("COLABORADOR"); // 25 sem boa avaliação
    expect(computeBadge(null)).toBe("NOVO");
  });
  it("sinal de confiança é neutro sem avaliações e suavizado com poucas", () => {
    expect(trustSignal(null)).toBe(0.5);
    expect(trustSignal({ avg_rating: 5, review_count: 1, completion_rate: 1 })).toBeLessThan(trustSignal({ avg_rating: 5, review_count: 10, completion_rate: 1 }));
  });
});

describe("geo", () => {
  it("haversine: Niterói ↔ Rio ≈ 10–15 km", () => {
    const d = haversineKm({ lat: -22.88, lng: -43.1 }, { lat: -22.91, lng: -43.17 });
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(15);
  });
  it("coordenada pública é arredondada (~1 km) e a distância exibida é aproximada", () => {
    expect(toPublicCoords({ lat: -22.906847, lng: -43.172897 })).toEqual({ lat: -22.91, lng: -43.17 });
    expect(formatApproxDistance(0.4)).toBe("menos de 1 km");
    expect(formatApproxDistance(2.4)).toBe("cerca de 2 km");
    expect(formatApproxDistance(null)).toBeNull();
  });
  it("centróide ignora acentos e caixa", () => {
    expect(cityCentroid("RJ", "niteroi")).not.toBeNull();
    expect(cityCentroid("rj", "NITERÓI")).not.toBeNull();
    expect(cityCentroid("RJ", "Cidade Inexistente")).toBeNull();
  });
});

describe("formatação", () => {
  it("dinheiro em centavos", () => {
    expect(parseBRLToCents("20")).toBe(2000);
    expect(parseBRLToCents("R$ 1.234,56")).toBe(123456);
    expect(parseBRLToCents("0")).toBeNull();
    expect(parseBRLToCents("abc")).toBeNull();
    expect(formatBRL(2000).replace(/\s/g, " ")).toMatch(/R\$\s?20,00/);
  });
  it("datas relativas", () => {
    const today = new Date(2026, 9, 12);
    expect(formatRequestDate("2026-10-12", today)).toBe("Hoje");
    expect(formatRequestDate("2026-10-13", today)).toBe("Amanhã");
  });
  it("passado/futuro respeita o fuso", () => {
    const now = new Date("2026-10-12T21:00:00Z"); // 18:00 em São Paulo
    expect(isInPast("2026-10-12", "17:59", "America/Sao_Paulo", now)).toBe(true);
    expect(isInPast("2026-10-12", "18:30", "America/Sao_Paulo", now)).toBe(false);
  });
});

describe("erros humanos", () => {
  it("traduz códigos conhecidos e nunca vaza erro de banco", () => {
    expect(humanizeError({ message: "ALREADY_OFFERED" })).toMatch(/já enviou/);
    expect(humanizeError({ message: 'duplicate key value violates unique constraint "x"' })).not.toMatch(/constraint/);
    expect(humanizeError({ message: "violates row-level security policy" })).toMatch(/permissão/);
    expect(humanizeError(new Error("boom db failure"))).toBe("Não conseguimos concluir esta ação agora. Tente novamente.");
  });
});

describe("notificações", () => {
  it("todo tipo tem grupo de preferência", () => {
    for (const t of NOTIFICATION_TYPES) expect(preferenceGroup(t)).toBeTruthy();
    expect(preferenceGroup("NEW_MESSAGE")).toBe("messages");
    expect(preferenceGroup("OFFER_ACCEPTED")).toBe("offers");
  });
  it("URL de destino só aceita caminhos internos (anti open-redirect)", () => {
    expect(safeInternalUrl("/pedido/1")).toBe("/pedido/1");
    expect(safeInternalUrl("https://evil.com")).toBe("/notificacoes");
    expect(safeInternalUrl("//evil.com")).toBe("/notificacoes");
    expect(safeInternalUrl("/\\evil.com")).toBe("/notificacoes");
    expect(safeInternalUrl(null)).toBe("/notificacoes");
  });
});

describe("validações", () => {
  const uuid = "3f2b8c1e-5a4d-4e8b-9c1a-2d3e4f5a6b7c";
  const future = "2099-01-01";

  it("pedido válido por tipo", () => {
    const base = { categoryId: uuid, title: "Buscar uma encomenda", description: "Preciso buscar um pacote no correio.", scheduledDate: future, scheduledTime: "18:00", durationMinutes: 60, state: "RJ", city: "Niterói" };
    expect(requestInputSchema.safeParse({ ...base, helpType: "FREE" }).success).toBe(true);
    expect(requestInputSchema.safeParse({ ...base, helpType: "PAID" }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...base, helpType: "PAID", amountCents: 2000 }).success).toBe(true);
    expect(requestInputSchema.safeParse({ ...base, helpType: "EXCHANGE" }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...base, helpType: "EXCHANGE", exchangeDescription: "Um bolo" }).success).toBe(true);
    expect(requestInputSchema.safeParse({ ...base, helpType: "FREE", scheduledDate: "2020-01-01" }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...base, helpType: "FREE", title: "oi" }).success).toBe(false);
  });
  it("cadastro exige termos, senha com letras+números e telefone", () => {
    const ok = { fullName: "Maria Silva", email: "MARIA@x.com", phone: "+55 21 99999-0000", password: "senha1234", state: "RJ", city: "Niterói", acceptTerms: true };
    const parsed = signUpSchema.safeParse(ok);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("maria@x.com");
    expect(signUpSchema.safeParse({ ...ok, acceptTerms: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, password: "somenteletras" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, fullName: "Maria" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, phone: "abc" }).success).toBe(false);
  });
  it("avaliação 1–5", () => {
    expect(reviewSchema.safeParse({ rating: 5 }).success).toBe(true);
    expect(reviewSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 6 }).success).toBe(false);
  });
  it("assinatura push: só HTTPS e chaves com tamanho limitado", () => {
    const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "x".repeat(40), auth: "y".repeat(16) } };
    expect(pushSubscriptionSchema.safeParse(ok).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ ...ok, endpoint: "http://insecure.com/x" }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...ok, keys: { p256dh: "x".repeat(1000), auth: "y".repeat(16) } }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: ok.endpoint }).success).toBe(false);
  });
  it("preferências de ajudante: janela coerente e ao menos um tipo", () => {
    const ok = { maxDistanceKm: 10, acceptsPaid: true, acceptsFree: true, acceptsExchange: false, availableDays: [1, 2], availabilityStart: "08:00", availabilityEnd: "18:00", active: true };
    expect(helperPrefsSchema.safeParse(ok).success).toBe(true);
    expect(helperPrefsSchema.safeParse({ ...ok, availabilityEnd: "07:00" }).success).toBe(false);
    expect(helperPrefsSchema.safeParse({ ...ok, acceptsPaid: false, acceptsFree: false }).success).toBe(false);
    expect(helperPrefsSchema.safeParse({ ...ok, availableDays: [] }).success).toBe(false);
  });
  it("sanitização remove caracteres de controle", () => {
    expect(sanitizeText("  olá\u0000 mundo\u0007  ")).toBe("olá mundo");
  });
});
