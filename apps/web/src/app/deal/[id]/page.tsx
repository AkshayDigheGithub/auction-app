"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useRequireRole } from "@/lib/use-require-role";
import { LoadingScreen } from "@/components/ui";

interface Deal {
  id: string;
  requestId: string;
  finalPrice: string;
  qrStatus: "pending" | "scanned" | "confirmed";
  shop: { shopName: string; address: string };
}

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, user } = useRequireRole("customer");

  const [deal, setDeal] = useState<Deal | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user || !id) return;

    api.get<{ dataUrl: string; deal: Deal }>(`/deals/${id}/qr`).then((res) => {
      setDeal(res.deal);
      setQrDataUrl(res.dataUrl);
    });

    const socket = getSocket();
    const onCompleted = () => api.get<Deal>(`/deals/${id}`).then(setDeal);

    api.get<Deal>(`/deals/${id}`).then((d) => {
      setDeal(d);
      socket.emit("join-request", d.requestId);
    });
    socket.on("deal:completed", onCompleted);

    return () => {
      socket.off("deal:completed", onCompleted);
    };
  }, [ready, user, id]);

  if (!ready || !user || !deal) return <LoadingScreen label="Preparing your QR code…" />;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-6 py-8 text-center">
      {deal.qrStatus === "confirmed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-4xl dark:bg-green-950/50">
            ✅
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Deal confirmed!</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            The shop has scanned your code. Enjoy your purchase.
          </p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Show this at the shop</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {deal.shop.shopName} · {deal.shop.address}
            </p>
          </div>
          {qrDataUrl && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Deal QR code" className="h-56 w-56" />
            </div>
          )}
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            ₹{Number(deal.finalPrice).toLocaleString("en-IN")}
          </p>
          <p className="max-w-[16rem] text-xs text-neutral-400 dark:text-neutral-500">
            The shop owner scans this to confirm your deal. This page will update automatically once scanned.
          </p>
        </>
      )}
    </main>
  );
}
