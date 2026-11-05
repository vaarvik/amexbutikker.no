import type { GeoPoint } from '@amexbutikker/contracts';
import type { ExpoLocationModule, LocationProvider } from './location.ports';

export interface ExpoLocationProviderConfig {
  /** A last known position this fresh is used as is; it costs no GPS fix. */
  readonly maxLastKnownAgeMs: number;
  /** Metres; a last known position less accurate than this is not used. */
  readonly requiredAccuracyM: number;
  /** `Location.Accuracy` value for a new fix; Balanced is fast and good to ~100 m. */
  readonly accuracy: number;
}

/**
 * Asks for foreground permission, then prefers the last known position because it answers in
 * milliseconds, and takes a new fix only when that is stale.
 */
export class ExpoLocationProvider implements LocationProvider {
  public constructor(
    private readonly location: ExpoLocationModule,
    private readonly config: ExpoLocationProviderConfig,
  ) {}

  public async findCurrent(): Promise<GeoPoint | null> {
    try {
      const permission = await this.location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        return null;
      }
      const position =
        (await this.location.getLastKnownPositionAsync({
          maxAge: this.config.maxLastKnownAgeMs,
          requiredAccuracy: this.config.requiredAccuracyM,
        })) ?? (await this.location.getCurrentPositionAsync({ accuracy: this.config.accuracy }));
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      // Location services off, or no fix: the app works without a position.
      return null;
    }
  }
}
