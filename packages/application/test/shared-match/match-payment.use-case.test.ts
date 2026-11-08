import { MatchPaymentUseCase, ZodInputValidator } from '@amexbutikker/application';
import { ValidationError } from '@amexbutikker/contracts';
import type { ParsedSharedPlace, PlaceCandidate, PlaceMatcher } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { RegexMerchantNameParser, ThresholdMatchDecider } from '@amexbutikker/domain';
import { EmptyInMemoryTablesFactory, InMemoryPlaceStatusRepository } from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

class RecordingMatcher implements PlaceMatcher {
  public received: ParsedSharedPlace | undefined;

  public constructor(private readonly candidates: PlaceCandidate[]) {}

  public match(input: ParsedSharedPlace): Promise<PlaceCandidate[]> {
    this.received = input;
    return Promise.resolve(this.candidates);
  }
}

describe('MatchPaymentUseCase', () => {
  const data = new TestData();
  const here = { lat: 59.9133, lng: 10.7389 };

  function useCaseWith(matcher: PlaceMatcher) {
    return new MatchPaymentUseCase(
      new RegexMerchantNameParser(),
      matcher,
      new ThresholdMatchDecider({ openThreshold: 0.7, minimumLead: 0.15 }),
      new InMemoryPlaceStatusRepository(new EmptyInMemoryTablesFactory().create()),
      new ZodInputValidator(),
    );
  }

  it('matches on the cleaned merchant name and the phone position', async () => {
    const matcher = new RecordingMatcher([]);

    const output = await useCaseWith(matcher).execute({
      merchant: 'SQ *KAFFEBRENNERIET AS',
      location: here,
    });

    expect(matcher.received).toEqual({
      provider: 'unknown',
      name: 'KAFFEBRENNERIET',
      street: null,
      postcode: null,
      city: null,
      location: here,
      urls: [],
    });
    expect(output).toEqual({
      merchantName: 'KAFFEBRENNERIET',
      candidates: [],
      decision: { type: 'none' },
    });
  });

  it('opens one clear place, with its status, and caps candidates at 3', async () => {
    const candidates = [0.9, 0.5, 0.4, 0.3].map((score) => ({
      place: data.physicalPlace(),
      score,
      reasons: [],
    }));

    const output = await useCaseWith(new RecordingMatcher(candidates)).execute({
      merchant: 'Kaffebrenneriet',
      location: here,
    });

    expect(output.candidates).toHaveLength(3);
    expect(output.candidates[0]?.status.status).toBe('unknown');
    expect(output.decision).toEqual({ type: 'open', placeId: candidates[0]?.place.id });
  });

  it('asks when the top place is not clear enough to save without asking', async () => {
    const candidates = [{ place: data.physicalPlace(), score: 0.65, reasons: [] }];

    const output = await useCaseWith(new RecordingMatcher(candidates)).execute({
      merchant: 'Kaffebrenneriet',
      location: null,
    });

    expect(output.decision).toEqual({ type: 'choose' });
  });

  it('does not match when nothing usable is left of the merchant name', async () => {
    const matcher = new RecordingMatcher([{ place: data.physicalPlace(), score: 1, reasons: [] }]);

    const output = await useCaseWith(matcher).execute({ merchant: 'SQ *', location: here });

    expect(matcher.received).toBeUndefined();
    expect(output).toEqual({ merchantName: null, candidates: [], decision: { type: 'none' } });
  });

  it.each(['', 'x'.repeat(201)])('rejects the merchant name %#', async (merchant) => {
    await expect(
      useCaseWith(new RecordingMatcher([])).execute({ merchant, location: null }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
