"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useRequireRole } from "@/lib/use-require-role";
import { GMap, GMapMarker, GOOGLE_MAPS_ENABLED, loadGoogleMaps } from "@/lib/google-maps";
import { ErrorBanner, ghostButtonClass, inputClass, labelClass, LoadingScreen, primaryButtonClass, Spinner } from "@/components/ui";

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

        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button type="submit" disabled={loading} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Posting…" : "Post request"}
        </button>
      </form>
    </main>
  );
}
