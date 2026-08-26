"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useRequireRole } from "@/lib/use-require-role";

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
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [requests, setRequests] = useState<NearbyRequest[]>([]);
  const [bidForms, setBidForms] = useState<Record<string, { price: string; note: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    api
      .get<Shop>("/shops/me")
      .then(setShop)
      .catch(() => setNeedsOnboarding(true));
  }, [ready, user]);

  useEffect(() => {
    if (!shop) return;

    api
      .get<NearbyRequest[]>(`/requests/nearby?latitude=${shop.latitude}&longitude=${shop.longitude}`)
      .then(setRequests)
      .catch(() => {});

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

  if (!ready || !user) return null;

  if (needsOnboarding) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        <p className="text-sm text-neutral-500">Set up your shop profile to start seeing nearby requests.</p>
        <Link href="/onboard" className="rounded-xl bg-orange-600 px-4 py-3 font-medium text-white">
          Complete shop profile
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Nearby requests</h1>
        <Link href="/scan" className="text-sm text-orange-600 underline">
          Scan QR
        </Link>
      </header>

      {message && <p className="text-sm text-neutral-600">{message}</p>}
      {requests.length === 0 && <p className="text-sm text-neutral-500">No open requests near you right now.</p>}

      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li key={r.id} className="rounded-lg border border-neutral-200 px-4 py-3">
            <p className="font-medium">{r.product_name}</p>
            <p className="text-xs text-neutral-500">
              {r.area_text} · {(r.distance_meters / 1000).toFixed(1)} km away
            </p>
            {r.description && <p className="mt-1 text-sm text-neutral-600">{r.description}</p>}

            <div className="mt-3 flex gap-2">
              <input
                type="number"
                min={1}
                placeholder="₹ price"
                value={bidForms[r.id]?.price ?? ""}
                onChange={(e) =>
                  setBidForms((prev) => ({ ...prev, [r.id]: { ...prev[r.id], price: e.target.value } }))
                }
                className="w-24 rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={bidForms[r.id]?.note ?? ""}
                onChange={(e) =>
                  setBidForms((prev) => ({ ...prev, [r.id]: { ...prev[r.id], note: e.target.value } }))
                }
                className="flex-1 rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              />
              <button
                onClick={() => submitBid(r.id)}
                disabled={submitting === r.id}
                className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Bid
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
