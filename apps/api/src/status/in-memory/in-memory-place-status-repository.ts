import { NotFoundError } from '@amexbutikker/contracts';
import type {
  ChainId,
  PlaceId,
  PlaceStatusReader,
  PlaceStatusSnapshot,
  PlaceStatusWriter,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../../shared/in-memory/in-memory-tables.js';

export class InMemoryPlaceStatusRepository implements PlaceStatusReader, PlaceStatusWriter {
  public constructor(private readonly tables: InMemoryTables) {}

  public get(placeId: PlaceId): Promise<PlaceStatusSnapshot | null> {
    return Promise.resolve(this.tables.statuses.get(placeId) ?? null);
  }

  public getMany(placeIds: readonly PlaceId[]): Promise<ReadonlyMap<PlaceId, PlaceStatusSnapshot>> {
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

  public save(snapshot: PlaceStatusSnapshot): Promise<void> {
    if (!this.tables.places.has(snapshot.placeId)) {
      return Promise.reject(new NotFoundError('Place', snapshot.placeId));
    }
    this.tables.statuses.set(snapshot.placeId, snapshot);
    return Promise.resolve();
  }
}
