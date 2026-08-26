"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { ErrorBanner, ghostButtonClass, inputClass, labelClass, LoadingScreen, primaryButtonClass, Spinner } from "@/components/ui";

interface CreatedRequest {
  id: string;
}

export default function NewRequestPage() {
  const { ready, user } = useRequireRole("customer");
  const router = useRouter();

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [areaText, setAreaText] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        if (!areaText) setAreaText("Current location");
        setLocating(false);
      },
      () => {
        setError("Could not get your location — enter your area manually instead.");
        setLocating(false);
      },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const request = await api.post<CreatedRequest>("/requests", {
        productName,
        description: description || undefined,
        areaText,
        ...coords,
      });
      router.push(`/request/${request.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post request");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !user) return <LoadingScreen />;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">What do you want to buy?</h1>
        <Link href="/request/mine" className="text-sm text-orange-600 underline underline-offset-2 dark:text-orange-400">
          My requests
        </Link>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className={labelClass}>
          Product
          <input
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="iPhone 15, 128GB"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Details (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sealed box, any colour"
            className={inputClass}
            rows={2}
          />
        </label>

        <label className={labelClass}>
          Area
          <div className="flex gap-2">
            <input
              required
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              placeholder="Koramangala, Bengaluru"
              className={`flex-1 ${inputClass}`}
            />
            <button type="button" onClick={useMyLocation} disabled={locating} className={`${ghostButtonClass} whitespace-nowrap`}>
              {locating ? "Locating…" : coords ? "📍 Got it" : "Use my location"}
            </button>
          </div>
          {!coords && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              No location shared — we&apos;ll estimate it from the area text you typed.
            </p>
          )}
        </label>

        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button type="submit" disabled={loading} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Posting…" : "Post request"}
        </button>
      </form>
    </main>
  );
}
