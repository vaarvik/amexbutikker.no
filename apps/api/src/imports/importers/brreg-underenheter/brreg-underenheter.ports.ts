import type { PhysicalPlace } from '@amexbutikker/contracts';
import type { BrregUnderenhet } from './brreg-underenheter.model.js';

/** The bulk file as CSV rows keyed by header name, not yet validated. */
export interface BrregUnderenhetFile {
  readonly fetchedAt: Date;
  readonly rows: AsyncIterable<Readonly<Record<string, string>>>;
}

/** Opens the Brønnøysund underenhet bulk file. */
export interface BrregUnderenhetReader {
  /**
   * @throws Error when the file cannot be downloaded or read.
   * @throws the signal's reason when aborted.
   */
  getFile(signal?: AbortSignal): Promise<BrregUnderenhetFile>;
}

export type BrregPlaceMatch =
  | { readonly kind: 'matched'; readonly place: PhysicalPlace; readonly score: number }
  | { readonly kind: 'unmatched'; readonly reason: string };

/** Decides which place, if any, a unit is. Pure. */
export interface BrregPlaceMatcher {
  /** @param candidates places with the unit's postcode. */
  match(unit: BrregUnderenhet, candidates: readonly PhysicalPlace[]): BrregPlaceMatch;
}
