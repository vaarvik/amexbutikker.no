import type { GeoPoint } from '@amexbutikker/contracts';
import type { BrowserGeolocation, LocationProvider } from './location.ports';

export interface BrowserLocationProviderConfig {
  /** A cached browser position this fresh is accepted. */
  readonly maxAgeMs: number;
  /** Gives up after this long, also while the browser's permission prompt is still open. */
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
      // The browser's own timeout starts only once permission is given, so an unanswered prompt
      // would wait for ever; searches and the list wait for this, so give up on our own too.
      const giveUp = setTimeout(() => {
        resolve(null);
      }, this.config.timeoutMs);
      geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(giveUp);
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          clearTimeout(giveUp);
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
