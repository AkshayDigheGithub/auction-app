"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";

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

  if (!ready || !user) return null;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-xl font-bold">Scan customer&apos;s QR</h1>

      <div id={READER_ID} className="w-full overflow-hidden rounded-xl" />
      {!scanning && <p className="text-sm text-neutral-500">Starting camera…</p>}

      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            result.status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}
    </main>
  );
}
