"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { GMap, GMapMarker, GOOGLE_MAPS_ENABLED, loadGoogleMaps } from "@/lib/google-maps";
import { describeFee } from "@/lib/money";
import { Badge, ErrorBanner, ghostButtonClass, inputClass, labelClass, LoadingScreen, primaryButtonClass, Spinner } from "@/components/ui";

// Matches the API's mock geocoder fallback (apps/api/src/geo/providers/mock-geocoding.provider.ts).
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

interface Shop {
  shopName: string;
  address: string;
  latitude: number;
  longitude: number;
  upiId: string | null;
  verified: boolean;
  category: string;
  secondaryCategories: string[];
}

interface ShopCategoryOption {
  category: string;
  label: string;
  rateBps: number | null;
  capPaise: number | null;
  floorPaise: number | null;
  flatFeePaise: number | null;
  active: boolean;
}

export default function OnboardPage() {
  const { ready, user } = useRequireRole("shop_owner");
  const router = useRouter();

  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [upiId, setUpiId] = useState("");
  const [verified, setVerified] = useState(false);
  const [category, setCategory] = useState("mobile_electronics");
  const [existingCategory, setExistingCategory] = useState<string | null>(null);
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<ShopCategoryOption[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMapMarker | null>(null);
  const [mapsFailed, setMapsFailed] = useState(false);

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
        setCategory(shop.category);
        setExistingCategory(shop.category);
        setSecondaryCategories(shop.secondaryCategories ?? []);
      })
      .catch(() => {});
  }, [ready, user]);

  // Places Autocomplete on the address field + a draggable pin to confirm/adjust it (AUC-15).
  useEffect(() => {
    if (!GOOGLE_MAPS_ENABLED || !ready || !user || !addressInputRef.current || !mapContainerRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((sdk) => {
        if (cancelled || !addressInputRef.current || !mapContainerRef.current) return;

        const autocomplete = new sdk.maps.places.Autocomplete(addressInputRef.current, {
          types: ["geocode"],
          componentRestrictions: { country: "in" },
          fields: ["formatted_address", "geometry"],
        });
        autocomplete.addListener("place_changed", () => {
          const location = autocomplete.getPlace().geometry?.location;
          if (!location) return;
          setCoords({ latitude: location.lat(), longitude: location.lng() });
          const formatted = autocomplete.getPlace().formatted_address;
          if (formatted) setAddress(formatted);
          map.panTo({ lat: location.lat(), lng: location.lng() });
          map.setZoom(16);
        });

        const initialCenter = coords ? { lat: coords.latitude, lng: coords.longitude } : DEFAULT_CENTER;
        const map = new sdk.maps.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: coords ? 16 : 11,
          disableDefaultUI: true,
          zoomControl: true,
        });
        const marker = new sdk.maps.Marker({ map, position: initialCenter, draggable: true, visible: !!coords });
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) setCoords({ latitude: pos.lat(), longitude: pos.lng() });
        });

        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch(() => setMapsFailed(true));

    return () => {
      cancelled = true;
    };
    // Runs once the address field/map div exist — coords is only read for the initial center.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  // Keep the pin in sync when coords change from elsewhere (geolocation button, initial shop fetch).
  useEffect(() => {
    if (!coords || !mapRef.current || !markerRef.current) return;
    const pos = { lat: coords.latitude, lng: coords.longitude };
    markerRef.current.setPosition(pos);
    markerRef.current.setVisible(true);
    mapRef.current.panTo(pos);
  }, [coords]);

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

  // Category list with the fee each one attracts. Non-fatal if it fails: the
  // field simply doesn't render and the existing category is kept.
  useEffect(() => {
    if (!ready || !user) return;
    api
      .get<ShopCategoryOption[]>("/catalog/shop-categories")
      .then(setCategoryOptions)
      .catch(() => setCategoryOptions([]));
  }, [ready, user]);

  const selectedCategory = categoryOptions.find((o) => o.category === category) ?? null;

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
        category,
        // Never send the primary back as a secondary — the API treats the two
        // lists as disjoint.
        secondaryCategories: secondaryCategories.filter((c) => c !== category),
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

        {/* The fee is shown BEFORE the shop commits. Pricing transparency at
            signup is a trust feature, not a disclosure chore. */}
        {categoryOptions.length > 0 && (
          <label className={labelClass}>
            What do you sell?
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
              disabled={existingCategory != null}
            >
              {categoryOptions
                .filter((o) => o.active || o.category === category)
                .map((o) => (
                  <option key={o.category} value={o.category}>
                    {o.label}
                  </option>
                ))}
            </select>
            {selectedCategory && (
              <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-normal text-green-800 dark:bg-green-950/30 dark:text-green-300">
                <strong>Your first 3 deals are completely free.</strong> After that:{" "}
                {describeFee(selectedCategory)}. Nothing is charged during the pilot.
              </span>
            )}
            {existingCategory != null && (
              <span className="text-xs font-normal text-neutral-400 dark:text-neutral-500">
                Your category affects the fee you pay, so it can only be changed by support.
              </span>
            )}
          </label>
        )}

        {/* Secondary categories (AUC-60). Unlike the primary these stay editable
            after onboarding: they only widen which requests reach this shop, and
            the fee follows the request's category, so there is nothing to game. */}
        {categoryOptions.length > 0 && (
          <div className={labelClass}>
            Anything else you sell?
            <div className="flex flex-wrap gap-2">
              {categoryOptions
                .filter((o) => o.category !== category && o.active)
                .map((o) => {
                  const on = secondaryCategories.includes(o.category);
                  return (
                    <button
                      key={o.category}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setSecondaryCategories((prev) =>
                          prev.includes(o.category)
                            ? prev.filter((c) => c !== o.category)
                            : [...prev, o.category],
                        )
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        on
                          ? "bg-orange-600 text-white"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
            </div>
            <span className="text-xs font-normal text-neutral-400 dark:text-neutral-500">
              Optional. You will start seeing requests in these categories too, and each deal is charged at that
              category&apos;s rate — not your main one.
            </span>
          </div>
        )}

        <label className={labelClass}>
          Address
          <input
            ref={addressInputRef}
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={GOOGLE_MAPS_ENABLED ? "Start typing your shop's address…" : undefined}
            className={inputClass}
          />
        </label>

        {GOOGLE_MAPS_ENABLED && !mapsFailed && (
          <div className={labelClass}>
            Confirm the pin
            <div
              ref={mapContainerRef}
              className="h-48 w-full overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Drag the pin to your shop&apos;s exact spot — nearby customers are matched from here.
            </p>
          </div>
        )}

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

        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button type="submit" disabled={loading} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Saving…" : "Save & find nearby requests"}
        </button>
      </form>
    </main>
  );
}
