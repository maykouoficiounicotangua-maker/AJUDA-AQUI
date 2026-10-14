// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- mocks de borda: navegação, toasts e Server Actions (a lógica real delas é testada no banco) ---
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const saveRequestAction = vi.fn();
const publishRequestAction = vi.fn();
vi.mock("@/app/actions/requests", () => ({
  saveRequestAction: (...a: unknown[]) => saveRequestAction(...a),
  publishRequestAction: (...a: unknown[]) => publishRequestAction(...a),
  cancelRequestAction: vi.fn(), confirmStartAction: vi.fn(), deleteDraftAction: vi.fn(),
  helperWithdrawAction: vi.fn(), markDoneAction: vi.fn(), reportProblemAction: vi.fn(),
}));
const submitOfferAction = vi.fn();
vi.mock("@/app/actions/offers", () => ({
  submitOfferAction: (...a: unknown[]) => submitOfferAction(...a),
  withdrawOfferAction: vi.fn(), acceptOfferAction: vi.fn(), rejectOfferAction: vi.fn(),
}));
const submitReviewAction = vi.fn();
vi.mock("@/app/actions/social", () => ({
  submitReviewAction: (...a: unknown[]) => submitReviewAction(...a),
  toggleFavoriteAction: vi.fn(), sendMessageAction: vi.fn(), markConversationReadAction: vi.fn(),
  blockUserAction: vi.fn(), unblockUserAction: vi.fn(), reportUserAction: vi.fn(),
}));

import { RequestWizard } from "@/components/requests/request-wizard";
import { OfferForm } from "@/components/offers/offer-form";
import { ReviewForm } from "@/components/reviews/review-form";
import { RequestCard } from "@/components/requests/request-card";
import { ProfileMini } from "@/components/profile/profile-mini";
import { EmptyState } from "@/components/ui/display";

const categories = [
  { id: "3f2b8c1e-5a4d-4e8b-9c1a-2d3e4f5a6b7c", name: "Entregas", slug: "entregas", icon: "PackageCheck", description: null, active: true },
  { id: "4f2b8c1e-5a4d-4e8b-9c1a-2d3e4f5a6b7d", name: "Tecnologia", slug: "tecnologia", icon: "Laptop", description: null, active: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("RequestWizard", () => {
  const setup = () => render(<RequestWizard categories={categories} defaults={{ state: "RJ", city: "Niterói", neighborhood: "Icaraí" }} />);

  it("não avança sem categoria e título; mostra erro humano", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByText("Etapa 1 de 7")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Escolha uma categoria")).toBeInTheDocument();
    expect(screen.getByText("Etapa 1 de 7")).toBeInTheDocument();
  });

  it("percorre as etapas, valida tipo remunerado e chega à revisão", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("radio", { name: /Entregas/ }));
    await user.type(screen.getByLabelText(/Título do pedido/), "Buscar uma encomenda");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Etapa 2 de 7")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Descreva o que precisa/), "Preciso buscar um pacote no correio.");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Etapa 3 de 7")).toBeInTheDocument();
    // data padrão = hoje; horário 18:00 pode já ter passado => o schema impede. Define uma data futura.
    const date = screen.getByLabelText(/^Data/);
    await user.clear(date);
    await user.type(date, "2099-01-10");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Etapa 4 de 7")).toBeInTheDocument(); // cidade/estado vêm dos defaults
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Etapa 5 de 7")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Remunerada/ }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe o valor")).toBeInTheDocument(); // PAID exige valor

    await user.type(screen.getByLabelText(/Valor oferecido/), "20");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Etapa 6 de 7")).toBeInTheDocument();
    expect(screen.getByText("Buscar uma encomenda")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?20,00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar pedido" })).toBeInTheDocument();
  });

  it("publica enviando centavos (R$ 20 => 2000) e mostra a confirmação", async () => {
    publishRequestAction.mockResolvedValue({ ok: true, data: { id: "abc", compatible: 3 }, message: "Pedido publicado com sucesso!" });
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("radio", { name: /Entregas/ }));
    await user.type(screen.getByLabelText(/Título do pedido/), "Buscar uma encomenda");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(await screen.findByLabelText(/Descreva o que precisa/), "Preciso buscar um pacote no correio.");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const date = await screen.findByLabelText(/^Data/);
    await user.clear(date);
    await user.type(date, "2099-01-10");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("radio", { name: /Remunerada/ }));
    await user.type(screen.getByLabelText(/Valor oferecido/), "20");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Publicar pedido" }));

    await waitFor(() => expect(publishRequestAction).toHaveBeenCalled());
    const sent = publishRequestAction.mock.calls[0][0];
    expect(sent).toMatchObject({ helpType: "PAID", amountCents: 2000, title: "Buscar uma encomenda", state: "RJ", city: "Niterói" });
    expect(await screen.findByText("Pedido publicado com sucesso!")).toBeInTheDocument();
    expect(screen.getByText(/Encontramos 3 pessoas que podem ajudar/)).toBeInTheDocument();
  });
});

