"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Folha inferior no celular / cartão flutuante no desktop. Fecha com Esc; foco vai para o conteúdo. */
export function BottomSheet({
  open, onClose, labelledBy, children, className,
}: { open: boolean; onClose: () => void; labelledBy: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-end sm:justify-end sm:bg-transparent sm:p-6" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "animate-sheet-in relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-w-md sm:rounded-3xl sm:border sm:border-line sm:pb-6",
          className,
        )}
      >
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-ink-muted hover:bg-slate-100">
          <X className="size-5" aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}
