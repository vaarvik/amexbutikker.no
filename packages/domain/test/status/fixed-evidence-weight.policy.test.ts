import { EVIDENCE_KINDS, ValidationError } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EVIDENCE_WEIGHTS, FixedEvidenceWeightPolicy } from '../../src/index.js';

describe('DefaultEvidenceWeightPolicy', () => {
  it('uses the documented defaults', () => {
    const policy = new FixedEvidenceWeightPolicy();
    const table = EVIDENCE_KINDS.map((kind) => [
      kind,
      policy.weightFor(kind),
      policy.halfLifeDays(kind),
    ]);

    expect(table).toEqual([
      ['transaction', 1.0, 365],
      ['visit_report', 0.8, 180],
      ['user_report', 0.6, 180],
      ['chain_confirmation', 0.5, 365],
      ['external_list', 0.25, 180],
      ['checkout_logo', 0.1, 90],
    ]);
  });

  it('orders default weights strongest first, like EVIDENCE_KINDS', () => {
    const weights = EVIDENCE_KINDS.map((kind) => DEFAULT_EVIDENCE_WEIGHTS[kind].weight);

    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it('takes its numbers from the constructor config', () => {
    const policy = new FixedEvidenceWeightPolicy({
      ...DEFAULT_EVIDENCE_WEIGHTS,
      user_report: { weight: 0.7, halfLifeDays: 30 },
    });

    expect(policy.weightFor('user_report')).toBe(0.7);
    expect(policy.halfLifeDays('user_report')).toBe(30);
    expect(policy.weightFor('transaction')).toBe(1.0);
  });

  it.each([
    ['zero weight', { weight: 0, halfLifeDays: 10 }],
    ['negative weight', { weight: -1, halfLifeDays: 10 }],
    ['zero half-life', { weight: 1, halfLifeDays: 0 }],
    ['infinite half-life', { weight: 1, halfLifeDays: Number.POSITIVE_INFINITY }],
    ['NaN weight', { weight: Number.NaN, halfLifeDays: 10 }],
  ])('rejects a config with %s', (_label, entry) => {
    expect(
      () => new FixedEvidenceWeightPolicy({ ...DEFAULT_EVIDENCE_WEIGHTS, checkout_logo: entry }),
    ).toThrow(ValidationError);
  });

  it('does not change when the config object is mutated afterwards', () => {
    const config = { ...DEFAULT_EVIDENCE_WEIGHTS, user_report: { weight: 0.6, halfLifeDays: 180 } };
    const policy = new FixedEvidenceWeightPolicy(config);
    config.user_report = { weight: 0.1, halfLifeDays: 1 };

    expect(policy.weightFor('user_report')).toBe(0.6);
  });
});
