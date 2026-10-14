import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-center text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none";

const variants = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  warm: "bg-warm-600 text-white hover:bg-warm-700",
  secondary: "bg-white text-ink border border-line hover:bg-slate-50",
  ghost: "text-ink-muted hover:bg-slate-100",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
  dangerOutline: "border border-danger-600 text-danger-700 hover:bg-danger-50 bg-white",
} as const;

const sizes = { md: "", sm: "min-h-10 rounded-xl px-4 text-sm", lg: "min-h-14 px-6 text-lg" } as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function buttonClasses({ variant = "primary", size = "md", className }: Common) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  loading,
  children,
  disabled,
  type = "button",
  ...props
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: Common & React.ComponentProps<typeof Link>) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
