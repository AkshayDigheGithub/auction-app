"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useRequireRole } from "@/lib/use-require-role";

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

  if (!ready || !user || !deal) return null;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-6 py-8 text-center">
      {deal.qrStatus === "confirmed" ? (
        <div className="flex flex-col items-center gap-3">
          <div className="text-5xl">✅</div>
          <h1 className="text-xl font-bold">Deal confirmed!</h1>
          <p className="text-sm text-neutral-500">The shop has scanned your code. Enjoy your purchase.</p>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-bold">Show this at the shop</h1>
          <p className="text-sm text-neutral-500">
            {deal.shop.shopName} · {deal.shop.address}
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Deal QR code" className="h-64 w-64 rounded-xl border border-neutral-200" />
          )}
          <p className="text-lg font-semibold">₹{Number(deal.finalPrice).toLocaleString("en-IN")}</p>
          <p className="text-xs text-neutral-400">The shop owner scans this to confirm your deal.</p>
        </>
      )}
    </main>
  );
}
