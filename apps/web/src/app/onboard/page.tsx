"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { Badge, ErrorBanner, ghostButtonClass, inputClass, labelClass, LoadingScreen, primaryButtonClass, Spinner } from "@/components/ui";

interface Shop {
  shopName: string;
  address: string;
  latitude: number;
  longitude: number;
  upiId: string | null;
  verified: boolean;
}

export default function OnboardPage() {
  const { ready, user } = useRequireRole("shop_owner");
  const router = useRouter();

  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [upiId, setUpiId] = useState("");
  const [verified, setVerified] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    api
      .get<Shop>("/shops/me")
      .then((shop) => {
        setShopName(shop.shopName);
        setAddress(shop.address);
        setCoords({ latitude: shop.latitude, longitude: shop.longitude });
        setUpiId(shop.upiId ?? "");
        setVerified(shop.verified);
      })
      .catch(() => {});
  }, [ready, user]);

  function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Could not get your location — this is required so nearby customers can find you.");
        setLocating(false);
      },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords) {
      setError("Set your shop's location first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.put("/shops/me", {
        shopName,
        address,
        ...coords,
        category: "mobile_electronics",
        upiId: upiId || undefined,
      });
      router.push("/nearby");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save shop profile");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !user) return <LoadingScreen />;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Your shop profile</h1>
        {verified && <Badge tone="green">✅ Verified</Badge>}
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className={labelClass}>
          Shop name
          <input required value={shopName} onChange={(e) => setShopName(e.target.value)} className={inputClass} />
        </label>

        <label className={labelClass}>
          Address
          <input required value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </label>

        <div className={labelClass}>
          Location
          <button type="button" onClick={useMyLocation} disabled={locating} className={`${ghostButtonClass} w-fit`}>
            {locating ? "Locating…" : coords ? "📍 Pin set — tap to update" : "Use my current location"}
          </button>
          {!coords && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Required so nearby customers&apos; requests can reach you.
            </p>
          )}
        </div>

        <label className={labelClass}>
          UPI ID (for commission settlement, optional for now)
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourshop@upi"
            className={inputClass}
          />
        </label>

        <p className="text-xs text-neutral-400 dark:text-neutral-500">Category: Mobile &amp; Electronics (fixed at MVP)</p>

        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button type="submit" disabled={loading} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Saving…" : "Save & find nearby requests"}
        </button>
      </form>
    </main>
  );
}
