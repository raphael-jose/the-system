/// <reference lib="webworker" />
/* global self */
// Service worker do SYSTEM (injectManifest):
// 1. Pré-cache de todos os assets — app funciona 100% offline.
// 2. Navegação SPA cai no index.html (subpasta do GitHub Pages incluída).
// 3. Web Push: mostra a notificação mesmo com o app FECHADO.
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

// ---- Offline: pré-cacheia o build inteiro (manifest injetado no build) ----
precacheAndRoute(self.__WB_MANIFEST);

// ---- Atualização automática (registerType: "autoUpdate") ----
// Sem skipWaiting o SW novo fica em "waiting" e o app instalado continua
// servindo o bundle ANTIGO (bug: updates nunca chegam no celular). Com isso,
// o SW novo assume na hora e o autoUpdate recarrega a página.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ---- SPA: qualquer navegação resolve para o index.html (offline) ----
const navHandler = createHandlerBoundToURL(
  new URL("index.html", self.registration.scope).href
);
registerRoute(new NavigationRoute(navHandler));

// ---- Web Push: chega com o app fechado ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* corpo não-JSON: usa padrões */
  }
  // ícone resolve contra o escopo do SW — funciona na raiz E em /the-system/
  const icon = new URL("icons/icon-192.png", self.registration.scope).href;
  const url = data.url || self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || "SYSTEM", {
      body: data.body || "O Sistema observa.",
      icon,
      badge: icon,
      tag: data.tag || "system",
      renotify: true,
      data: { url },
    })
  );
});

// Tocar na notificação abre (ou foca) o app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        try {
          if (client.url.startsWith(new URL(url).origin)) {
            await client.navigate(url);
            await client.focus();
            return;
          }
        } catch {
          /* cliente indisponível — segue para abrir janela */
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
