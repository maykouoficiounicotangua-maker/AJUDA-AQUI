"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCurrentPushSubscription,
  getNotificationPermission,
  isPushSupported,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  type PushPermission,
} from "@/lib/push/client";

interface State {
  ready: boolean;
  supported: boolean;
  configured: boolean;
  permission: PushPermission;
  subscribed: boolean;
  busy: boolean;
  publicKey: string;
}

export function usePushNotifications() {
  const [state, setState] = useState<State>({
    ready: false, supported: false, configured: false, permission: "unsupported", subscribed: false, busy: false, publicKey: "",
  });

  const refresh = useCallback(async () => {
    const supported = isPushSupported();
    if (!supported) {
      setState((s) => ({ ...s, ready: true, supported: false }));
      return;
    }
    await registerServiceWorker();
    let configured = false;
    let publicKey = "";
    try {
      const res = await fetch("/api/push/status", { cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { configured: boolean; publicKey: string | null };
        configured = j.configured;
        publicKey = j.publicKey ?? "";
      }
    } catch {
      /* offline: mantém desativado */
    }
    const sub = await getCurrentPushSubscription();
    setState((s) => ({
      ...s, ready: true, supported, configured, publicKey, permission: getNotificationPermission(), subscribed: !!sub,
    }));
  }, []);

  useEffect(() => {
    // Sincroniza o estado com APIs do navegador (Push/Notification/ServiceWorker): efeito legítimo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setState((s) => ({ ...s, busy: true }));
    const res = await subscribeToPush(state.publicKey);
    await refresh();
    setState((s) => ({ ...s, busy: false }));
    return res;
  }, [state.publicKey, refresh]);

  const disable = useCallback(async () => {
    setState((s) => ({ ...s, busy: true }));
    const ok = await unsubscribeFromPush();
    await refresh();
    setState((s) => ({ ...s, busy: false }));
    return ok;
  }, [refresh]);

  return { ...state, enable, disable, refresh };
}
