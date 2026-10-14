import Link from "next/link";
import { HandHeart } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Logo({ className, href = "/", tagline = false }: { className?: string; href?: string; tagline?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Ajuda Aqui — página inicial">
      <span className="grid size-10 place-items-center rounded-2xl bg-brand-700 text-white">
        <HandHeart className="size-6" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-extrabold tracking-tight">Ajuda Aqui</span>
        {tagline && <span className="block text-xs text-ink-muted">Pessoas ajudando pessoas.</span>}
      </span>
    </Link>
  );
}
