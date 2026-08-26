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
