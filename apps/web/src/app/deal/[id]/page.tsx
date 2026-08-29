"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useRequireRole } from "@/lib/use-require-role";
import { ErrorBanner, ghostButtonClass, inputClass, LoadingScreen, primaryButtonClass } from "@/components/ui";
import { DisputePanel } from "@/components/dispute-panel";

interface Deal {
  id: string;
  requestId: string;
  finalPrice: string;
  qrStatus: "pending" | "scanned" | "confirmed";
  shop: { shopName: string; address: string };
  /** True while the customer can still report that they didn't buy (AUC-54). */
  canReport?: boolean;
  reversal?: { status: string } | null;
}

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, user } = useRequireRole("customer");

  const [deal, setDeal] = useState<Deal | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Neither fetch below used to have a `.catch()`, so a deal id that no longer
   * resolves produced an unhandled rejection and left this screen stuck on
   * "Preparing your QR code…" — the worst place to strand someone, since a
   * customer hits it standing in the shop.
   */
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!ready || !user || !id) return;

    // The QR is allowed to fail on its own — a deal that is already confirmed
    // has no code left to show — so it must not be what marks the deal missing.
    api
      .get<{ dataUrl: string; deal: Deal }>(`/deals/${id}/qr`)
      .then((res) => {
        setDeal(res.deal);
        setQrDataUrl(res.dataUrl);
      })
      .catch(() => {});

    const socket = getSocket();
    const onCompleted = () => api.get<Deal>(`/deals/${id}`).then(setDeal).catch(() => {});

    api
      .get<Deal>(`/deals/${id}`)
      .then((d) => {
        setDeal(d);
        socket.emit("join-request", d.requestId);
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) setMissing(true);
      });
    socket.on("deal:completed", onCompleted);

    return () => {
      socket.off("deal:completed", onCompleted);
    };
  }, [ready, user, id]);

  async function submitReport() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/deals/${id}/report-no-purchase`, { reason });
      const updated = await api.get<Deal>(`/deals/${id}`);
      setDeal(updated);
      setReporting(false);
      setReason("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your report");
    } finally {
      setBusy(false);
    }
  }

  if (missing) notFound();
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

          {/* Reporting is what keeps lock-time billing fair to the shop: without
              it, a shop pays for a customer who never turned up. */}
          <div className="w-full max-w-sm border-t border-neutral-100 pt-5 dark:border-neutral-800">
            {deal.reversal ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Thanks — you told us you didn&apos;t buy from this shop. Nothing more to do.
              </p>
            ) : deal.canReport ? (
              reporting ? (
                <div className="flex flex-col gap-2 text-left">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    What happened?
                    <input
                      className={`${inputClass} mt-1.5`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Shop was closed / price was different"
                      autoFocus
                    />
                  </label>
                  {error && <ErrorBanner>{error}</ErrorBanner>}
                  <div className="flex gap-2">
                    <button
                      className={`${primaryButtonClass} flex-1`}
                      onClick={submitReport}
                      disabled={busy || reason.trim().length < 3}
                    >
                      {busy ? "Sending…" : "Send"}
                    </button>
                    <button className={ghostButtonClass} onClick={() => setReporting(false)} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="text-sm text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
                  onClick={() => setReporting(true)}
                >
                  I didn&apos;t buy from this shop
                </button>
              )
            ) : null}
          </div>
        </>
      )}

      {/* Conduct complaints stay available after confirmation too: a shop can
          scan the QR and still have charged more than it bid (AUC-34). */}
      <div className="w-full max-w-sm border-t border-neutral-100 pt-5 dark:border-neutral-800">
        <DisputePanel dealId={id} />
      </div>
    </main>
  );
}
