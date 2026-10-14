"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/display";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // O detalhe técnico fica no console/log; o usuário vê uma mensagem humana.
    console.error(JSON.stringify({ level: "error", scope: "ui", digest: error.digest }));
  }, [error]);
  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <Notice tone="danger" title="Algo não saiu como esperado">Não conseguimos carregar esta tela agora. Tente novamente.</Notice>
      <div className="flex justify-center gap-3">
        <Button onClick={reset}>Tentar de novo</Button>
        <LinkButton href="/inicio" variant="secondary">Ir para o início</LinkButton>
      </div>
    </div>
  );
}
