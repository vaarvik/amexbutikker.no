import type { EvidenceKind } from '@amexbutikker/contracts';

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
