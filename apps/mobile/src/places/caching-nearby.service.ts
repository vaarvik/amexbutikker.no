import type { Clock } from '@amexbutikker/contracts';
import type { LocationProvider } from '../location/location.ports';
import type { NearbySnapshot, NearbyState } from './places.model';
import type { NearbyCache, NearbyService, PlacesApiClient } from './places.ports';

export interface CachingNearbyServiceConfig {
  readonly radiusM: number;
}

/**
 * Shows the cached list at once (no network, no GPS), then locates the phone, fetches the
 * nearby places and stores them for the next start. A failure keeps the cached list visible.
 */
export class CachingNearbyService implements NearbyService {
  public constructor(
    private readonly api: PlacesApiClient,
    private readonly cache: NearbyCache,
    private readonly location: LocationProvider,
    private readonly clock: Clock,
    private readonly config: CachingNearbyServiceConfig,
  ) {}

  public async load(onState: (state: NearbyState) => void): Promise<void> {
    const cached = await this.cache.find().catch(() => null);
    onState(
      cached === null
        ? { kind: 'loading' }
        : { kind: 'ready', snapshot: cached, fromCache: true, refreshing: true },
    );

    const center = await this.location.findCurrent();
    if (center === null) {
      onState({ kind: 'no-location', snapshot: cached });
      return;
    }
    try {
      const { results } = await this.api.listNearby({
        lat: center.lat,
        lng: center.lng,
        radiusM: this.config.radiusM,
      });
      const snapshot: NearbySnapshot = {
        center,
        fetchedAt: this.clock.now().toISOString(),
        results,
      };
      onState({ kind: 'ready', snapshot, fromCache: false, refreshing: false });
      await this.cache.save(snapshot).catch(() => undefined);
    } catch (error) {
      onState({ kind: 'failed', error, snapshot: cached });
    }
  }
}
