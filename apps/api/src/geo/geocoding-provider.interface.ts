export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export interface GeocodingProvider {
  geocodeArea(areaText: string): Promise<GeocodeResult>;
}

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
