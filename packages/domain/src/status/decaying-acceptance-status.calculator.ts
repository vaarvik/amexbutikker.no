import { SupersedingEvidenceSelector } from '../evidence/superseding-evidence.selector.js';
import {
  DIRECT_EVIDENCE_KINDS,
  EVIDENCE_KINDS,
  UNKNOWN_PLACE_STATUS,
  ValidationError,
} from '@amexbutikker/contracts';
import type {
  AcceptanceResult,
  AcceptanceStatusCalculator,
  CurrentEvidenceSelector,
  Evidence,
  EvidenceKind,
  EvidenceWeightPolicy,
  PlaceStatus,
  ValidationIssue,
} from '@amexbutikker/contracts';

export interface DecayingAcceptanceStatusCalculatorConfig {
  /** Share of decayed weight one side needs for accepted / rejected. In (0.5, 1]. Default 0.8. */
  readonly decisiveShare?: number;
  /** Below this total decayed weight the status is unknown. >= 0. Default 0.05. */
  readonly minimumTotalWeight?: number;
  /** Evidence older than this many of its half-lives is ignored entirely. > 0. Default 4. */
  readonly maxAgeInHalfLives?: number;
  /** Total decayed weight at which confidence is no longer scaled down. > 0. Default 1. */
  readonly fullConfidenceWeight?: number;
  /**
   * Decayed weight of users' own evidence (transaction, visit, report) the winning side needs
   * for accepted / rejected; below it the status is likely_accepted / likely_rejected. > 0.
   * Default 1: two fresh user reports or one purchase, so no single user decides alone.
   */
  readonly confirmedWeight?: number;
}

const DAY_MS = 86_400_000;
const EPSILON = 1e-9;
const DIRECT_KINDS: ReadonlySet<EvidenceKind> = new Set(DIRECT_EVIDENCE_KINDS);
const VERIFYING_KINDS: ReadonlySet<EvidenceKind> = new Set(['transaction', 'visit_report']);

interface WeightedEvidence {
  readonly kind: EvidenceKind;
  readonly result: AcceptanceResult;
  readonly observedAt: Date;
  readonly weight: number;
}

/**
 * Status from exponentially decaying evidence weights.
 *
 * 1. Supersession: per user, only their latest evidence counts (a withdrawal counts as nothing).
 *    Imported evidence without a user is superseded per (kind, source).
 * 2. Evidence older than `maxAgeInHalfLives` half-lives is dropped.
 * 3. If the place has any remaining direct evidence (transaction, visit_report, user_report),
 *    only that is used. Otherwise its indirect evidence and the chain's evidence are pooled.
 * 4. Weight = policy weight * 0.5^(age / half-life).
 * 5. Unknown below `minimumTotalWeight`; mixed when neither side has `decisiveShare` of the
 *    weight. Otherwise the winning side is accepted / rejected when its direct weight reaches
 *    `confirmedWeight`, and likely_accepted / likely_rejected below that.
 */
export class DecayingAcceptanceStatusCalculator implements AcceptanceStatusCalculator {
  private readonly decisiveShare: number;
  private readonly minimumTotalWeight: number;
  private readonly maxAgeInHalfLives: number;
  private readonly fullConfidenceWeight: number;
  private readonly confirmedWeight: number;

  /** @throws ValidationError when an option is out of range. */
  public constructor(
    private readonly policy: EvidenceWeightPolicy,
    options: DecayingAcceptanceStatusCalculatorConfig = {},
    private readonly selector: CurrentEvidenceSelector = new SupersedingEvidenceSelector(),
  ) {
    this.decisiveShare = options.decisiveShare ?? 0.8;
    this.minimumTotalWeight = options.minimumTotalWeight ?? 0.05;
    this.maxAgeInHalfLives = options.maxAgeInHalfLives ?? 4;
    this.fullConfidenceWeight = options.fullConfidenceWeight ?? 1;
    this.confirmedWeight = options.confirmedWeight ?? 1;

    const issues: ValidationIssue[] = [];
    if (!(this.decisiveShare > 0.5 && this.decisiveShare <= 1)) {
      issues.push({ path: ['decisiveShare'], message: 'must be in (0.5, 1]' });
    }
    if (!(Number.isFinite(this.minimumTotalWeight) && this.minimumTotalWeight >= 0)) {
      issues.push({ path: ['minimumTotalWeight'], message: 'must be a finite number >= 0' });
    }
    if (!(this.maxAgeInHalfLives > 0)) {
      issues.push({ path: ['maxAgeInHalfLives'], message: 'must be > 0' });
    }
    if (!(Number.isFinite(this.fullConfidenceWeight) && this.fullConfidenceWeight > 0)) {
      issues.push({ path: ['fullConfidenceWeight'], message: 'must be a finite number > 0' });
    }
    if (!(Number.isFinite(this.confirmedWeight) && this.confirmedWeight > 0)) {
      issues.push({ path: ['confirmedWeight'], message: 'must be a finite number > 0' });
    }
    if (issues.length > 0) {
      throw new ValidationError('Invalid acceptance status options.', issues);
    }
  }

