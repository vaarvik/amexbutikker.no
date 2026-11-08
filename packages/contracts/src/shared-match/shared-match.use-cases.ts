import type { ParsedSharedPlace, PlaceCandidate } from './shared-match.model.js';
import type { GeoPoint, PlaceId } from '../shared/shared.model.js';
import type { PlaceStatus } from '../status/status.model.js';

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

export interface MatchPaymentInput {
  /** The merchant name the card payment carries. Never the amount: amounts stay on the phone. */
  readonly merchant: string;
  /** Where the phone was when the app opened after the payment; null without a fix. */
  readonly location: GeoPoint | null;
}

export interface MatchPaymentOutput {
  /** The merchant name as matched, null when nothing usable was left of it. */
  readonly merchantName: string | null;
  /** At most 3, best first, each with its status. */
  readonly candidates: readonly (PlaceCandidate & { readonly status: PlaceStatus })[];
  /** `open` only when the place is clear enough to save the answer without asking. */
  readonly decision: MatchDecision;
}

/** A card payment (merchant name and the phone's position) to the place it was made at. */
export interface MatchPayment {
  /** @throws ValidationError when the merchant name is empty or too long. */
  execute(input: MatchPaymentInput): Promise<MatchPaymentOutput>;
}
