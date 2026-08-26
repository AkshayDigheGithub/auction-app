/**
 * Lazy loader for the Google Maps JavaScript API (Places library), used by
 * the shop address picker (AUC-15). No @types/google.maps package is
 * installed, so this file also declares the minimal surface we actually call.
 */

interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface GMapMarker {
  setPosition(pos: LatLngLiteral): void;
  setVisible(visible: boolean): void;
  getPosition(): { lat(): number; lng(): number } | null;
  addListener(event: "dragend", handler: () => void): void;
}

export interface GMap {
  panTo(pos: LatLngLiteral): void;
  setZoom(zoom: number): void;
}

interface GPlaceResult {
  formatted_address?: string;
  geometry?: { location?: { lat(): number; lng(): number } };
}

export interface GAutocomplete {
  addListener(event: "place_changed", handler: () => void): void;
  getPlace(): GPlaceResult;
}

interface GoogleMapsSDK {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
    Marker: new (opts: Record<string, unknown>) => GMapMarker;
    places: {
      Autocomplete: new (input: HTMLInputElement, opts: Record<string, unknown>) => GAutocomplete;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleMapsSDK;
  }
}

export const GOOGLE_MAPS_ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

let loadPromise: Promise<GoogleMapsSDK> | null = null;

/** Injects the Maps JS API script once and caches the load across callers. */
export function loadGoogleMaps(): Promise<GoogleMapsSDK> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps can only load in the browser"));
  if (window.google) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error("Google Maps failed to initialize")));
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
  return loadPromise;
}
