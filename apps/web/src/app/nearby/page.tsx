"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useRequireRole } from "@/lib/use-require-role";
import { getExistingSubscription, PUSH_ENABLED, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { EmptyState, ghostButtonClass, InfoBanner, LoadingScreen, primaryButtonClass } from "@/components/ui";

interface Shop {
  id: string;
  latitude: number;
  longitude: number;
}

interface NearbyRequest {
  id: string;
  product_name: string;
  description: string | null;
  area_text: string;
  distance_meters: number;
}

export default function NearbyRequestsPage() {
  const { ready, user } = useRequireRole("shop_owner");

  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [requests, setRequests] = useState<NearbyRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [bidForms, setBidForms] = useState<Record<string, { price: string; note: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    api
      .get<Shop>("/shops/me")
      .then(setShop)
      .catch(() => setNeedsOnboarding(true))
      .finally(() => setShopLoading(false));
  }, [ready, user]);

  useEffect(() => {
    if (!shop || !PUSH_ENABLED) return;
    getExistingSubscription()
      .then((sub) => setPushSubscribed(!!sub))
      .catch(() => setPushSubscribed(false));
  }, [shop]);

  async function enablePush() {
    setPushBusy(true);
    setMessage(null);
    try {
      const sub = await subscribeToPush();
      const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.post("/shops/me/push-subscription", { endpoint, keys });
      setPushSubscribed(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not enable notifications");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const sub = await getExistingSubscription();
      if (sub) {
        await api.delete("/shops/me/push-subscription", { endpoint: sub.endpoint });
        await unsubscribeFromPush(sub);
      }
      setPushSubscribed(false);
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (!shop) return;

    api
      .get<NearbyRequest[]>(`/requests/nearby?latitude=${shop.latitude}&longitude=${shop.longitude}`)
      .then(setRequests)
      .catch(() => {})
      .finally(() => setRequestsLoading(false));

    const socket = getSocket();
    socket.emit("join-shop", shop.id);
    const onNearby = (req: { id: string; productName: string; description: string | null; areaText: string }) => {
      setRequests((prev) => [
        {
          id: req.id,
          product_name: req.productName,
          description: req.description,
          area_text: req.areaText,
          distance_meters: 0,
        },
        ...prev,
      ]);
    };
    socket.on("request:nearby", onNearby);
    return () => {
      socket.off("request:nearby", onNearby);
    };
  }, [shop]);

  async function submitBid(requestId: string) {
    const form = bidForms[requestId];
    if (!form?.price) return;
    setSubmitting(requestId);
    setMessage(null);
    try {
      await api.post(`/requests/${requestId}/bids`, { price: Number(form.price), note: form.note || undefined });
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setMessage("Bid submitted!");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not submit bid");
    } finally {
      setSubmitting(null);
    }
  }

  if (!ready || !user || shopLoading) return <LoadingScreen />;

  if (needsOnboarding) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        <div className="text-3xl">🏬</div>
        <p className="max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
          Set up your shop profile to start seeing nearby requests.
        </p>
        <Link href="/onboard" className={primaryButtonClass}>
          Complete shop profile
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Nearby requests</h1>
        <Link href="/scan" className="text-sm text-orange-600 underline underline-offset-2 dark:text-orange-400">
          Scan QR
        </Link>
      </header>

      {PUSH_ENABLED && pushSubscribed === false && (
        <InfoBanner tone="orange">
          <span className="flex items-center justify-between gap-3">
            🔔 Get notified about new requests even when the app is closed.
            <button onClick={enablePush} disabled={pushBusy} className={`${ghostButtonClass} whitespace-nowrap`}>
              {pushBusy ? "Enabling…" : "Enable"}
            </button>
          </span>
        </InfoBanner>
      )}
      {PUSH_ENABLED && pushSubscribed === true && (
        <span className="flex w-fit items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
          🔔 Notifications on
          <button onClick={disablePush} disabled={pushBusy} className="underline decoration-dotted underline-offset-2">
            Turn off
          </button>
        </span>
      )}

      {message && <InfoBanner tone="green">{message}</InfoBanner>}

      {requestsLoading ? (
        <LoadingScreen label="Looking for nearby requests…" />
      ) : requests.length === 0 ? (
        <EmptyState
          icon="🔎"
          title="No open requests near you right now"
          hint="New requests posted nearby will appear here instantly."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{r.product_name}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {r.area_text} · {(r.distance_meters / 1000).toFixed(1)} km away
              </p>
              {r.description && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{r.description}</p>}

              <div className="mt-3 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Note for the customer (optional)"
                  value={bidForms[r.id]?.note ?? ""}
                  onChange={(e) =>
                    setBidForms((prev) => ({ ...prev, [r.id]: { ...prev[r.id], note: e.target.value } }))
                  }
                  className="min-w-0 rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm text-neutral-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="₹ price"
                    value={bidForms[r.id]?.price ?? ""}
                    onChange={(e) =>
                      setBidForms((prev) => ({ ...prev, [r.id]: { ...prev[r.id], price: e.target.value } }))
                    }
                    className="w-28 min-w-0 rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm text-neutral-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                  <button
                    onClick={() => submitBid(r.id)}
                    disabled={submitting === r.id || !bidForms[r.id]?.price}
                    className="flex-1 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white transition active:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting === r.id ? "Submitting…" : "Submit bid"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
