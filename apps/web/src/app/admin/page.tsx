"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { Badge, EmptyState, LoadingScreen } from "@/components/ui";

interface Shop {
  id: string;
  shopName: string;
  address: string;
  verified: boolean;
}

interface RequestRow {
  id: string;
  productName: string;
  status: string;
  createdAt: string;
  bids: { id: string }[];
}

interface DealRow {
  id: string;
  finalPrice: string;
  commissionAmount: string | null;
  commissionStatus: string;
  qrStatus: string;
  shop: { shopName: string };
}

interface Revenue {
  totalCommissionPaid: string;
  paidDealsCount: number;
}

export default function AdminPage() {
  const { ready, user } = useRequireRole("admin");
  const [tab, setTab] = useState<"requests" | "deals" | "shops">("requests");
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [deals, setDeals] = useState<DealRow[] | null>(null);
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    api.get<RequestRow[]>("/admin/requests").then(setRequests).catch(() => setRequests([]));
    api.get<DealRow[]>("/admin/deals").then(setDeals).catch(() => setDeals([]));
    api.get<Shop[]>("/admin/shops").then(setShops).catch(() => setShops([]));
    api.get<Revenue>("/admin/revenue").then(setRevenue).catch(() => {});
  }, [ready, user]);

  async function toggleVerified(shop: Shop) {
    const updated = await api.put<Shop>(`/admin/shops/${shop.id}/verify`, { verified: !shop.verified });
    setShops((prev) => prev?.map((s) => (s.id === shop.id ? updated : s)) ?? prev);
  }

  if (!ready || !user) return <LoadingScreen />;

  const TAB_LABEL: Record<typeof tab, string> = { requests: "Requests", deals: "Deals", shops: "Shops" };

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Admin</h1>

      <div className="rounded-lg bg-orange-50 px-4 py-3 text-sm dark:bg-orange-950/30">
        {revenue ? (
          <>
            <p className="text-lg font-semibold text-orange-700 dark:text-orange-300">
              ₹{Number(revenue.totalCommissionPaid).toLocaleString("en-IN")}
            </p>
            <p className="text-orange-600 dark:text-orange-400">
              commission collected · {revenue.paidDealsCount} completed deal{revenue.paidDealsCount === 1 ? "" : "s"}
            </p>
          </>
        ) : (
          <p className="text-orange-600 dark:text-orange-400">Loading revenue…</p>
        )}
      </div>

      <nav className="flex gap-2 text-sm">
        {(["requests", "deals", "shops"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 font-medium transition ${
              tab === t
                ? "bg-orange-600 text-white"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {tab === "requests" &&
        (requests === null ? (
          <LoadingScreen label="Loading requests…" />
        ) : requests.length === 0 ? (
          <EmptyState title="No requests yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800">
                <div className="flex justify-between">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{r.productName}</span>
                  <Badge>{r.status}</Badge>
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">{r.bids.length} bids</p>
              </li>
            ))}
          </ul>
        ))}

      {tab === "deals" &&
        (deals === null ? (
          <LoadingScreen label="Loading deals…" />
        ) : deals.length === 0 ? (
          <EmptyState title="No deals yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {deals.map((d) => (
              <li key={d.id} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800">
                <div className="flex justify-between">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{d.shop.shopName}</span>
                  <span className="text-neutral-900 dark:text-neutral-100">
                    ₹{Number(d.finalPrice).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  QR: {d.qrStatus} · Commission: {d.commissionStatus}
                  {d.commissionAmount ? ` (₹${Number(d.commissionAmount).toFixed(2)})` : ""}
                </p>
              </li>
            ))}
          </ul>
        ))}

      {tab === "shops" &&
        (shops === null ? (
          <LoadingScreen label="Loading shops…" />
        ) : shops.length === 0 ? (
          <EmptyState title="No shops yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {shops.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800"
              >
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{s.shopName}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{s.address}</p>
                </div>
                <button
                  onClick={() => toggleVerified(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    s.verified
                      ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                      : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {s.verified ? "✅ Verified" : "Verify"}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
