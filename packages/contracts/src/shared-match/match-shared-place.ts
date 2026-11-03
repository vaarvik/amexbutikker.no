import type { PlaceId } from '../shared/ids.js';
import type { PlaceStatus } from '../status/place-status.js';
import type { ParsedSharedPlace, PlaceCandidate } from './shared-place.js';

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
