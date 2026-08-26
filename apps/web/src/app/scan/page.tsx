"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { LoadingScreen, Spinner } from "@/components/ui";

interface ScanResult {
  status: "success" | "error";
  message: string;
}

const READER_ID = "qr-reader";

export default function ScanPage() {
  const { ready, user } = useRequireRole("shop_owner");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!ready || !user) return;

    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      scanner = new Html5Qrcode(READER_ID);
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decodedText) => {
            if (busyRef.current) return;
            busyRef.current = true;
            try {
              const deal = await api.post<{ finalPrice: string }>("/deals/scan", { token: decodedText });
              setResult({ status: "success", message: `Confirmed! ₹${Number(deal.finalPrice).toLocaleString("en-IN")}` });
            } catch (err) {
              setResult({ status: "error", message: err instanceof ApiError ? err.message : "Scan failed" });
            } finally {
              setTimeout(() => {
                busyRef.current = false;
              }, 2000);
            }
          },
          () => {
            // per-frame decode failures — expected while camera is searching, ignore.
          },
        )
        .then(() => setScanning(true))
        .catch(() => setResult({ status: "error", message: "Could not access camera" }));
    });

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.stop().catch(() => {});
      }
    };
  }, [ready, user]);

  if (!ready || !user) return <LoadingScreen />;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Scan customer&apos;s QR</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Point the camera at the code shown on the customer&apos;s phone to confirm the deal.
        </p>
      </div>

      <div
        id={READER_ID}
        className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800"
      />
      {!scanning && !result && (
        <p className="flex items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <Spinner className="h-4 w-4" /> Starting camera…
        </p>
      )}

      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            result.status === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
          }`}
          role="status"
        >
          {result.status === "success" ? "✅ " : "⚠️ "}
          {result.message}
        </p>
      )}
    </main>
  );
}
