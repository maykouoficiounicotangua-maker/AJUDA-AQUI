"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useRunAction } from "@/hooks/useRunAction";
import { toggleFavoriteAction } from "@/app/actions/social";
import { cn } from "@/lib/utils/cn";

export function FavoriteButton({ type, id, initial, label = "Favoritar" }: { type: "REQUEST" | "CATEGORY" | "USER"; id: string; initial: boolean; label?: string }) {
  const [fav, setFav] = useState(initial);
  const { run, pending } = useRunAction();
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? `Remover dos favoritos` : label}
      disabled={pending}
      onClick={() => run(() => toggleFavoriteAction(type, id), { refresh: false, onSuccess: (r) => setFav(Boolean(r.data?.favorited)) })}
      className="grid size-11 place-items-center rounded-full border border-line bg-white hover:bg-slate-50 disabled:opacity-50"
    >
      <Heart className={cn("size-5", fav ? "fill-danger-600 text-danger-600" : "text-ink-muted")} aria-hidden />
    </button>
  );
}
