"use client";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

const control =
  "w-full rounded-2xl border border-line bg-white px-4 text-base text-ink placeholder:text-slate-400 disabled:bg-slate-100 aria-[invalid=true]:border-danger-600";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, "min-h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-28 py-3", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(control, "min-h-12", className)} {...props}>
      {children}
    </select>
  );
});

/** Rótulo + controle + dica + erro, com ids associados (acessibilidade). */
export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (a11y: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-danger-600" aria-hidden> *</span>}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-ink-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger-700">{error}</p>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block font-semibold text-ink">{label}</label>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-brand-700" : "bg-slate-300",
        )}
      >
        <span className="sr-only">{checked ? "Ativado" : "Desativado"}</span>
        <span
          aria-hidden
          className={cn("absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform", checked && "translate-x-6")}
        />
      </button>
    </div>
  );
}
