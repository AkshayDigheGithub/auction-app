import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GEOCODING_PROVIDER } from './geocoding-provider.interface';
import { MockGeocodingProvider } from './providers/mock-geocoding.provider';
import { GoogleGeocodingProvider } from './providers/google-geocoding.provider';

@Module({
  providers: [
    GeoService,
    MockGeocodingProvider,
    GoogleGeocodingProvider,
    {
      provide: GEOCODING_PROVIDER,
      useFactory: (google: GoogleGeocodingProvider, mock: MockGeocodingProvider) =>
        process.env.GOOGLE_MAPS_API_KEY ? google : mock,
      inject: [GoogleGeocodingProvider, MockGeocodingProvider],
    },
  ],
  exports: [GeoService, GEOCODING_PROVIDER],
})
export class GeoModule {}
