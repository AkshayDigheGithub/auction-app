import { Injectable, Logger } from '@nestjs/common';
import type { GeocodeResult, GeocodingProvider } from '../geocoding-provider.interface';

/**
 * Dev-mode geocoder: always returns a fixed Bengaluru coordinate rather than
 * calling Google. Good enough to exercise the PostGIS radius-match logic
 * locally without a GOOGLE_MAPS_API_KEY (AUC-19/AUC-20).
 */
@Injectable()
export class MockGeocodingProvider implements GeocodingProvider {
  private readonly logger = new Logger('Geocoding');

  async geocodeArea(areaText: string): Promise<GeocodeResult> {
    this.logger.warn(
      `[DEV] GOOGLE_MAPS_API_KEY not set — returning fixed coordinate for area "${areaText}"`,
    );
    return { latitude: 12.9716, longitude: 77.5946 };
  }
}
