"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useRequireRole } from "@/lib/use-require-role";

interface RequestDetail {
  id: string;
  productName: string;
  description: string | null;
  areaText: string;
  status: "open" | "locked" | "completed" | "cancelled";
}

interface Bid {
  id: string;
  price: string;
  note: string | null;
  shop: { shopName: string; verified: boolean };
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, user } = useRequireRole("customer");
  const router = useRouter();

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [locking, setLocking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user || !id) return;

    api.get<RequestDetail>(`/requests/${id}`).then(setRequest).catch(() => {});
    api.get<Bid[]>(`/requests/${id}/bids`).then(setBids).catch(() => {});

    const socket = getSocket();
    socket.emit("join-request", id);

    const onNewBid = (bid: Bid) => setBids((prev) => [...prev, bid].sort((a, b) => Number(a.price) - Number(b.price)));
    const onLocked = () => api.get<RequestDetail>(`/requests/${id}`).then(setRequest).catch(() => {});

    socket.on("bid:new", onNewBid);
    socket.on("deal:locked", onLocked);

    return () => {
      socket.emit("leave-request", id);
      socket.off("bid:new", onNewBid);
      socket.off("deal:locked", onLocked);
    };
  }, [ready, user, id]);

  async function lockBid(bidId: string) {
    setLocking(bidId);
    setError(null);
    try {
      const deal = await api.post<{ id: string }>(`/requests/${id}/lock`, { bidId });
      router.push(`/deal/${deal.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not lock this bid");
      setLocking(null);
    }
  }

  if (!ready || !user || !request) return null;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-xl font-bold">{request.productName}</h1>
        <p className="text-sm text-neutral-500">{request.areaText}</p>
        {request.description && <p className="mt-1 text-sm text-neutral-600">{request.description}</p>}
      </header>

      {request.status !== "open" ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This request is {request.status} — bidding is closed.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-neutral-500">
            {bids.length === 0 ? "Waiting for bids…" : `${bids.length} bid${bids.length === 1 ? "" : "s"}`}
          </h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <ul className="flex flex-col gap-2">
            {bids.map((bid) => (
              <li key={bid.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {bid.shop.shopName} {bid.shop.verified && <span title="Verified">✅</span>}
                  </p>
                  {bid.note && <p className="text-xs text-neutral-500">{bid.note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">₹{Number(bid.price).toLocaleString("en-IN")}</span>
                  <button
                    onClick={() => lockBid(bid.id)}
                    disabled={locking !== null}
                    className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {locking === bid.id ? "Locking…" : "Choose"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
