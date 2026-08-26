"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";

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
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    api.get<RequestRow[]>("/admin/requests").then(setRequests).catch(() => {});
    api.get<DealRow[]>("/admin/deals").then(setDeals).catch(() => {});
    api.get<Shop[]>("/admin/shops").then(setShops).catch(() => {});
    api.get<Revenue>("/admin/revenue").then(setRevenue).catch(() => {});
  }, [ready, user]);

  async function toggleVerified(shop: Shop) {
    const updated = await api.put<Shop>(`/admin/shops/${shop.id}/verify`, { verified: !shop.verified });
    setShops((prev) => prev.map((s) => (s.id === shop.id ? updated : s)));
  }

  if (!ready || !user) return null;

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <h1 className="text-xl font-bold">Admin</h1>

      {revenue && (
        <div className="rounded-lg bg-orange-50 px-4 py-3 text-sm">
          <p className="font-semibold text-orange-700">
            ₹{Number(revenue.totalCommissionPaid).toLocaleString("en-IN")} commission collected
          </p>
          <p className="text-orange-600">{revenue.paidDealsCount} completed deals</p>
        </div>
      )}

      <nav className="flex gap-2 text-sm">
        {(["requests", "deals", "shops"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 ${tab === t ? "bg-orange-600 text-white" : "bg-neutral-100 text-neutral-600"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "requests" && (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{r.productName}</span>
                <span className="text-neutral-500">{r.status}</span>
              </div>
              <p className="text-xs text-neutral-400">{r.bids.length} bids</p>
            </li>
          ))}
        </ul>
      )}

      {tab === "deals" && (
        <ul className="flex flex-col gap-2">
          {deals.map((d) => (
            <li key={d.id} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{d.shop.shopName}</span>
                <span>₹{Number(d.finalPrice).toLocaleString("en-IN")}</span>
              </div>
              <p className="text-xs text-neutral-400">
                QR: {d.qrStatus} · Commission: {d.commissionStatus}
                {d.commissionAmount ? ` (₹${Number(d.commissionAmount).toFixed(2)})` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {tab === "shops" && (
        <ul className="flex flex-col gap-2">
          {shops.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-2 text-sm">
              <div>
                <p className="font-medium">{s.shopName}</p>
                <p className="text-xs text-neutral-400">{s.address}</p>
              </div>
              <button
                onClick={() => toggleVerified(s)}
                className={`rounded-full px-3 py-1 text-xs ${
                  s.verified ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {s.verified ? "✅ Verified" : "Verify"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
