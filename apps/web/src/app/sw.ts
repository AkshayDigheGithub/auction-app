import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry } from "serwist";

// Typed via a local cast rather than the DOM `ServiceWorkerGlobalScope` lib —
// pulling in the "webworker" lib here would conflict with this project's
// "dom" lib (both declare a differently-shaped global `self`).
const swSelf = self as unknown as { __SW_MANIFEST: (PrecacheEntry | string)[] | undefined };

const serwist = new Serwist({
  precacheEntries: swSelf.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Web Push for shop owners on new nearby requests (AUC-21). Cast separately
// from `swSelf` above — merging these into one object type confuses
// @serwist/next's build-time scan for the `__SW_MANIFEST` injection point.
interface PushEventLike {
  data: { json(): { title?: string; body?: string; url?: string } } | null;
  waitUntil(promise: Promise<unknown>): void;
}
interface NotificationClickEventLike {
  notification: { close(): void; data?: { url?: string } };
  waitUntil(promise: Promise<unknown>): void;
}
const pushSelf = self as unknown as {
  addEventListener(type: "push", listener: (event: PushEventLike) => void): void;
  addEventListener(type: "notificationclick", listener: (event: NotificationClickEventLike) => void): void;
  registration: { showNotification(title: string, options?: Record<string, unknown>): Promise<void> };
  clients: { openWindow(url: string): Promise<unknown> };
};

pushSelf.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    pushSelf.registration.showNotification(data.title ?? "New request nearby", {
      body: data.body,
      icon: "/icon-192.png",
      data: { url: data.url ?? "/nearby" },
    }),
  );
});

pushSelf.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(pushSelf.clients.openWindow(event.notification.data?.url ?? "/nearby"));
});
