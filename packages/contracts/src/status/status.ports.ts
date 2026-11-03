import type { AcceptanceResult, Evidence, EvidenceKind } from '../evidence/evidence.model.js';
import type { ReportNote, StatusBasisExplanation } from '../places/places.use-cases.js';
import type { StatusChangeOutput } from '../reports/reports.use-cases.js';
import type { TransactionalPorts } from '../unit-of-work.js';
import type { ChainId, PlaceId, UserId } from '../shared/shared.model.js';
import type { ChainHint, PlaceStatus, PlaceStatusSnapshot } from './status.model.js';

/** Read access to calculated place statuses. */
export interface PlaceStatusReader {
  /**
   * @returns the stored snapshot, or null when none has been calculated yet.
   */
  find(placeId: PlaceId): Promise<PlaceStatusSnapshot | null>;

  /**
   * Snapshots for several places at once, e.g. for a result list.
   *
   * @returns a map containing only the places that have a snapshot.
   */
  findMany(placeIds: readonly PlaceId[]): Promise<ReadonlyMap<PlaceId, PlaceStatusSnapshot>>;

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

export interface EvidenceSummary {
  readonly basis: StatusBasisExplanation;
  /** Up to `noteLimit` notes from users' current reports, newest first. */
  readonly latestNotes: readonly ReportNote[];
  /** The given user's current report on the place, or null. */
  readonly myReport: AcceptanceResult | null;
}

/** Explains a status in terms of the evidence behind it, for the place screen. Pure. */
export interface EvidenceSummarizer {
  /**
   * @param status the status calculated from the same evidence.
   * @param userId the caller, or null when anonymous; fills `myReport`.
   */
  summarize(
    placeEvidence: readonly Evidence[],
    chainEvidence: readonly Evidence[],
    status: PlaceStatus,
    userId: UserId | null,
  ): EvidenceSummary;
}

/** Recalculates and stores a place's status and its chain's hint. An application service. */
export interface PlaceStatusRefresher {
  /**
   * Reads the place's and chain's evidence through `ports`, calculates the status, saves the
   * snapshot and, for a chain place, recalculates and saves the chain hint.
   * Must run inside the unit of work that changed the evidence.
   *
   * @throws NotFoundError when the place does not exist.
   */
  refresh(ports: TransactionalPorts, placeId: PlaceId): Promise<StatusChangeOutput>;
}
