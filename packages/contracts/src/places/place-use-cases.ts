import type { PlaceId, UserId } from '../shared/ids.js';
import type { GeoPoint } from '../shared/geo.js';
import type { Address, Place, PlaceCategory } from './place.js';
import type { NearbyQuery, PlaceSearchQuery } from './queries.js';
import type { PlaceDetails, PlaceSummary } from './place-views.js';

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
   * @throws ValidationError when the input is invalid.
   * @throws ConflictError when an online place with the same website host exists.
   * @throws RateLimitedError when the user creates too many places.
   */
  execute(input: CreatePlaceInput): Promise<Place>;
}
