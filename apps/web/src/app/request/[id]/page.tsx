"use client";

import { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useRequireRole } from "@/lib/use-require-role";
import { EmptyState, ErrorBanner, InfoBanner, LoadingScreen, Spinner } from "@/components/ui";

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
  /**
   * A request id that does not resolve is a genuine 404, but nothing here is
   * server-rendered, so Next's router never sees it — the old `.catch(() => {})`
   * swallowed the failure and left the page on its loading spinner forever.
   * The API returns 404 both for an id that does not exist and for one that
   * belongs to somebody else, so this covers a stale link and a shared link
   * alike.
   */
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!ready || !user || !id) return;

    api
      .get<RequestDetail>(`/requests/${id}`)
      .then(setRequest)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) setMissing(true);
      });
    // Bids are secondary: if only this call fails the page is still usable, so
    // it must not be what decides the request is missing.
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

  // Rendering `notFound()` hands off to app/not-found.tsx, which knows how to
  // route each role back somewhere useful.
  if (missing) notFound();
  if (!ready || !user || !request) return <LoadingScreen />;

  const lowestPrice = bids.length ? Math.min(...bids.map((b) => Number(b.price))) : null;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{request.productName}</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{request.areaText}</p>
        {request.description && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{request.description}</p>}
      </header>

      {request.status !== "open" ? (
        <InfoBanner tone="amber">This request is {request.status} — bidding is closed.</InfoBanner>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {bids.length === 0 && <Spinner className="h-3.5 w-3.5" />}
            {bids.length === 0 ? "Waiting for bids…" : `${bids.length} bid${bids.length === 1 ? "" : "s"} — lowest price first`}
          </h2>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          {bids.length === 0 ? (
            <EmptyState
              icon="⏳"
              title="No bids yet"
              hint="Nearby shops are being notified. Bids will appear here live as they come in."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {bids.map((bid) => (
                <li
                  key={bid.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    Number(bid.price) === lowestPrice
                      ? "border-orange-300 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-950/20"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {bid.shop.shopName} {bid.shop.verified && <span title="Verified shop">✅</span>}
                    </p>
                    {bid.note && <p className="text-xs text-neutral-500 dark:text-neutral-400">{bid.note}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      ₹{Number(bid.price).toLocaleString("en-IN")}
                    </span>
                    <button
                      onClick={() => lockBid(bid.id)}
                      disabled={locking !== null}
                      className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white transition active:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {locking === bid.id ? "Locking…" : "Choose"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
