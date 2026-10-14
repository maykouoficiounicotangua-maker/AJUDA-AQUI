import Image from "next/image";
import { Inbox, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";
import type { StatusTone } from "@/lib/requests/state-machine";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm", className)} {...props} />;
}

const tones: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-info-50 text-info-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-caution-50 text-caution-700",
  danger: "bg-danger-50 text-danger-700",
};

/** O texto sempre acompanha a cor — não dependemos só de cor. */
export function Badge({ tone = "neutral", className, ...props }: { tone?: StatusTone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        style={style}
        className={cn("shrink-0 rounded-full object-cover", className)}
        unoptimized={!src.includes(".supabase.co")}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800", className)}
    >
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-slate-200", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-white px-6 py-12 text-center">
      <div className="text-brand-700">{icon ?? <Inbox className="size-10" aria-hidden />}</div>
      <p className="text-lg font-bold">{title}</p>
      {description && <p className="max-w-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: React.ReactNode;
}) {
  const map = {
    info: "border-info-700/30 bg-info-50 text-info-700",
    success: "border-success-700/30 bg-success-50 text-success-700",
    warning: "border-caution-700/30 bg-caution-50 text-caution-700",
    danger: "border-danger-700/30 bg-danger-50 text-danger-700",
  } as const;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-2xl border p-4 text-sm", map[tone])}>
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1).replace(".", ",")} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("size-4", i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
      ))}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
