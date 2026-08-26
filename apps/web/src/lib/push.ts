/** Web Push subscription helpers for the shop owner PWA (AUC-21). */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export const PUSH_SUPPORTED =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

export const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY) && PUSH_SUPPORTED;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!PUSH_SUPPORTED) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** Prompts for notification permission and subscribes this device to Web Push. */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!VAPID_PUBLIC_KEY) throw new Error("Push notifications are not configured");

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied");

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    // TS 5.7's generic TypedArray types don't structurally match `BufferSource`
    // here even though this is a plain Uint8Array at runtime — cast through.
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });
}

export async function unsubscribeFromPush(subscription: PushSubscription): Promise<void> {
  await subscription.unsubscribe();
}
