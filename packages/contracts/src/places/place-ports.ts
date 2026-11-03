import type { ChainId, PlaceId } from '../shared/ids.js';
import type { Address, PlaceCategory, Place } from './place.js';
import type { GeoPoint } from '../shared/geo.js';
import type { NearbyQuery, PlaceSearchQuery } from './queries.js';
import type { NearbyPlaceHit, PlaceSearchHit } from './search-results.js';

/** Read access to places. */
export interface PlaceReader {
  /**
   * @returns the place with this id.
   * @throws NotFoundError when no place has this id.
   */
  getById(id: PlaceId): Promise<Place>;

  /**
   * Accent- and case-insensitive fuzzy name search.
   *
   * @param query validated with PlaceSearchQuerySchema by the caller.
   * @returns at most `query.limit` hits, best first. Ties are broken by distance when
   *   `query.near` is set, then by name. Empty when nothing matches; never throws for no match.
   *   When `query.kind` is set, only places of that kind are returned.
   */
  search(query: PlaceSearchQuery): Promise<PlaceSearchHit[]>;

  /**
   * Physical places within `query.radiusM` metres of `query.center` (great-circle distance).
   *
   * @returns at most `query.limit` hits, nearest first. Online places are never returned.
   */
  nearby(query: NearbyQuery): Promise<NearbyPlaceHit[]>;
}

/** A physical place as an importer sees it, before it has an id. */
export interface PlaceSourceRecord {
  /** Key the upsert is idempotent on. Currently the OSM ref (`node/123`). */
  readonly osmRef: string;
  readonly name: string;
  readonly category: PlaceCategory;
  readonly address: Address;
  readonly location: GeoPoint;
  readonly website: string | null;
  readonly chainId: ChainId | null;
}

export type UpsertOutcome = 'created' | 'updated' | 'unchanged';

export interface PlaceUpsertResult {
  readonly placeId: PlaceId;
  readonly outcome: UpsertOutcome;
}

/** Write access to places. */
export interface PlaceWriter {
  /**
   * Inserts a new place.
   *
   * @throws ConflictError when `place.id` exists, or a physical place's `osmRef` is already taken.
   */
  create(place: Place): Promise<void>;

  /**
   * Inserts or updates a physical place keyed by `record.osmRef`.
   * Updates only the fields in the record; `id`, `createdAt` and `brregOrgnr` are kept.
   *
   * @param newId used only when the place does not exist yet.
   * @returns `unchanged` when every field already had the given value.
   * Invariant: calling twice with the same record yields `created`, then `unchanged`, with one place.
   */
  upsertFromSource(record: PlaceSourceRecord, newId: PlaceId): Promise<PlaceUpsertResult>;

  /**
   * Sets the Brønnøysund organisation number of a physical place.
   *
   * @throws NotFoundError when the place does not exist or is online.
   */
  attachBrregOrgnr(placeId: PlaceId, orgnr: string): Promise<void>;
}
