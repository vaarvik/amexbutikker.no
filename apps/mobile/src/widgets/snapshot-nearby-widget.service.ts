import type { Clock, PlaceSummaryDto } from '@amexbutikker/contracts';
import type { NearbyCache } from '../places/places.ports';
import type {
  NearbyWidgetPropsMapper,
  NearbyWidgetService,
  NearbyWidgetWriter,
} from './widgets.ports';

/**
 * Writes a snapshot to the widget whenever the app has a nearby list, and again from the
 * background geofence task when the phone enters a place. Widget errors never reach the caller:
 * a stale widget must not break the app.
 */
export class SnapshotNearbyWidgetService implements NearbyWidgetService {
  public constructor(
    private readonly mapper: NearbyWidgetPropsMapper,
    private readonly writer: NearbyWidgetWriter,
    private readonly nearbyCache: NearbyCache,
    private readonly clock: Clock,
  ) {}

  public async update(results: readonly PlaceSummaryDto[], hereId?: string): Promise<void> {
    await this.writer
      .save(this.mapper.map(results, hereId ?? null, this.clock.now()))
      .catch(() => undefined);
  }

  public async enter(placeId: string): Promise<void> {
    const snapshot = await this.nearbyCache.find().catch(() => null);
    if (snapshot !== null) {
      await this.update(snapshot.results, placeId);
    }
  }
}