  public calculate(
    placeEvidence: readonly Evidence[],
    chainEvidence: readonly Evidence[],
    now: Date,
  ): PlaceStatus {
    const place = this.weigh(this.current(placeEvidence), now);
    const direct = place.filter((evidence) => DIRECT_KINDS.has(evidence.kind));
    const pool =
      direct.length > 0 ? direct : [...place, ...this.weigh(this.current(chainEvidence), now)];

    return this.decide(pool);
  }

  /** Applies supersession; withdrawals are already gone. */
  private current(
    evidence: readonly Evidence[],
  ): (Evidence & { readonly result: AcceptanceResult })[] {
    return this.selector
      .current(evidence)
      .filter(
        (item): item is Evidence & { readonly result: AcceptanceResult } =>
          item.result !== 'withdrawn',
      );
  }

  private weigh(
    evidence: readonly (Evidence & { readonly result: AcceptanceResult })[],
    now: Date,
  ): WeightedEvidence[] {
    return evidence.flatMap((item) => {
      const halfLifeDays = this.policy.halfLifeDays(item.kind);
      const ageDays = Math.max(0, (now.getTime() - item.observedAt.getTime()) / DAY_MS);
      if (ageDays > this.maxAgeInHalfLives * halfLifeDays) {
        return [];
      }
      const weight = this.policy.weightFor(item.kind) * 0.5 ** (ageDays / halfLifeDays);
      return [{ kind: item.kind, result: item.result, observedAt: item.observedAt, weight }];
    });
  }

  private decide(pool: readonly WeightedEvidence[]): PlaceStatus {
    let accepted = 0;
    let rejected = 0;
    let directAccepted = 0;
    let directRejected = 0;
    for (const item of pool) {
      const direct = DIRECT_KINDS.has(item.kind) ? item.weight : 0;
      if (item.result === 'accepted') {
        accepted += item.weight;
        directAccepted += direct;
      } else {
        rejected += item.weight;
        directRejected += direct;
      }
    }
    const total = accepted + rejected;
    const [first] = pool;
    if (first === undefined || total < this.minimumTotalWeight || total <= 0) {
      return UNKNOWN_PLACE_STATUS;
    }

    const winningShare = Math.max(accepted, rejected) / total;
    const acceptedWins = accepted >= rejected;
    const confirmed =
      (acceptedWins ? directAccepted : directRejected) + EPSILON >= this.confirmedWeight;
    const status =
      winningShare + EPSILON < this.decisiveShare
        ? 'mixed'
        : acceptedWins
          ? confirmed
            ? 'accepted'
            : 'likely_accepted'
          : confirmed
            ? 'rejected'
            : 'likely_rejected';
    const confidence = Math.min(1, winningShare * Math.min(1, total / this.fullConfidenceWeight));

    return {
      status,
      confidence,
      basis: DecayingAcceptanceStatusCalculator.strongestKind(first, pool),
      verified: pool.some((item) => VERIFYING_KINDS.has(item.kind)),
      lastEvidenceAt: new Date(Math.max(...pool.map((item) => item.observedAt.getTime()))),
    };
  }

  private static strongestKind(
    first: WeightedEvidence,
    pool: readonly WeightedEvidence[],
  ): EvidenceKind {
    const rank = (kind: EvidenceKind): number => EVIDENCE_KINDS.indexOf(kind);
    return pool.reduce(
      (strongest, item) => (rank(item.kind) < rank(strongest) ? item.kind : strongest),
      first.kind,
    );
  }
}
