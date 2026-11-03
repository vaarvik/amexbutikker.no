import type { Chain } from '../chains/chains.model.js';
import type { AcceptanceResult, EvidenceKind } from '../evidence/evidence.model.js';
import type {
  Address,
  NearbyQuery,
  Place,
  PlaceCategory,
  PlaceSearchQuery,
} from './places.model.js';
import type { GeoPoint, PlaceId, UserId } from '../shared/shared.model.js';
import type { ChainHint, PlaceStatus } from '../status/status.model.js';

/** A place in a result list, with its status. */
export interface PlaceSummary {
  readonly place: Place;
  /** UNKNOWN_PLACE_STATUS when nothing is calculated yet. */
  readonly status: PlaceStatus;
  readonly distanceM: number | null;
}

/**
 * Data for the sentence that explains a status, e.g. "Ifølge kredittkort360, ikke bekreftet av brukere".
 * The client turns it into copy.
 */
export interface StatusBasisExplanation {
  readonly kind: EvidenceKind | null;
  /** Whether the deciding evidence is about the place itself or its chain. */
  readonly scope: 'place' | 'chain' | 'none';
  /** Source of the strongest contributing evidence, e.g. `kredittkort360`, `app`. */
  readonly source: string | null;
  /** `observedAt` of that evidence; for imported claims, when the source was fetched. */
  readonly observedAt: Date | null;
  /** Users whose latest report on this place is accepted / rejected. */
  readonly userAccepted: number;
  readonly userRejected: number;
}

/** A recent user note on a place. Never carries the user id. */
export interface ReportNote {
  readonly result: AcceptanceResult;
  readonly note: string;
  readonly observedAt: Date;
}

/** Everything the place screen shows. */
export interface PlaceDetails {
  readonly place: Place;
  readonly status: PlaceStatus;
  readonly basis: StatusBasisExplanation;
  readonly chain: Chain | null;
  readonly chainHint: ChainHint | null;
  /** Up to 5 latest notes, newest first. */
  readonly latestNotes: readonly ReportNote[];
  /** The caller's own active report, or null (also when called anonymously). */
  readonly myReport: AcceptanceResult | null;
}

// Every use case exposes exactly one method, `execute`.

export interface PlaceListOutput {
  readonly results: readonly PlaceSummary[];
}

/** Text search for the home screen. */
export interface SearchPlaces {
  /** @throws ValidationError when the query fails PlaceSearchQuerySchema. */
  execute(input: PlaceSearchQuery): Promise<PlaceListOutput>;
}

/** The "nær deg" list. */
export interface FindNearbyPlaces {
  /** @throws ValidationError when the query fails NearbyQuerySchema. */
  execute(input: NearbyQuery): Promise<PlaceListOutput>;
}

export interface GetPlaceDetailsInput {
  readonly placeId: PlaceId;
  /** Set when the caller sent a device token; fills `myReport`. */
  readonly userId?: UserId;
}

/** The place screen. */
export interface GetPlaceDetails {
  /** @throws NotFoundError when the place does not exist. */
  execute(input: GetPlaceDetailsInput): Promise<PlaceDetails>;
}

export type CreatePlaceInput =
  | {
      readonly kind: 'physical';
      readonly userId: UserId;
      readonly name: string;
      readonly category: PlaceCategory;
      readonly address: Address;
      readonly location: GeoPoint;
      readonly website: string | null;
    }
  | {
      readonly kind: 'online';
      readonly userId: UserId;
      readonly name: string;
      readonly website: string;
    };

/** A user adds a place that is missing. */
export interface CreatePlace {
  /**
   * @returns the created place.
   * Duplicate detection (same website, same name nearby) is not done yet; see open questions.
   *
   * @throws ValidationError when the input is invalid.
   * @throws RateLimitedError when the user creates too many places.
   */
  execute(input: CreatePlaceInput): Promise<Place>;
}
