import type {
  Address,
  ExistingPlace,
  NearbyPlaceHit,
  AreaQuery,
  NearbyQuery,
  PhysicalPlace,
  Place,
  PlaceCategory,
  PlaceSearchHit,
  PlaceSearchQuery,
} from './places.model.js';
import type { ChainId, GeoPoint, PlaceId } from '../shared/shared.model.js';

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
  listNearby(query: NearbyQuery): Promise<NearbyPlaceHit[]>;

  /**
   * Physical places inside `query.bounds` (edges included). With `answeredOnly`, places with no
   * status snapshot or an `unknown` one are left out before the limit applies.
   *
   * @param query validated with AreaQuerySchema by the caller.
   * @returns at most `query.limit` places, nearest to the centre of the bounds first, so a
   *   truncated result keeps the middle of the map. Online places are never returned.
   */
  listInArea(query: AreaQuery): Promise<PhysicalPlace[]>;

  /**
   * The physical places that belong to a chain, in no particular order.
   *
   * @returns empty for a chain without places, including an unknown chain id.
   */
  listByChain(chainId: ChainId): Promise<PhysicalPlace[]>;

  /**
   * The physical places with this four-digit postcode, in no particular order. Used to match
   * registry entries to places by address.
   *
   * @returns empty when none has it.
   */
  listByPostcode(postcode: string): Promise<PhysicalPlace[]>;
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
  saveBrregOrgnr(placeId: PlaceId, orgnr: string): Promise<void>;
}

/** Decides whether a place a user is adding is one we already have. Pure. */
export interface PlaceDuplicateMatcher {
  /**
   * @param place the new place, not stored yet.
   * @param existing stored places near it (physical) or with a similar name (online).
   * @returns the stored place it most likely is, or null when it looks new.
   */
  findDuplicate(place: Place, existing: readonly ExistingPlace[]): Place | null;
}
