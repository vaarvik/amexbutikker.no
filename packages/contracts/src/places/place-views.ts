import type { Chain } from '../chains/chain.js';
import type { AcceptanceResult, EvidenceKind } from '../evidence/evidence.js';
import type { ChainHint, PlaceStatus } from '../status/place-status.js';
import type { Place } from './place.js';

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
