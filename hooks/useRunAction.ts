"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/types";

/** Executa uma Server Action com feedback padronizado (toast) e atualização da tela. */
export function useRunAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lastResult, setLastResult] = useState<ActionResult<unknown> | null>(null);

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, opts: { onSuccess?: (r: ActionResult<T>) => void; refresh?: boolean; silent?: boolean } = {}) => {
      start(async () => {
        const res = await action();
        setLastResult(res);
        if (res.ok) {
          if (res.message && !opts.silent) toast.success(res.message);
          if (opts.refresh !== false) router.refresh();
          opts.onSuccess?.(res);
        } else {
          toast.error(res.message ?? "Não conseguimos concluir esta ação agora. Tente novamente.");
        }
      });
    },
    [router],
  );

  return { run, pending, lastResult };
}
