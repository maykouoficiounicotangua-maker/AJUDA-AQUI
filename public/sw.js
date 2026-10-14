/* AJUDA AQUI — Service Worker (Web Push / VAPID)
 * Responsabilidades: receber push, exibir a notificação e abrir a página certa no clique.
 * Não faz cache de páginas (dados são privados e dinâmicos). */

const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/badge-72.png";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** Aceita somente caminhos internos (anti open-redirect). */
function safeUrl(url) {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) {
    return "/notificacoes";
  }
  return url;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Ajuda Aqui";
  const options = {
    body: data.body || "",
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,
    tag: data.tag || undefined,
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 1) : [],
    data: { url: safeUrl(data.url), notificationId: data.notificationId || null, type: data.type || null },
  };

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Se o usuário já está olhando o app (aba visível e focada), o toast em tempo real cobre — evita duplicar.
      const focused = windows.some((c) => c.visibilityState === "visible" && c.focused);
      if (focused) {
        windows.forEach((c) => c.postMessage({ type: "PUSH_RECEIVED", notificationId: options.data.notificationId }));
        return;
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safeUrl(event.notification.data && event.notification.data.url), self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reutiliza uma aba existente do app, quando houver
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              await self.clients.openWindow(target);
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/** O navegador pode renovar/invalidar a assinatura; tentamos reassinar e avisar o servidor. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const old = event.oldSubscription;
        const key = old && old.options && old.options.applicationServerKey;
        if (!key) return;
        const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        /* sem sessão ativa: o app reassina no próximo acesso */
      }
    })(),
  );
});
