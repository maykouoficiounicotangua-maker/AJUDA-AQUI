"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { BR_STATES } from "@/lib/geo/locations";
import { cn } from "@/lib/utils/cn";
import type { Category } from "@/types";

const DAY_CHIPS = [
  { value: "", label: "Todos" },
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
];
const TYPE_CHIPS = [
  { value: "", label: "Qualquer tipo" },
  { value: "FREE", label: "Gratuitos" },
  { value: "PAID", label: "Remunerados" },
  { value: "EXCHANGE", label: "Troca" },
];

/** Filtros no estado da URL: o servidor filtra, ordena e pagina. Busca por texto com debounce. */
export function ExploreFilters({ categories, defaultState, visitor = false }: { categories: Category[]; defaultState: string; visitor?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    if (!("q" in patch)) patch = { ...patch, q };
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("pagina");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // debounce de 400 ms na busca textual
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    clearTimeout(timer.current);
    // Só aplica se o usuário AINDA está na busca: se ele já tocou num pedido, não o arrastamos de volta.
    timer.current = setTimeout(() => {
      if (document.activeElement === searchRef.current) update({ q });
    }, 400);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const day = params.get("dia") ?? "";
  const type = params.get("tipo") ?? "";
  const state = params.get("estado") ?? defaultState;

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold",
        active ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-muted hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );

  return (
    <section aria-label="Filtros" className="space-y-3" aria-busy={pending}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
        <Input
          ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { clearTimeout(timer.current); update({ q }); } }} placeholder="Buscar por palavra…" className="pl-12" aria-label="Buscar pedidos" maxLength={80} />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Quando">
        {DAY_CHIPS.map((c) => (
          <Chip key={c.value} active={day === c.value} onClick={() => update({ dia: c.value })}>{c.label}</Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" aria-hidden />
        {TYPE_CHIPS.map((c) => (
          <Chip key={c.value} active={type === c.value} onClick={() => update({ tipo: c.value })}>{c.label}</Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Select aria-label="Categoria" value={params.get("categoria") ?? ""} onChange={(e) => update({ categoria: e.target.value })}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label="Estado" value={state} onChange={(e) => update({ estado: e.target.value, cidade: "", bairro: "" })}>
          <option value="all">Todo o Brasil</option>
          {BR_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </Select>
        <Input
          aria-label="Cidade" placeholder="Cidade" defaultValue={params.get("cidade") ?? ""} key={`c-${params.get("cidade") ?? ""}`}
          onBlur={(e) => e.target.value !== (params.get("cidade") ?? "") && update({ cidade: e.target.value.trim() })}
          onKeyDown={(e) => e.key === "Enter" && update({ cidade: e.currentTarget.value.trim() })}
        />
        <Input
          aria-label="Bairro ou região" placeholder="Bairro" defaultValue={params.get("bairro") ?? ""} key={`b-${params.get("bairro") ?? ""}`}
          onBlur={(e) => e.target.value !== (params.get("bairro") ?? "") && update({ bairro: e.target.value.trim() })}
          onKeyDown={(e) => e.key === "Enter" && update({ bairro: e.currentTarget.value.trim() })}
        />
        {!visitor && (
          <Select aria-label="Distância" value={params.get("km") ?? ""} onChange={(e) => update({ km: e.target.value })}>
          <option value="">Qualquer distância</option>
          {[5, 10, 25, 50, 100].map((k) => <option key={k} value={k}>até {k} km</option>)}
        </Select>
        )}
        <Select aria-label="Ordenar por" value={params.get("ordem") ?? (visitor ? "recent" : "match")} onChange={(e) => update({ ordem: e.target.value })}>
          {!visitor && <option value="match">Mais compatíveis</option>}
          {!visitor && <option value="nearest">Mais próximos</option>}
          <option value="recent">Mais recentes</option>
          <option value="time">Horário</option>
          <option value="category">Categoria</option>
        </Select>
      </div>
    </section>
  );
}
