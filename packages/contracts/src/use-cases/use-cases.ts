import type { PlaceId, UserId } from '../ids.js';
import type { GeoPoint } from '../model/geo.js';
import type { AcceptanceResult } from '../model/evidence.js';
import type { ImportRunReport, ImportSource } from '../model/import-run.js';
import type { ChainHint, PlaceStatus } from '../model/place-status.js';
import type { Address, Place, PlaceCategory } from '../model/place.js';
import type { NearbyQuery, PlaceSearchQuery } from '../model/queries.js';
import type { ParsedSharedPlace, PlaceCandidate } from '../model/shared-place.js';
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

export interface SubmitReportInput {
  readonly userId: UserId;
  readonly placeId: PlaceId;
  readonly result: AcceptanceResult;
  readonly note?: string;
}

export interface StatusChangeOutput {
  readonly status: PlaceStatus;
  readonly chainHint: ChainHint | null;
}

/** "Det funket" / "Ble avvist". */
export interface SubmitReport {
  /**
   * Appends a user_report, then recalculates the place status and the chain hint, in one unit of work.
   * A user has at most one active report per place: the new one supersedes the old.
   *
   * @throws NotFoundError when the place does not exist.
   * @throws ValidationError when the note is longer than 500 characters.
   * @throws RateLimitedError when the user reports too often.
   */
  execute(input: SubmitReportInput): Promise<StatusChangeOutput>;
}

export interface RemoveMyReportInput {
  readonly userId: UserId;
  readonly placeId: PlaceId;
}

/** A user withdraws their report. */
export interface RemoveMyReport {
  /**
   * Appends a `withdrawn` user_report, then recalculates as SubmitReport does.
   *
   * @throws NotFoundError when the place does not exist, or the user has no active report on it.
   * @throws RateLimitedError when the user reports too often.
   */
  execute(input: RemoveMyReportInput): Promise<StatusChangeOutput>;
}

export interface MatchSharedPlaceInput {
  readonly text: string;
}

export type MatchDecision =
  /** Top candidate is clearly right: open it directly. */
  | { readonly type: 'open'; readonly placeId: PlaceId }
  /** Let the user choose among the candidates. */
  | { readonly type: 'choose' }
  /** No candidates: offer to add the place. */
  | { readonly type: 'none' };

export interface MatchSharedPlaceOutput {
  readonly parsed: ParsedSharedPlace;
  /** At most 3, best first, each with its status. */
  readonly candidates: readonly (PlaceCandidate & { readonly status: PlaceStatus })[];
  readonly decision: MatchDecision;
}

/** Text shared from a maps app to the answer for that place. */
export interface MatchSharedPlace {
  /** @throws ValidationError when the text is empty or too long. */
  execute(input: MatchSharedPlaceInput): Promise<MatchSharedPlaceOutput>;
}

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface RegisterDeviceInput {
  readonly platform: DevicePlatform;
  /** Identifies the caller for rate limiting, e.g. a hash of the client IP. Never stored. */
  readonly clientKey: string;
}

export interface RegisterDeviceOutput {
  readonly userId: UserId;
  readonly token: string;
}

/** Creates an anonymous user for a device. */
export interface RegisterDevice {
  /** @throws RateLimitedError when too many devices register from one client. */
  execute(input: RegisterDeviceInput): Promise<RegisterDeviceOutput>;
}

export interface RunImportInput {
  readonly source: ImportSource;
  readonly dryRun: boolean;
}

/** Runs one SourceImporter and records the run in `import_runs`. */
export interface RunImport {
  /**
   * @returns the importer's report, also when it failed.
   * @throws NotFoundError when no importer is registered for the source.
   */
  execute(input: RunImportInput): Promise<ImportRunReport>;
}
