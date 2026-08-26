"use client";

import { useEffect } from "react";

/** Registers the PWA service worker so offline caching and Web Push (AUC-21) actually activate. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
