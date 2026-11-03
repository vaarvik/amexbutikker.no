import type { Evidence, EvidenceKind } from '../evidence/evidence.model.js';
import type { ChainId, PlaceId } from '../shared/shared.model.js';
import type { ChainHint, PlaceStatus, PlaceStatusSnapshot } from './status.model.js';

/** Read access to calculated place statuses. */
export interface PlaceStatusReader {
  /**
   * @returns the stored snapshot, or null when none has been calculated yet.
   */
  get(placeId: PlaceId): Promise<PlaceStatusSnapshot | null>;

  /**
   * Snapshots for several places at once, e.g. for a result list.
   *
   * @returns a map containing only the places that have a snapshot.
   */
  getMany(placeIds: readonly PlaceId[]): Promise<ReadonlyMap<PlaceId, PlaceStatusSnapshot>>;

  /**
   * Snapshots of every place in the chain that has one. Order is unspecified.
   */
  listForChain(chainId: ChainId): Promise<PlaceStatusSnapshot[]>;
}

/** Write access to calculated place statuses. */
export interface PlaceStatusWriter {
  /**
   * Stores the snapshot, replacing any earlier one for the same place.
   *
   * @throws NotFoundError when the place does not exist.
   */
  save(snapshot: PlaceStatusSnapshot): Promise<void>;
}

/** Weights and half-lives per evidence kind. The single place these numbers live. */
export interface EvidenceWeightPolicy {
  /** Weight of fresh evidence of this kind, > 0. */
  weightFor(kind: EvidenceKind): number;
  /** Days after which the weight has halved, > 0. Counted from `observedAt`. */
  halfLifeDays(kind: EvidenceKind): number;
}

/** Turns evidence into the status users see. Pure. */
export interface AcceptanceStatusCalculator {
  /**
   * @param placeEvidence evidence targeting the place, any order, may include superseded and withdrawn entries.
   * @param chainEvidence evidence targeting the place's chain; empty for places without a chain.
   * @param now the instant decay is measured to.
   *
   * Invariants:
   * - Only the latest evidence per user counts for the place (a `withdrawn` latest means none).
   * - Direct evidence (transaction, visit_report, user_report) on the place, when present,
   *   decides alone; chain_confirmation and external_list only apply without it.
   * - Deterministic: same input, same output. Input order does not matter.
   */
  calculate(
    placeEvidence: readonly Evidence[],
    chainEvidence: readonly Evidence[],
    now: Date,
  ): PlaceStatus;
}

/** Summarises how a chain's places do. Pure. */
export interface ChainHintCalculator {
  /**
   * @param statuses statuses of the chain's places. Only those with a direct basis count.
   * @returns a hint with `calculatedAt = now`.
   */
  calculate(chainId: ChainId, statuses: readonly PlaceStatus[], now: Date): ChainHint;
}
