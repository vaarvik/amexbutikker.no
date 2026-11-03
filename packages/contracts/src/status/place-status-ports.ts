import type { ChainId, PlaceId } from '../shared/ids.js';
import type { PlaceStatusSnapshot } from './place-status.js';

/** Read access to calculated place statuses. */
export interface PlaceStatusReader {
  /**
   * @returns the stored snapshot, or null when none has been calculated yet.
   */
  get(placeId: PlaceId): Promise<PlaceStatusSnapshot | null>;

  /**
   * Snapshots for several places at once, e.g. for a result list.
   *
   * @returns a map containing only the places that have a snapshot.
   */
  getMany(placeIds: readonly PlaceId[]): Promise<ReadonlyMap<PlaceId, PlaceStatusSnapshot>>;

  /**
   * Snapshots of every place in the chain that has one. Order is unspecified.
   */
  listForChain(chainId: ChainId): Promise<PlaceStatusSnapshot[]>;
}

/** Write access to calculated place statuses. */
export interface PlaceStatusWriter {
  /**
   * Stores the snapshot, replacing any earlier one for the same place.
   *
   * @throws NotFoundError when the place does not exist.
   */
  save(snapshot: PlaceStatusSnapshot): Promise<void>;
}
