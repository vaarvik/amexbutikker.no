import type { PlaceCandidate } from '@amexbutikker/contracts';
import { ValidationError } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { describe, expect, it } from 'vitest';
import { ThresholdMatchDecider } from '../../src/index.js';

describe('ThresholdMatchDecider', () => {
  const decider = new ThresholdMatchDecider();
  const data = new TestData();
  const candidate = (score: number): PlaceCandidate => ({
    place: data.physicalPlace(),
    score,
    reasons: [],
  });

  it('opens a single strong candidate', () => {
    const top = candidate(0.9);

    expect(decider.decide([top])).toEqual({ type: 'open', placeId: top.place.id });
  });

  it('opens the top candidate when it is clearly ahead', () => {
    const top = candidate(0.85);

    expect(decider.decide([top, candidate(0.6)])).toEqual({ type: 'open', placeId: top.place.id });
  });

  it('lets the user choose when the top two are close', () => {
    expect(decider.decide([candidate(0.85), candidate(0.8)])).toEqual({ type: 'choose' });
  });

  it('lets the user choose when the top candidate is weak', () => {
    expect(decider.decide([candidate(0.5)])).toEqual({ type: 'choose' });
  });

  it('is none without candidates', () => {
    expect(decider.decide([])).toEqual({ type: 'none' });
  });

  it('uses the configured threshold and margin', () => {
    const lenient = new ThresholdMatchDecider({ openThreshold: 0.4, minimumLead: 0.01 });

    expect(lenient.decide([candidate(0.5), candidate(0.48)]).type).toBe('open');
  });

  it('rejects nonsensical options', () => {
    expect(() => new ThresholdMatchDecider({ openThreshold: 0 })).toThrow(ValidationError);
    expect(() => new ThresholdMatchDecider({ minimumLead: -0.1 })).toThrow(ValidationError);
  });
});
