import { EVIDENCE_KINDS, ValidationError } from '@amexbutikker/contracts';
import type { EvidenceKind, EvidenceWeightPolicy } from '@amexbutikker/contracts';
import type { EvidenceWeight, EvidenceWeightConfig } from './status.model.js';
import { DEFAULT_EVIDENCE_WEIGHTS } from './status.model.js';

/** Weights and half-lives from a config table passed to the constructor. */
export class FixedEvidenceWeightPolicy implements EvidenceWeightPolicy {
  private readonly config: EvidenceWeightConfig;

  /** @throws ValidationError when any weight or half-life is not a positive finite number. */
  public constructor(config: EvidenceWeightConfig = DEFAULT_EVIDENCE_WEIGHTS) {
    const issues = EVIDENCE_KINDS.flatMap((kind) => {
      const entry = config[kind];
      return [
        ...(FixedEvidenceWeightPolicy.isPositiveFinite(entry.weight)
          ? []
          : [{ path: [kind, 'weight'], message: 'must be a positive finite number' }]),
        ...(FixedEvidenceWeightPolicy.isPositiveFinite(entry.halfLifeDays)
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
