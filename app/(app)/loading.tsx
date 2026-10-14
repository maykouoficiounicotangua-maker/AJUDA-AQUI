import { Skeleton } from "@/components/ui/display";

export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-[var(--radius-card)]" />)}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
