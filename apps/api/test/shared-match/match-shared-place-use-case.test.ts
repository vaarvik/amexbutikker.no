import { MatchSharedPlaceUseCase } from '@amexbutikker/application';
import type {
  ParsedSharedPlace,
  PlaceCandidate,
  PlaceMatcher,
  ResolvedSharedLink,
  SharedLinkResolver,
  SharedTextParser,
} from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { ThresholdMatchDecider } from '@amexbutikker/domain';
import { describe, expect, it } from 'vitest';
import { EmptyInMemoryTablesFactory } from '../../src/shared/in-memory/in-memory-tables.js';
import { InMemoryPlaceStatusRepository } from '../../src/status/in-memory/in-memory-place-status-repository.js';

const parsed: ParsedSharedPlace = {
  provider: 'google_maps',
  name: null,
  street: 'Karl Johans gate 1',
  postcode: '0154',
  city: 'Oslo',
  location: null,
  urls: ['https://maps.app.goo.gl/abc'],
};

class FixedParser implements SharedTextParser {
  public parse(): ParsedSharedPlace {
    return parsed;
  }
}

class FixedResolver implements SharedLinkResolver {
  public resolve(): Promise<ResolvedSharedLink | null> {
    return Promise.resolve({ name: 'Kafé Åsen', location: { lat: 59.9, lng: 10.7 } });
  }
}

class RecordingMatcher implements PlaceMatcher {
  public received: ParsedSharedPlace | undefined;

  public constructor(private readonly candidates: PlaceCandidate[]) {}

  public match(input: ParsedSharedPlace): Promise<PlaceCandidate[]> {
    this.received = input;
    return Promise.resolve(this.candidates);
  }
}

describe('MatchSharedPlaceUseCase', () => {
  const data = new TestData();

  it('enriches the parsed place from its link, caps candidates at 3 and decides', async () => {
    const candidates = [0.95, 0.5, 0.4, 0.3].map((score) => ({
      place: data.physicalPlace(),
      score,
      reasons: [],
    }));
    const matcher = new RecordingMatcher(candidates);
    const useCase = new MatchSharedPlaceUseCase(
      new FixedParser(),
      new FixedResolver(),
      matcher,
      new ThresholdMatchDecider(),
      new InMemoryPlaceStatusRepository(new EmptyInMemoryTablesFactory().create()),
    );

    const output = await useCase.execute({ text: 'anything' });

    expect(matcher.received).toMatchObject({
      name: 'Kafé Åsen',
      location: { lat: 59.9, lng: 10.7 },
    });
    expect(output.candidates).toHaveLength(3);
    expect(output.candidates[0]?.status.status).toBe('unknown');
    expect(output.decision).toEqual({ type: 'open', placeId: candidates[0]?.place.id });
  });
});
