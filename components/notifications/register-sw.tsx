"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/push/client";

/** Registra o Service Worker (PWA/Push) silenciosamente. NÃO pede permissão de notificação. */
export function RegisterServiceWorker() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
