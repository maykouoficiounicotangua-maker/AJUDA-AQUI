"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Share, SquarePlus, WifiOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "./bottom-sheet";
import { installSnoozed, promptInstall, setInstallSheetOpen, snoozeInstall, useInstallState } from "@/lib/pwa/install";

const HIDDEN_ON = ["/entrar", "/cadastrar", "/recuperar-senha", "/redefinir-senha", "/aceitar-termos"];

/**
 * Convite para instalar o app, mostrado na abertura quando ainda não está instalado.
 * Android/Chrome/Edge: instala com um toque. iPhone: mostra o passo a passo do Safari.
 */
export function InstallPrompt() {
  const { installed, platform } = useInstallState();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (installed || platform === "unsupported" || installSnoozed() || HIDDEN_ON.some((p) => pathname.startsWith(p))) return;
    const t = setTimeout(() => {
      setOpen(true);
      setInstallSheetOpen(true);
    }, 2500);
    return () => clearTimeout(t);
  }, [installed, platform, pathname]);

  const close = () => {
    setOpen(false);
    setInstallSheetOpen(false);
    snoozeInstall();
  };

  const install = async () => {
    const accepted = await promptInstall();
    setOpen(false);
    setInstallSheetOpen(false);
    if (!accepted) snoozeInstall();
  };

  return (
    <BottomSheet open={open} onClose={close} labelledBy="install-title">
      <div className="flex items-center gap-3">
        <Image src="/icons/icon-192.png" alt="" width={56} height={56} className="rounded-2xl" />
        <div>
          <h2 id="install-title" className="text-xl font-extrabold">Instale o Ajuda Aqui</h2>
          <p className="text-sm text-ink-muted">Grátis, leve e sem loja de aplicativos.</p>
        </div>
      </div>
      <ul className="my-5 space-y-2 text-sm">
        <li className="flex items-center gap-3"><Zap className="size-5 text-brand-700" aria-hidden /> Abre direto da tela inicial, como um app</li>
        <li className="flex items-center gap-3"><Bell className="size-5 text-brand-700" aria-hidden /> Avisos de novos pedidos perto de você e de mensagens</li>
        <li className="flex items-center gap-3"><WifiOff className="size-5 text-brand-700" aria-hidden /> Ocupa quase nada de espaço no celular</li>
      </ul>
      {platform === "ios" ? (
        <ol className="mb-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
          <li className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full bg-brand-700 font-bold text-white">1</span> Toque em <Share className="inline size-5" aria-label="Compartilhar" /> <strong>Compartilhar</strong>, na barra do Safari</li>
          <li className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full bg-brand-700 font-bold text-white">2</span> Escolha <SquarePlus className="inline size-5" aria-hidden /> <strong>Adicionar à Tela de Início</strong></li>
          <li className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full bg-brand-700 font-bold text-white">3</span> Abra o Ajuda Aqui pelo novo ícone</li>
        </ol>
      ) : (
        <Button size="lg" className="mb-2 w-full" onClick={install}>Instalar app</Button>
      )}
      <Button variant="ghost" className="w-full" onClick={close}>{platform === "ios" ? "Entendi" : "Agora não"}</Button>
    </BottomSheet>
  );
}

/** Botão "Instalar app" para menus/landing; some quando já instalado ou indisponível. */
export function InstallButton({ className }: { className?: string }) {
  const { installed, platform } = useInstallState();
  if (installed || platform !== "native") return null;
  return <Button variant="secondary" className={className} onClick={() => void promptInstall()}>Instalar app no celular</Button>;
}
