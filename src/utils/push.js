// Web Push — notificações que chegam com o app FECHADO.
// O navegador não deixa agendar notificação local sem o app aberto; o
// mecanismo certo é o Push API: o celular recebe via serviço de push e o
// service worker (src/sw.js) mostra a notificação mesmo com o app morto.
// O "servidor" que dispara no horário é o GitHub Actions
// (.github/workflows/push-reminders.yml) — sem backend externo.
import { VAPID_PUBLIC_KEY } from "../config";

/** Navegador tem service worker + PushManager? (Chrome/Edge/Android/iOS 16.4+) */
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** O app tem a chave VAPID pública configurada (src/config.js)? */
export function vapidConfigured() {
  return typeof VAPID_PUBLIC_KEY === "string" && VAPID_PUBLIC_KEY.length > 0;
}

/**
 * Converte uma chave VAPID base64url (applicationServerKey) no formato que
 * o PushManager.subscribe exige (Uint8Array).
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Estado do push para a UI: unsupported | unconfigured | denied | active | inactive */
export function pushStatus() {
  if (!pushSupported()) return "unsupported";
  if (!vapidConfigured()) return "unconfigured";
  if (!("Notification" in window) || window.Notification.permission === "denied")
    return "denied";
  return "inactive"; // se há inscrição ativa, use isSubscribed()
}

/** O usuário já tem uma inscrição de push ativa neste navegador? */
export async function isSubscribed() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/**
 * Ativa o push: pede permissão de notificação (se preciso) e inscreve o
 * aparelho. Retorna a PushSubscription. Lança Error com mensagem amigável.
 */
export async function subscribePush() {
  if (!pushSupported())
    throw new Error("Web Push não é suportado neste navegador.");
  if (!vapidConfigured())
    throw new Error(
      "Chave VAPID pública não configurada — veja src/config.js e PUSH_SETUP.md."
    );
  if (!("Notification" in window) || window.Notification.permission === "denied")
    throw new Error(
      "Permissão de notificação negada — libere nas configurações. iPhone: Ajustes → SYSTEM → Notificações. Android: Configurações do site → Notificações → Permitir."
    );
  if (window.Notification.permission !== "granted") {
    const p = await window.Notification.requestPermission();
    if (p !== "granted")
      throw new Error(
        "Permissão de notificação negada — libere nas configurações. iPhone: Ajustes → SYSTEM → Notificações. Android: Configurações do site → Notificações → Permitir."
      );
  }
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

/** Desativa o push: remove a inscrição do aparelho. */
export async function unsubscribePush() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;
  return sub.unsubscribe();
}

/**
 * Exporta a inscrição como JSON (endpoint + chaves). É este JSON que vai
 * para o secret PUSH_SUBSCRIPTION do GitHub — o workflow usa para enviar.
 */
export async function getSubscriptionJson() {
  const sub = await subscribePush(); // garante inscrição ativa
  const json = sub.toJSON();
  return JSON.stringify(
    {
      endpoint: json.endpoint,
      expirationTime: json.expirationTime ?? null,
      keys: json.keys,
    },
    null,
    2
  );
}
