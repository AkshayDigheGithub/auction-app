"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { GMap, GMapMarker, GOOGLE_MAPS_ENABLED, loadGoogleMaps } from "@/lib/google-maps";
import { ErrorBanner, ghostButtonClass, InfoBanner, inputClass, labelClass, LoadingScreen, primaryButtonClass, Spinner } from "@/components/ui";

// Matches the API's mock geocoder fallback (apps/api/src/geo/providers/mock-geocoding.provider.ts).
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

interface CreatedRequest {
  id: string;
}

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
}

interface NearbyShopSignal {
  count: number;
  radiusKm: number;
  categoryName: string | null;
}

// AUC-93: an anonymised "someone will actually bid" signal — count only, never
// identity. Shop names/addresses stay hidden until deal lock, which is the only
// thing that forces request -> bid -> lock (the platform's only revenue point),
// so this must never grow into a list, a map, or a second call to action.
function supplySignalText(signal: NearbyShopSignal | null): string | null {
  if (!signal || signal.count <= 0) return null; // zero kills the funnel — say nothing
  const plural = signal.count !== 1;
  const shopWord = plural ? "shops" : "shop";
  if (signal.categoryName) {
    const verb = plural ? "deal" : "deals";
    return `${signal.count} ${shopWord} near you ${verb} in ${signal.categoryName}`;
  }
  // No category picked yet — the count spans all shops in radius, so don't
  // imply it's specific to whatever the customer is about to post.
  const verb = plural ? "are" : "is";
  return `${signal.count} ${shopWord} near you ${verb} already on the platform`;
}

export default function NewRequestPage() {
  const { ready, user } = useRequireRole("customer");
  const router = useRouter();

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [areaText, setAreaText] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productCategoryId, setProductCategoryId] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nearbySignal, setNearbySignal] = useState<(NearbyShopSignal & { key: string }) | null>(null);

  const areaInputRef = useRef<HTMLInputElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMapMarker | null>(null);
  const [mapsFailed, setMapsFailed] = useState(false);

  // Places Autocomplete on the area field + a draggable pin to confirm/adjust it (AUC-15-style).
  useEffect(() => {
    if (!GOOGLE_MAPS_ENABLED || !ready || !user || !areaInputRef.current || !mapContainerRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((sdk) => {
        if (cancelled || !areaInputRef.current || !mapContainerRef.current) return;

        const autocomplete = new sdk.maps.places.Autocomplete(areaInputRef.current, {
          types: ["geocode"],
          componentRestrictions: { country: "in" },
          fields: ["formatted_address", "geometry"],
        });
        autocomplete.addListener("place_changed", () => {
          const location = autocomplete.getPlace().geometry?.location;
          if (!location) return;
          setCoords({ latitude: location.lat(), longitude: location.lng() });
          const formatted = autocomplete.getPlace().formatted_address;
          if (formatted) setAreaText(formatted);
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
    // Runs once the area field/map div exist — coords is only read for the initial center.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  // Keep the pin in sync when coords change from elsewhere (geolocation button).
  useEffect(() => {
    if (!coords || !mapRef.current || !markerRef.current) return;
    const pos = { lat: coords.latitude, lng: coords.longitude };
    markerRef.current.setPosition(pos);
    markerRef.current.setVisible(true);
    mapRef.current.panTo(pos);
  }, [coords]);

  // Category list for the picker. A failure here is non-fatal: the field just
  // does not render and the request posts uncategorised, as it did before.
  useEffect(() => {
    if (!ready || !user) return;
    api
      .get<ProductCategory[]>("/catalog/product-categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [ready, user]);

  // Identifies what a given count is an answer *to*. Comparing it on render is
  // what keeps a stale count off the screen without clearing state inside the
  // effect, which would cost an extra render pass on every pin drag.
  const signalKey = coords ? `${coords.latitude},${coords.longitude},${productCategoryId}` : null;
  const freshSignal = nearbySignal?.key === signalKey ? nearbySignal : null;

  // Supply-density signal (AUC-93): fetch only once we have coordinates to
  // count against, debounced so dragging the map pin doesn't fire a request
  // per pixel. `cancelled` guards against a slow earlier response landing
  // after a newer one and clobbering it. A failure here is non-fatal and
  // silent, same as the product-category fetch above — this is decoration,
  // not something the form depends on to function.
  useEffect(() => {
    if (!signalKey || !coords) return; // nothing to count against
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
      });
      if (productCategoryId) params.set("productCategoryId", productCategoryId);
      api
        .get<NearbyShopSignal>(`/requests/nearby-shop-count?${params.toString()}`)
        // Stamped with the pin/category it answers for, so a count for the
        // previous location can't linger on screen after the pin moves. A
        // number that describes somewhere else is exactly the overpromise this
        // signal exists to avoid.
        .then((signal) => {
          if (!cancelled) setNearbySignal({ ...signal, key: signalKey });
        })
        .catch(() => {
          if (!cancelled) setNearbySignal(null);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signalKey, coords, productCategoryId]);

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
        productCategoryId: productCategoryId || undefined,
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

        {/* Optional by design: it sharpens which shops get woken up, but a
            customer who just types "iPhone 15" must still be able to post. */}
        {categories.length > 0 && (
          <label className={labelClass}>
            Category (optional)
            <select
              value={productCategoryId}
              onChange={(e) => setProductCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Not sure / other</option>
              {categories.map((parent) => (
                <optgroup key={parent.id} label={parent.name}>
                  {parent.children.length === 0 ? (
                    <option value={parent.id}>{parent.name}</option>
                  ) : (
                    parent.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))
                  )}
                </optgroup>
              ))}
            </select>
            <span className="text-xs font-normal text-neutral-400 dark:text-neutral-500">
              Helps us send your request to shops that actually stock it.
            </span>
          </label>
        )}

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
              ref={areaInputRef}
              required
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              placeholder={GOOGLE_MAPS_ENABLED ? "Start typing your area…" : "Koramangala, Bengaluru"}
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

        {GOOGLE_MAPS_ENABLED && !mapsFailed && (
          <div className={labelClass}>
            Confirm your area
            <div
              ref={mapContainerRef}
              className="h-48 w-full overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Drag the pin to your exact spot — nearby shops are matched from here.
            </p>
          </div>
        )}

        {/* Reassurance, not a CTA: shows someone will actually bid before the
            customer commits. Renders nothing at zero/loading/error — see
            supplySignalText. Never a shop list — identity stays hidden until
            deal lock. */}
        {supplySignalText(freshSignal) && <InfoBanner tone="green">{supplySignalText(freshSignal)}</InfoBanner>}

        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button type="submit" disabled={loading} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Posting…" : "Post request"}
        </button>
      </form>
    </main>
  );
}
