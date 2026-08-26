"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";

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

  if (!ready || !user) return null;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-xl font-bold">Your shop profile</h1>
        {verified && <p className="text-sm text-green-600">✅ Verified shop</p>}
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Shop name
          <input
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Address
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-3 text-base"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          Location
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="w-fit rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600"
          >
            {locating ? "Locating…" : coords ? "📍 Pin set — tap to update" : "Use my current location"}
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          UPI ID (for commission settlement, optional for now)
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourshop@upi"
            className="rounded-lg border border-neutral-300 px-3 py-3 text-base"
          />
        </label>

        <p className="text-xs text-neutral-400">Category: Mobile &amp; Electronics (fixed at MVP)</p>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-orange-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save & find nearby requests"}
        </button>
      </form>
    </main>
  );
}
