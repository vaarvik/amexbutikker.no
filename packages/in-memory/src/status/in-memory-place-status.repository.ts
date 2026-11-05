import { NotFoundError } from '@amexbutikker/contracts';
import type {
  ChainId,
  PlaceId,
  PlaceStatusReader,
  PlaceStatusSnapshot,
  PlaceStatusWriter,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../shared/shared.ports.js';

export class InMemoryPlaceStatusRepository implements PlaceStatusReader, PlaceStatusWriter {
  public constructor(private readonly tables: InMemoryTables) {}

  public find(placeId: PlaceId): Promise<PlaceStatusSnapshot | null> {
    return Promise.resolve(this.tables.statuses.get(placeId) ?? null);
  }

  public listByPlaces(
    placeIds: readonly PlaceId[],
  ): Promise<ReadonlyMap<PlaceId, PlaceStatusSnapshot>> {
    const found = new Map<PlaceId, PlaceStatusSnapshot>();
    for (const placeId of placeIds) {
      const snapshot = this.tables.statuses.get(placeId);
      if (snapshot !== undefined) {
        found.set(placeId, snapshot);
      }
    }
    return Promise.resolve(found);
  }

  public listForChain(chainId: ChainId): Promise<PlaceStatusSnapshot[]> {
    return Promise.resolve(
      [...this.tables.statuses.values()].filter((snapshot) => {
        const place = this.tables.places.get(snapshot.placeId);
        return place?.kind === 'physical' && place.chainId === chainId;
      }),
    );
  }

  public listStale(calculatedBefore: Date, limit: number): Promise<PlaceId[]> {
    return Promise.resolve(
      [...this.tables.statuses.values()]
        .filter((snapshot) => snapshot.calculatedAt.getTime() < calculatedBefore.getTime())
        .sort((a, b) => a.calculatedAt.getTime() - b.calculatedAt.getTime())
        .slice(0, limit)
        .map((snapshot) => snapshot.placeId),
    );
  }

  public save(snapshot: PlaceStatusSnapshot): Promise<void> {
    if (!this.tables.places.has(snapshot.placeId)) {
      return Promise.reject(new NotFoundError('Place', snapshot.placeId));
    }
    this.tables.statuses.set(snapshot.placeId, snapshot);
    return Promise.resolve();
  }
}
