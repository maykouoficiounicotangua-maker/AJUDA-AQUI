"use client";

import { useEffect, useState } from "react";
import { FilePen } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/display";

const DRAFT_KEY = "aa:request-wizard";

/** Lembra quem começou um pedido (ex.: antes de criar a conta) de terminar e publicar. */
export function DraftBanner() {
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as { title?: string } | null;
      // lê armazenamento do navegador só no cliente (hidratação)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (d?.title && d.title.trim().length >= 3) setTitle(d.title.trim());
    } catch { /* ignorar */ }
  }, []);
  if (!title) return null;
  return (
    <Card className="flex flex-wrap items-center gap-3 border-warm-500/40 bg-warm-50">
      <FilePen className="size-6 shrink-0 text-warm-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Você começou um pedido</p>
        <p className="truncate text-sm text-ink-muted">“{title}” ainda não foi publicado.</p>
      </div>
      <LinkButton href="/pedido/novo" variant="warm" size="sm">Continuar e publicar</LinkButton>
    </Card>
  );
}
