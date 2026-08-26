import { Injectable, BadRequestException } from '@nestjs/common';
import type { GeocodeResult, GeocodingProvider } from '../geocoding-provider.interface';

/** Google Geocoding API integration (AUC-19). Active once GOOGLE_MAPS_API_KEY is set. */
@Injectable()
export class GoogleGeocodingProvider implements GeocodingProvider {
  async geocodeArea(areaText: string): Promise<GeocodeResult> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', areaText);
    url.searchParams.set('region', 'in');
    url.searchParams.set('key', apiKey as string);

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      throw new BadRequestException(`Could not geocode area "${areaText}"`);
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  }
}
