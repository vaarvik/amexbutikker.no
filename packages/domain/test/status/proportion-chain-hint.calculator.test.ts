import type { AcceptanceStatus, EvidenceKind, PlaceStatus } from '@amexbutikker/contracts';
import { UNKNOWN_PLACE_STATUS } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { describe, expect, it } from 'vitest';
import { ProportionChainHintCalculator } from '../../src/index.js';

const NOW = new Date('2026-11-03T12:00:00.000Z');

function status(value: AcceptanceStatus, basis: EvidenceKind): PlaceStatus {
  return {
    status: value,
    confidence: 0.8,
    basis,
    verified: basis === 'transaction',
    lastEvidenceAt: NOW,
  };
}

describe('ProportionChainHintCalculator', () => {
  const calculator = new ProportionChainHintCalculator();
  const chainId = new TestData().chainId();

  it('counts accepted and likely accepted places among places with direct evidence', () => {
    const hint = calculator.calculate(
      chainId,
      [
        status('accepted', 'user_report'),
        status('accepted', 'transaction'),
        status('accepted', 'visit_report'),
        status('likely_accepted', 'user_report'),
        status('rejected', 'user_report'),
        status('likely_rejected', 'user_report'),
        status('mixed', 'user_report'),
      ],
      NOW,
    );

    // Likely accepted counts: it also comes from users' own answers.
    expect(hint).toEqual({ chainId, acceptedCount: 4, totalWithEvidence: 7, calculatedAt: NOW });
  });

  it('ignores places whose status comes from chain or external evidence, or is unknown', () => {
    const hint = calculator.calculate(
      chainId,
      [
        status('accepted', 'chain_confirmation'),
        status('accepted', 'external_list'),
        status('accepted', 'checkout_logo'),
        UNKNOWN_PLACE_STATUS,
        status('rejected', 'user_report'),
      ],
      NOW,
    );

    expect(hint).toEqual({ chainId, acceptedCount: 0, totalWithEvidence: 1, calculatedAt: NOW });
  });

  it('is 0 of 0 for a chain without direct evidence', () => {
    expect(calculator.calculate(chainId, [], NOW)).toEqual({
      chainId,
      acceptedCount: 0,
      totalWithEvidence: 0,
      calculatedAt: NOW,
    });
  });
});