describe("OfferForm (TENHO INTERESSE)", () => {
  it("abre o formulário, valida a mensagem e envia", async () => {
    submitOfferAction.mockResolvedValue({ ok: true, message: "Proposta enviada!" });
    const user = userEvent.setup();
    render(<OfferForm requestId="3f2b8c1e-5a4d-4e8b-9c1a-2d3e4f5a6b7c" />);
    await user.click(screen.getByRole("button", { name: /TENHO INTERESSE/ }));
    expect(screen.getByLabelText(/Conte rapidamente por que você pode ajudar/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Conte rapidamente/), "oi");
    await user.click(screen.getByRole("button", { name: "Enviar proposta" }));
    expect(await screen.findByText(/mínimo de 5 caracteres/)).toBeInTheDocument();
    expect(submitOfferAction).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Conte rapidamente/));
    await user.type(screen.getByLabelText(/Conte rapidamente/), "Posso realizar essa tarefa hoje às 18h.");
    await user.click(screen.getByRole("button", { name: "Enviar proposta" }));
    await waitFor(() => expect(submitOfferAction).toHaveBeenCalledWith("3f2b8c1e-5a4d-4e8b-9c1a-2d3e4f5a6b7c", { message: "Posso realizar essa tarefa hoje às 18h." }));
  });
});

describe("ReviewForm", () => {
  it("exige a nota geral e envia critérios opcionais", async () => {
    submitReviewAction.mockResolvedValue({ ok: true, message: "Avaliação enviada. Obrigado!" });
    const user = userEvent.setup();
    render(<ReviewForm requestId="3f2b8c1e-5a4d-4e8b-9c1a-2d3e4f5a6b7c" otherName="João" />);
    expect(screen.getByText("Como foi com João?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(await screen.findByText("Escolha de 1 a 5 estrelas")).toBeInTheDocument();
    expect(submitReviewAction).not.toHaveBeenCalled();

    const geral = screen.getByRole("radiogroup", { name: "Avaliação geral" });
    await user.click(within(geral).getByRole("radio", { name: "5 estrelas" }));
    await user.type(screen.getByLabelText(/Comentário/), "Excelente!");
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    await waitFor(() => expect(submitReviewAction).toHaveBeenCalledWith("3f2b8c1e-5a4d-4e8b-9c1a-2d3e4f5a6b7c", { rating: 5, comment: "Excelente!" }));
  });
});

describe("apresentação", () => {
  it("RequestCard: nunca mostra endereço; mostra região, distância aproximada, valor e CTA", () => {
    render(
      <RequestCard
        category={categories[0]}
        request={{
          id: "r1", title: "Buscar uma encomenda", description: "Pacote no correio", help_type: "PAID", amount_cents: 2000, exchange_description: null,
          city: "Niterói", neighborhood: "Icaraí", scheduled_date: "2099-01-10", scheduled_time: "18:00:00", duration_minutes: 60, status: "OPEN", distance_km: 2.4,
        }}
        match={{ score: 90, label: "Alta compatibilidade", breakdown: { category: 40, distance: 25, availability: 20, helpType: 10, reputation: 5 }, distanceKm: 2.4 }}
      />,
    );
    expect(screen.getByRole("link", { name: "Buscar uma encomenda" })).toHaveAttribute("href", "/pedido/r1");
    expect(screen.getByText(/Icaraí, Niterói · cerca de 2 km/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?20,00/)).toBeInTheDocument();
    expect(screen.getByText("Alta compatibilidade")).toBeInTheDocument();
    expect(screen.queryByText(/90/)).not.toBeInTheDocument(); // score bruto nunca é exibido
    expect(screen.getByText("TENHO INTERESSE")).toBeInTheDocument();
  });

  it("ProfileMini: selo, avaliação e contagem; sem avaliações mostra texto neutro", () => {
    const profile = { id: "u1", full_name: "João Souza", avatar_url: null, city: "Niterói", neighborhood: "Centro", show_rating: true, show_help_count: true };
    const { rerender } = render(<ProfileMini profile={profile} stats={{ user_id: "u1", avg_rating: 4.8, review_count: 12, helps_completed: 11, requests_completed: 2, requests_total: 3, completion_rate: 0.66 }} />);
    expect(screen.getByText("Colaborador")).toBeInTheDocument();
    expect(screen.getByLabelText(/4,8 de 5 estrelas/)).toBeInTheDocument();
    expect(screen.getByText("11 ajudas")).toBeInTheDocument();
    rerender(<ProfileMini profile={profile} stats={null} />);
    expect(screen.getByText("Sem avaliações ainda")).toBeInTheDocument();
    expect(screen.getByText("Novo")).toBeInTheDocument();
  });

  it("EmptyState mostra título, descrição e ação", () => {
    render(<EmptyState title="Você ainda não possui conversas." description="As conversas começam quando um pedido é aceito." action={<button>Explorar</button>} />);
    expect(screen.getByText("Você ainda não possui conversas.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explorar" })).toBeInTheDocument();
  });
});
