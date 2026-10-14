import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/** Abas por link (estado na URL): funcionam sem JS e permitem compartilhar/voltar. */
export function LinkTabs({ tabs, active, basePath, param = "grupo" }: { tabs: { value: string; label: string }[]; active: string; basePath: string; param?: string }) {
  return (
    <nav aria-label="Seções" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
      {tabs.map((t) => (
        <Link
          key={t.value}
          href={`${basePath}?${param}=${t.value}`}
          aria-current={active === t.value ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold",
            active === t.value ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-muted hover:bg-slate-50",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
