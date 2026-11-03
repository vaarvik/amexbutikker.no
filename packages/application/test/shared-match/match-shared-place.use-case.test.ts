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
import { EmptyInMemoryTablesFactory, InMemoryPlaceStatusRepository } from '@amexbutikker/in-memory';

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
  public constructor(private readonly result: ParsedSharedPlace = parsed) {}

  public parse(): ParsedSharedPlace {
    return this.result;
  }
}

class FixedResolver implements SharedLinkResolver {
  public readonly resolved: string[] = [];

  public constructor(
    private readonly link: ResolvedSharedLink | null = {
      name: 'Kafé Åsen',
      location: { lat: 59.9, lng: 10.7 },
    },
  ) {}

  public resolve(url: string): Promise<ResolvedSharedLink | null> {
    this.resolved.push(url);
    return Promise.resolve(this.link);
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

  function useCaseWith(
    parser: SharedTextParser,
    resolver: SharedLinkResolver,
    matcher: PlaceMatcher,
  ) {
    return new MatchSharedPlaceUseCase(
      parser,
      resolver,
      matcher,
      new ThresholdMatchDecider(),
      new InMemoryPlaceStatusRepository(new EmptyInMemoryTablesFactory().create()),
    );
  }

  it('does not resolve links when the text already has a name and a location', async () => {
    const complete = { ...parsed, name: 'Kafé Åsen', location: { lat: 59.9, lng: 10.7 } };
    const resolver = new FixedResolver();
    const matcher = new RecordingMatcher([]);

    await useCaseWith(new FixedParser(complete), resolver, matcher).execute({ text: 'anything' });

    expect(resolver.resolved).toEqual([]);
    expect(matcher.received).toEqual(complete);
  });

  it('keeps the parsed place when no link resolves', async () => {
    const matcher = new RecordingMatcher([]);

    const output = await useCaseWith(new FixedParser(), new FixedResolver(null), matcher).execute({
      text: 'anything',
    });

    expect(matcher.received).toEqual(parsed);
    expect(output.decision.type).not.toBe('open');
  });

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
