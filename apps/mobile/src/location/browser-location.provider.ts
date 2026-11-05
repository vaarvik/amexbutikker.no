import type { GeoPoint } from '@amexbutikker/contracts';
import type { BrowserGeolocation, LocationProvider } from './location.ports';

export interface BrowserLocationProviderConfig {
  /** A cached browser position this fresh is accepted. */
  readonly maxAgeMs: number;
  /** Gives up after this long; the browser's permission prompt counts towards it. */
  readonly timeoutMs: number;
}

/** Browser geolocation. The browser asks for permission itself on first use. */
export class BrowserLocationProvider implements LocationProvider {
  public constructor(
    private readonly geolocation: BrowserGeolocation | undefined,
    private readonly config: BrowserLocationProviderConfig,
  ) {}

  public findCurrent(): Promise<GeoPoint | null> {
    const { geolocation } = this;
    if (geolocation === undefined) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      geolocation.getCurrentPosition(
        (position) => {
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          resolve(null);
        },
        {
          maximumAge: this.config.maxAgeMs,
          timeout: this.config.timeoutMs,
          enableHighAccuracy: false,
        },
      );
    });
  }
}
