import type { Evidence } from './evidence.model.js';
import type { ChainId, PlaceId } from '../shared/shared.model.js';

/** Read access to evidence. */
export interface EvidenceReader {
  /**
   * All evidence targeting this place, newest `observedAt` first (ties: newest `importedAt`, then id).
   * Includes superseded and withdrawn entries; deciding what counts is the calculator's job.
   *
   * @returns empty for a place without evidence, including an unknown place id.
   */
  listForPlace(placeId: PlaceId): Promise<Evidence[]>;

  /**
   * All evidence targeting the chain itself (not its places), same order as listForPlace.
   */
  listForChain(chainId: ChainId): Promise<Evidence[]>;
}

export type AppendOutcome = 'appended' | 'duplicate';

/** Append-only write access to evidence. There is no update and no delete. */
export interface EvidenceWriter {
  /**
   * Appends evidence. Idempotent on `(source, sourceRef)`.
   *
   * @returns `duplicate`, and stores nothing, when evidence with the same source and sourceRef exists.
   * @throws NotFoundError when the target place or chain does not exist.
   */
  append(evidence: Evidence): Promise<AppendOutcome>;
}

/** Decides which evidence is still current. Pure. */
export interface CurrentEvidenceSelector {
  /**
   * Applies supersession: per user only their latest evidence counts, and a `withdrawn` latest
   * removes the user entirely. Evidence without a user is superseded per (kind, source).
   * "Latest" is newest observedAt, then newest importedAt, then the larger id.
   *
   * @returns the current evidence, with `withdrawn` entries removed. Order is unspecified.
   */
  current(evidence: readonly Evidence[]): Evidence[];
}
