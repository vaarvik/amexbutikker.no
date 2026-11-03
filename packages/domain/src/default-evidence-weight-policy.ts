import { EVIDENCE_KINDS, ValidationError } from '@amexbutikker/contracts';
import type { EvidenceKind, EvidenceWeightPolicy } from '@amexbutikker/contracts';

export interface EvidenceWeight {
  /** Weight of fresh evidence, > 0. */
  readonly weight: number;
  /** Days for the weight to halve, > 0 and finite. */
  readonly halfLifeDays: number;
}

export type EvidenceWeightConfig = Readonly<Record<EvidenceKind, EvidenceWeight>>;

/**
 * Default weights and half-lives. Imported claims (`external_list`) store the source's
 * fetchedAt as observedAt, so their decay counts from when the source was read.
 */
export const DEFAULT_EVIDENCE_WEIGHTS: EvidenceWeightConfig = Object.freeze({
  transaction: { weight: 1.0, halfLifeDays: 365 },
  visit_report: { weight: 0.8, halfLifeDays: 180 },
  user_report: { weight: 0.6, halfLifeDays: 180 },
  chain_confirmation: { weight: 0.5, halfLifeDays: 365 },
  external_list: { weight: 0.25, halfLifeDays: 180 },
  checkout_logo: { weight: 0.1, halfLifeDays: 90 },
});

/** Weights and half-lives from a config table passed to the constructor. */
export class DefaultEvidenceWeightPolicy implements EvidenceWeightPolicy {
  private readonly config: EvidenceWeightConfig;

  /** @throws ValidationError when any weight or half-life is not a positive finite number. */
  public constructor(config: EvidenceWeightConfig = DEFAULT_EVIDENCE_WEIGHTS) {
    const issues = EVIDENCE_KINDS.flatMap((kind) => {
      const entry = config[kind];
      return [
        ...(DefaultEvidenceWeightPolicy.isPositiveFinite(entry.weight)
          ? []
          : [{ path: [kind, 'weight'], message: 'must be a positive finite number' }]),
        ...(DefaultEvidenceWeightPolicy.isPositiveFinite(entry.halfLifeDays)
          ? []
          : [{ path: [kind, 'halfLifeDays'], message: 'must be a positive finite number' }]),
      ];
    });
    if (issues.length > 0) {
      throw new ValidationError('Invalid evidence weight config.', issues);
    }
    this.config = Object.freeze(
      Object.fromEntries(EVIDENCE_KINDS.map((kind) => [kind, { ...config[kind] }])) as Record<
        EvidenceKind,
        EvidenceWeight
      >,
    );
  }

  public weightFor(kind: EvidenceKind): number {
    return this.config[kind].weight;
  }

  public halfLifeDays(kind: EvidenceKind): number {
    return this.config[kind].halfLifeDays;
  }

  private static isPositiveFinite(value: number): boolean {
    return Number.isFinite(value) && value > 0;
  }
}
