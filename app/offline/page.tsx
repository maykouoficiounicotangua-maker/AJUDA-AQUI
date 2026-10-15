import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sem conexão", robots: { index: false } };
export const dynamic = "force-static";

/** Mostrada pelo Service Worker quando o app é aberto sem internet. */
export default function OfflinePage() {
  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <Logo />
      <span className="grid size-20 place-items-center rounded-full bg-brand-50 text-brand-700">
        <WifiOff className="size-10" aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold">Você está sem internet</h1>
      <p className="text-ink-muted">
        O Ajuda Aqui precisa de conexão para mostrar pedidos e mensagens. Assim que a internet voltar, é só tentar de novo.
      </p>
      <RetryButton />
    </main>
  );
}
