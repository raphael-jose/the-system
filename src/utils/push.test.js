import { describe, it, expect, vi, afterEach } from "vitest";

// Chave VAPID em formato válido (base64url) — a real fica em src/config.js
const KEY =
  "BNAdhnbVzhsWUee2DCbTnN4AoMu1AghOWL8AdRx7X1NUYDteTGukyKYLg2-28moubIufWtnBMdfQc_52r2Ah_oc";
vi.mock("../config", () => ({
  VAPID_PUBLIC_KEY:
    "BNAdhnbVzhsWUee2DCbTnN4AoMu1AghOWL8AdRx7X1NUYDteTGukyKYLg2-28moubIufWtnBMdfQc_52r2Ah_oc",
}));

import {
  pushSupported,
  vapidConfigured,
  urlBase64ToUint8Array,
  pushStatus,
  subscribePush,
  getSubscriptionJson,
  isSubscribed,
} from "./push";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Web Push helpers", () => {
  it("urlBase64ToUint8Array converte a chave VAPID corretamente", () => {
    expect(Array.from(urlBase64ToUint8Array("AAE="))).toEqual([0, 1]);
    const u8 = urlBase64ToUint8Array(KEY);
    expect(u8.length).toBe(65); // 0x04 + 64 bytes da chave pública
    expect(u8[0]).toBe(4);
  });

  it("pushSupported: false sem service worker ou PushManager", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", {});
    expect(pushSupported()).toBe(false);

    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("window", {});
    expect(pushSupported()).toBe(false);
  });

  it("pushSupported: true com serviceWorker + PushManager", () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("window", { PushManager: {} });
    expect(pushSupported()).toBe(true);
  });

  it("vapidConfigured: true com a chave configurada", () => {
    expect(vapidConfigured()).toBe(true);
  });

  it("pushStatus: inactive com suporte + chave + permissão", () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("window", { PushManager: {}, Notification: { permission: "granted" } });
    expect(pushStatus()).toBe("inactive");
  });

  it("pushStatus: unsupported sem suporte", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", {});
    expect(pushStatus()).toBe("unsupported");
  });
});

describe("inscrição de push (APIs mockadas)", () => {
  function mockBrowser(sub = null) {
    const subscribe = vi.fn(async () => ({
      toJSON: () => ({
        endpoint: "https://fcm.example.com/send/abc",
        expirationTime: null,
        keys: { p256dh: "p256dh-b64", auth: "auth-b64" },
      }),
    }));
    const getSubscription = vi.fn(async () => sub);
    const pushManager = { getSubscription, subscribe };
    vi.stubGlobal("navigator", {
      serviceWorker: {
        ready: Promise.resolve({ pushManager }),
        getRegistration: vi.fn(async () => ({ pushManager })),
      },
    });
    vi.stubGlobal("window", {
      PushManager: {},
      Notification: { permission: "granted" },
    });
    return { subscribe, getSubscription };
  }

  it("subscribePush inscreve com userVisibleOnly + chave VAPID decodificada", async () => {
    const { subscribe } = mockBrowser();
    const sub = await subscribePush();
    expect(sub.toJSON().endpoint).toContain("fcm.example.com");
    const opts = subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect(opts.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(opts.applicationServerKey.length).toBe(65);
  });

  it("subscribePush reutiliza inscrição existente (sem duplicar)", async () => {
    const existing = { toJSON: () => ({ endpoint: "já-inscrito" }) };
    const { subscribe } = mockBrowser(existing);
    const sub = await subscribePush();
    expect(sub).toBe(existing);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("getSubscriptionJson exporta endpoint + chaves no formato do workflow", async () => {
    mockBrowser();
    const json = JSON.parse(await getSubscriptionJson());
    expect(json.endpoint).toBe("https://fcm.example.com/send/abc");
    expect(json.keys.p256dh).toBe("p256dh-b64");
    expect(json.keys.auth).toBe("auth-b64");
  });

  it("isSubscribed: true só quando há inscrição ativa", async () => {
    mockBrowser(null);
    expect(await isSubscribed()).toBe(false);
    mockBrowser({ toJSON: () => ({}) });
    expect(await isSubscribed()).toBe(true);
  });
});

describe("config vazia (chave VAPID não configurada)", () => {
  it("pushStatus retorna unconfigured", async () => {
    vi.resetModules();
    vi.doMock("../config", () => ({ VAPID_PUBLIC_KEY: "" }));
    const mod = await import("./push");
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("window", { PushManager: {} });
    expect(mod.pushStatus()).toBe("unconfigured");
  });
});
