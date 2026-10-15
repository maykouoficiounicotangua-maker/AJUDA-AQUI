import { Notice } from "@/components/ui/display";

/** Explica POR QUE pedimos login agora (o visitante estava fazendo algo). */
export function AuthContextNotice({ next }: { next?: string }) {
  if (!next) return null;
  let text = "";
  if (next.startsWith("/pedido/novo")) text = "Falta pouco! Seu pedido está salvo neste aparelho. Entre ou crie sua conta para publicá-lo.";
  else if (next.startsWith("/pedido/")) text = "Entre ou crie sua conta para enviar sua proposta. Você volta direto para o pedido.";
  else return null;
  return <div className="mb-4"><Notice tone="info">{text}</Notice></div>;
}
