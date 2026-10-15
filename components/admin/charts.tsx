"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const nf = new Intl.NumberFormat("pt-BR");

/**
 * Colunas diárias de UMA métrica (small multiple). Uma cor só, base em zero, 2px de espaço entre barras,
 * topo arredondado. Tooltip ao passar o mouse/dedo ou focar; tabela como alternativa acessível.
 */
export function DailyBars({ title, data, total }: { title: string; data: { day: string; value: number }[]; total?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const sum = total ?? data.reduce((a, d) => a + d.value, 0);
  const label = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const h = hover != null ? data[hover] : null;

  return (
    <figure className="rounded-[var(--radius-card)] border border-line bg-white p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-2xl font-extrabold tabular-nums">{nf.format(sum)}</span>
      </figcaption>
      <p className="h-5 text-xs text-ink-muted" aria-live="polite">
        {h ? `${label(h.day)}: ${nf.format(h.value)}` : `no período · pico de ${nf.format(max === 1 && sum === 0 ? 0 : max)} em um dia`}
      </p>
      <div className="mt-2 flex h-24 items-end gap-[2px] border-b border-line" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <button
            key={d.day}
            type="button"
            aria-label={`${label(d.day)}: ${d.value}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="group flex h-full flex-1 items-end focus-visible:outline-2"
          >
            <span
              className={cn("block w-full rounded-t-[4px] transition-colors", hover === i ? "bg-brand-800" : "bg-brand-600")}
              style={{ height: d.value === 0 ? 0 : `${Math.max(4, (d.value / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
        <span>{data[0] && label(data[0].day)}</span>
        <span>{data.at(-1) && label(data.at(-1)!.day)}</span>
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-ink-muted">Ver em tabela</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr><th className="font-semibold">Dia</th><th className="text-right font-semibold">{title}</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.day}><td>{label(d.day)}</td><td className="text-right tabular-nums">{d.value}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

/** Barras horizontais (magnitude): rótulo + valor em texto; a barra só reforça a comparação. */
export function HBarList({ items, valueLabel }: { items: { label: string; value: number; note?: string; href?: string }[]; valueLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-ink-muted">Ainda sem dados.</p>;
  return (
    <ul className="space-y-2" aria-label={valueLabel}>
      {items.map((it) => (
        <li key={it.label} title={`${it.label}: ${it.value} ${valueLabel}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            {it.href ? <a href={it.href} className="truncate font-semibold underline-offset-2 hover:underline">{it.label}</a> : <span className="truncate font-semibold">{it.label}</span>}
            <span className="shrink-0 tabular-nums">{nf.format(it.value)}{it.note && <span className="ml-1 text-ink-muted">· {it.note}</span>}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
