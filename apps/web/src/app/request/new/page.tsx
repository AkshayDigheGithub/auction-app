"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";

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

  if (!ready || !user) return null;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">What do you want to buy?</h1>
        <Link href="/request/mine" className="text-sm text-orange-600 underline">
          My requests
        </Link>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Product
          <input
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="iPhone 15, 128GB"
            className="rounded-lg border border-neutral-300 px-3 py-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Details (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sealed box, any colour"
            className="rounded-lg border border-neutral-300 px-3 py-3 text-base"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Area
          <div className="flex gap-2">
            <input
              required
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              placeholder="Koramangala, Bengaluru"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-3 text-base"
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="whitespace-nowrap rounded-lg border border-neutral-300 px-3 text-sm text-neutral-600"
            >
              {locating ? "Locating…" : coords ? "📍 Got it" : "Use my location"}
            </button>
          </div>
          {!coords && (
            <p className="text-xs text-neutral-400">
              No location shared — we&apos;ll estimate it from the area text you typed.
            </p>
          )}
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-orange-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Posting…" : "Post request"}
        </button>
      </form>
    </main>
  );
}
