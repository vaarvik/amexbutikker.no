import type { ChainId, Evidence, PlaceId } from '@amexbutikker/contracts';
import { UNKNOWN_PLACE_STATUS, ValidationError } from '@amexbutikker/contracts';
import { TestData, daysAfter } from '@amexbutikker/contracts/test-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { DecayingAcceptanceStatusCalculator, FixedEvidenceWeightPolicy } from '../../src/index.js';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const daysAgo = (days: number): Date => daysAfter(NOW, -days);

describe('DecayingAcceptanceStatusCalculator', () => {
  const policy = new FixedEvidenceWeightPolicy();
  const calculator = new DecayingAcceptanceStatusCalculator(policy);

  let data: TestData;
  let placeId: PlaceId;
  let chainId: ChainId;

  beforeEach(() => {
    data = new TestData();
    placeId = data.placeId();
    chainId = data.chainId();
  });

  const onPlace = (overrides: Partial<Evidence> = {}): Evidence =>
    data.evidence({ target: { type: 'place', placeId }, observedAt: NOW, ...overrides });

  const imported = (overrides: Partial<Evidence> = {}): Evidence =>
    onPlace({ kind: 'external_list', source: 'kredittkort360', userId: null, ...overrides });

  const onChain = (overrides: Partial<Evidence> = {}): Evidence =>
    data.evidence({
      target: { type: 'chain', chainId },
      kind: 'chain_confirmation',
      source: 'curated',
      userId: null,
      observedAt: NOW,
      ...overrides,
    });

  describe('required cases', () => {
    it('only an external claim: likely accepted, unverified, low confidence', () => {
      const status = calculator.calculate([imported({ observedAt: daysAgo(10) })], [], NOW);

      expect(status.status).toBe('likely_accepted');
      expect(status.basis).toBe('external_list');
      expect(status.verified).toBe(false);
      expect(status.lastEvidenceAt).toEqual(daysAgo(10));
      expect(status.confidence).toBeGreaterThan(0);
      expect(status.confidence).toBeLessThan(0.3);
    });

    it('one fresh rejection against an old external claim: the rejection wins', () => {
      const status = calculator.calculate(
        [
          imported({ observedAt: daysAgo(200) }),
          onPlace({ result: 'rejected', observedAt: daysAgo(1) }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('likely_rejected');
      expect(status.basis).toBe('user_report');
      expect(status.lastEvidenceAt).toEqual(daysAgo(1));
    });

    it('a user changing their report: only the latest one counts', () => {
      const userId = data.userId();
      const status = calculator.calculate(
        [
          onPlace({ userId, result: 'accepted', observedAt: daysAgo(30) }),
          onPlace({ userId, result: 'rejected', observedAt: daysAgo(2) }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('likely_rejected');
      expect(status.lastEvidenceAt).toEqual(daysAgo(2));
    });

    it('chain confirmed but this store rejects: the store wins', () => {
      const status = calculator.calculate(
        [onPlace({ result: 'rejected', observedAt: daysAgo(5) })],
        [onChain({ result: 'accepted', observedAt: daysAgo(1) })],
        NOW,
      );

      expect(status.status).toBe('likely_rejected');
      expect(status.basis).toBe('user_report');
    });

    it('all evidence older than four half-lives: unknown', () => {
      const status = calculator.calculate(
        [
          onPlace({ kind: 'transaction', observedAt: daysAgo(4 * 365 + 1) }),
          onPlace({ kind: 'visit_report', observedAt: daysAgo(4 * 180 + 1) }),
          onPlace({ observedAt: daysAgo(4 * 180 + 1) }),
          imported({ observedAt: daysAgo(4 * 180 + 1) }),
        ],
        [onChain({ observedAt: daysAgo(4 * 365 + 1) })],
        NOW,
      );

      expect(status).toEqual(UNKNOWN_PLACE_STATUS);
    });

    it('an online place with mixed reports: mixed', () => {
      const status = calculator.calculate(
        [
          onPlace({ result: 'accepted', observedAt: daysAgo(3) }),
          onPlace({ result: 'accepted', observedAt: daysAgo(4) }),
          onPlace({ result: 'rejected', observedAt: daysAgo(5) }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('mixed');
      expect(status.basis).toBe('user_report');
      expect(status.lastEvidenceAt).toEqual(daysAgo(3));
    });
  });

  describe('confirmation by users', () => {
    const user = () => data.userId();

    it('stays likely with one fresh user report, however strong the list support', () => {
      const status = calculator.calculate(
        [onPlace({ userId: user() })],
        [onChain(), onChain({ source: 'other' })],
        NOW,
      );

      expect(status.status).toBe('likely_accepted');
    });

    it('is accepted with two fresh user reports', () => {
      const status = calculator.calculate(
        [onPlace({ userId: user() }), onPlace({ userId: user() })],
        [],
        NOW,
      );

      expect(status.status).toBe('accepted');
    });

    it('is accepted with one purchase', () => {
      const status = calculator.calculate([onPlace({ kind: 'transaction' })], [], NOW);

      expect(status.status).toBe('accepted');
    });

    it('is rejected with two fresh rejections', () => {
      const status = calculator.calculate(
        [
          onPlace({ userId: user(), result: 'rejected' }),
          onPlace({ userId: user(), result: 'rejected' }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('rejected');
    });

    it('falls back to likely when confirmations age below the threshold', () => {
      // Two reports at half weight each: 0.3 + 0.3 = 0.6 < 1.
      const status = calculator.calculate(
        [
          onPlace({ userId: user(), observedAt: daysAgo(180) }),
          onPlace({ userId: user(), observedAt: daysAgo(180) }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('likely_accepted');
    });

    it('is mixed when users disagree, before any confirmation question', () => {
      const status = calculator.calculate(
        [onPlace({ userId: user() }), onPlace({ userId: user(), result: 'rejected' })],
        [],
        NOW,
      );

      expect(status.status).toBe('mixed');
    });

    it('counts only the winning side towards confirmation', () => {
      // Accepted 1.2 + rejected 0.6 = 67 % < 80 %: mixed, even though accepted alone is confirmed.
      const disputed = calculator.calculate(
        [
          onPlace({ userId: user() }),
          onPlace({ userId: user() }),
          onPlace({ userId: user(), result: 'rejected' }),
        ],
        [],
        NOW,
      );
      const loose = new DecayingAcceptanceStatusCalculator(policy, {
        decisiveShare: 0.6,
        confirmedWeight: 1,
      });
      const decided = loose.calculate(
        [
          onPlace({ userId: user() }),
          onPlace({ userId: user(), result: 'rejected' }),
          onPlace({ userId: user(), result: 'rejected' }),
        ],
        [],
        NOW,
      );

      expect(disputed.status).toBe('mixed');
      expect(decided.status).toBe('rejected');
    });

    it('takes the threshold from its config', () => {
      const trusting = new DecayingAcceptanceStatusCalculator(policy, { confirmedWeight: 0.5 });

      expect(trusting.calculate([onPlace({ userId: user() })], [], NOW).status).toBe('accepted');
      expect(() => new DecayingAcceptanceStatusCalculator(policy, { confirmedWeight: 0 })).toThrow(
        ValidationError,
      );
    });
  });

  describe('no evidence', () => {
    it('is unknown', () => {
      expect(calculator.calculate([], [], NOW)).toEqual(UNKNOWN_PLACE_STATUS);
    });
  });

  describe('thresholds', () => {
    it('is accepted at exactly 80 % of the decayed weight', () => {
      const status = calculator.calculate(
        [
          ...[1, 2, 3, 4].map(() => onPlace({ result: 'accepted' })),
          onPlace({ result: 'rejected' }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('accepted');
    });

    it('is mixed just below 80 %', () => {
      const status = calculator.calculate(
        [...[1, 2, 3].map(() => onPlace({ result: 'accepted' })), onPlace({ result: 'rejected' })],
        [],
        NOW,
      );

      expect(status.status).toBe('mixed');
    });

    it('is unknown when the total decayed weight is below the configured minimum', () => {
      const strict = new DecayingAcceptanceStatusCalculator(policy, { minimumTotalWeight: 0.5 });

      expect(strict.calculate([imported()], [], NOW).status).toBe('unknown');
      expect(strict.calculate([onPlace()], [], NOW).status).toBe('likely_accepted');
    });

    it('rejects nonsensical options', () => {
      expect(() => new DecayingAcceptanceStatusCalculator(policy, { decisiveShare: 0.5 })).toThrow(
        ValidationError,
      );
      expect(() => new DecayingAcceptanceStatusCalculator(policy, { decisiveShare: 1.01 })).toThrow(
        ValidationError,
      );
      expect(
        () => new DecayingAcceptanceStatusCalculator(policy, { minimumTotalWeight: -1 }),
      ).toThrow(ValidationError);
      expect(
        () => new DecayingAcceptanceStatusCalculator(policy, { maxAgeInHalfLives: 0 }),
      ).toThrow(ValidationError);
      expect(
        () => new DecayingAcceptanceStatusCalculator(policy, { fullConfidenceWeight: 0 }),
      ).toThrow(ValidationError);
    });
  });

  describe('decay', () => {
    it('halves the weight after one half-life', () => {
      // One fresh user report (0.6) against one transaction a half-life old (1.0 -> 0.5).
      const status = calculator.calculate(
        [
          onPlace({ kind: 'transaction', result: 'rejected', observedAt: daysAgo(365) }),
          onPlace({ result: 'accepted' }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('mixed');
      expect(status.confidence).toBeCloseTo((0.6 / 1.1) * 1, 5);
    });

    it('lets a fresher, weaker report outweigh a much older stronger one', () => {
      const status = calculator.calculate(
        [
          onPlace({ kind: 'visit_report', result: 'rejected', observedAt: daysAgo(3 * 180) }),
          onPlace({ result: 'accepted' }),
        ],
        [],
        NOW,
      );

      // 0.8 / 8 = 0.1 rejected vs 0.6 accepted: 86 % accepted.
      expect(status.status).toBe('likely_accepted');
      expect(status.basis).toBe('visit_report');
      expect(status.verified).toBe(true);
    });

    it('treats evidence from the future as fresh', () => {
      const status = calculator.calculate([onPlace({ observedAt: daysAfter(NOW, 2) })], [], NOW);

      expect(status.status).toBe('likely_accepted');
      expect(status.confidence).toBeCloseTo(0.6, 5);
    });
  });

  describe('confidence', () => {
    it('reaches 1 for unanimous evidence at or above the full-confidence weight', () => {
      const status = calculator.calculate([onPlace({ kind: 'transaction' })], [], NOW);

      expect(status.confidence).toBe(1);
    });

    it('scales with total weight below the full-confidence weight', () => {
      const status = calculator.calculate([onPlace()], [], NOW);

      expect(status.confidence).toBeCloseTo(0.6, 5);
    });

    it('stays within 0..1', () => {
      const status = calculator.calculate(
        Array.from({ length: 20 }, () => onPlace({ kind: 'transaction' })),
        [],
        NOW,
      );

      expect(status.confidence).toBe(1);
    });
  });

  describe('precedence', () => {
    it('uses chain confirmation when the place has no direct evidence', () => {
      const status = calculator.calculate([], [onChain({ observedAt: daysAgo(30) })], NOW);

      expect(status.status).toBe('likely_accepted');
      expect(status.basis).toBe('chain_confirmation');
      expect(status.verified).toBe(false);
    });

    it('combines chain confirmation with indirect claims on the place', () => {
      const status = calculator.calculate(
        [imported({ result: 'rejected' })],
        [onChain({ result: 'accepted' })],
        NOW,
      );

      // 0.5 accepted vs 0.25 rejected.
      expect(status.status).toBe('mixed');
      expect(status.basis).toBe('chain_confirmation');
    });

    it('ignores chain and external evidence whenever direct evidence exists', () => {
      const status = calculator.calculate(
        [onPlace({ result: 'accepted' }), imported({ result: 'rejected' })],
        [
          onChain({ result: 'rejected' }),
          onChain({ result: 'rejected', sourceRef: 'b', source: 'other' }),
        ],
        NOW,
      );

      expect(status.status).toBe('likely_accepted');
      expect(status.confidence).toBeCloseTo(0.6, 5);
      expect(status.lastEvidenceAt).toEqual(NOW);
    });

    it('falls back to chain evidence once direct evidence has fully decayed', () => {
      const status = calculator.calculate(
        [onPlace({ result: 'rejected', observedAt: daysAgo(4 * 180 + 1) })],
        [onChain({ result: 'accepted' })],
        NOW,
      );

      expect(status.status).toBe('likely_accepted');
      expect(status.basis).toBe('chain_confirmation');
    });

    it('ignores checkout_logo when direct evidence exists', () => {
      const status = calculator.calculate(
        [
          onPlace({ result: 'rejected' }),
          imported({ kind: 'checkout_logo', result: 'accepted', source: 'osm' }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('likely_rejected');
    });
  });

  describe('supersession', () => {
    it('drops a user who withdrew their report', () => {
      const userId = data.userId();
      const status = calculator.calculate(
        [
          onPlace({ userId, result: 'rejected', observedAt: daysAgo(10) }),
          onPlace({ userId, result: 'withdrawn', observedAt: daysAgo(1) }),
        ],
        [],
        NOW,
      );

      expect(status).toEqual(UNKNOWN_PLACE_STATUS);
    });

    it('counts a report made after a withdrawal', () => {
      const userId = data.userId();
      const status = calculator.calculate(
        [
          onPlace({ userId, result: 'rejected', observedAt: daysAgo(10) }),
          onPlace({ userId, result: 'withdrawn', observedAt: daysAgo(5) }),
          onPlace({ userId, result: 'accepted', observedAt: daysAgo(1) }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('likely_accepted');
    });

    it('lets a user’s latest evidence of any kind replace their earlier evidence', () => {
      const userId = data.userId();
      const status = calculator.calculate(
        [
          onPlace({ userId, kind: 'transaction', result: 'accepted', observedAt: daysAgo(10) }),
          onPlace({ userId, kind: 'user_report', result: 'rejected', observedAt: daysAgo(1) }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('likely_rejected');
      expect(status.verified).toBe(false);
    });

    it('breaks observedAt ties by importedAt', () => {
      const userId = data.userId();
      const status = calculator.calculate(
        [
          onPlace({ userId, result: 'accepted', observedAt: daysAgo(1), importedAt: daysAgo(1) }),
          onPlace({ userId, result: 'rejected', observedAt: daysAgo(1), importedAt: NOW }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('likely_rejected');
    });

    it('keeps only the newest claim per source and kind for imported evidence', () => {
      const status = calculator.calculate(
        [
          imported({ result: 'accepted', observedAt: daysAgo(100), sourceRef: 'claim-2025' }),
          imported({ result: 'rejected', observedAt: daysAgo(10), sourceRef: 'claim-2026' }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('likely_rejected');
    });

    it('counts imported claims from different sources separately', () => {
      const status = calculator.calculate(
        [
          imported({ result: 'accepted', source: 'kredittkort360' }),
          imported({ result: 'rejected', source: 'amexvenn' }),
        ],
        [],
        NOW,
      );

      expect(status.status).toBe('mixed');
    });

    it('ignores a withdrawal without a user', () => {
      const status = calculator.calculate([imported({ result: 'withdrawn' }), onPlace()], [], NOW);

      expect(status.status).toBe('likely_accepted');
    });
  });

  describe('basis and verification', () => {
    it('reports the strongest contributing kind and verifies on a transaction', () => {
      const status = calculator.calculate(
        [onPlace(), onPlace({ kind: 'transaction', observedAt: daysAgo(40) })],
        [],
        NOW,
      );

      expect(status.basis).toBe('transaction');
      expect(status.verified).toBe(true);
      expect(status.lastEvidenceAt).toEqual(NOW);
    });

    it('does not count fully decayed evidence towards basis or verified', () => {
      const status = calculator.calculate(
        [onPlace(), onPlace({ kind: 'transaction', observedAt: daysAgo(4 * 365 + 1) })],
        [],
        NOW,
      );

      expect(status.basis).toBe('user_report');
      expect(status.verified).toBe(false);
    });
  });

  it('does not depend on input order', () => {
    const evidence = [
      onPlace({ result: 'accepted', observedAt: daysAgo(3) }),
      onPlace({ kind: 'visit_report', result: 'rejected', observedAt: daysAgo(40) }),
      imported({ observedAt: daysAgo(2) }),
      onPlace({ result: 'accepted', observedAt: daysAgo(9) }),
    ];
    const chain = [onChain()];

    const forward = calculator.calculate(evidence, chain, NOW);
    const backward = calculator.calculate([...evidence].reverse(), [...chain].reverse(), NOW);

    expect(backward).toEqual(forward);
  });
});
