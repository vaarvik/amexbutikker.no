import { UNKNOWN_PLACE_STATUS } from '@amexbutikker/contracts';
import type {
  MatchDecider,
  MatchSharedPlace,
  MatchSharedPlaceInput,
  MatchSharedPlaceOutput,
  ParsedSharedPlace,
  PlaceMatcher,
  PlaceStatusReader,
  SharedLinkResolver,
  SharedTextParser,
} from '@amexbutikker/contracts';

export class MatchSharedPlaceUseCase implements MatchSharedPlace {
  public constructor(
    private readonly parser: SharedTextParser,
    private readonly resolver: SharedLinkResolver,
    private readonly matcher: PlaceMatcher,
    private readonly decider: MatchDecider,
    private readonly statuses: PlaceStatusReader,
  ) {}

  public async execute(input: MatchSharedPlaceInput): Promise<MatchSharedPlaceOutput> {
    const parsed = await this.enrich(this.parser.parse(input.text));
    const candidates = (await this.matcher.match(parsed)).slice(0, 3);
    const snapshots = await this.statuses.getMany(
      candidates.map((candidate) => candidate.place.id),
    );
    return {
      parsed,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        status: snapshots.get(candidate.place.id)?.status ?? UNKNOWN_PLACE_STATUS,
      })),
      decision: this.decider.decide(candidates),
    };
  }

  /** Fills a missing name or location from the first link the resolver understands. */
  private async enrich(parsed: ParsedSharedPlace): Promise<ParsedSharedPlace> {
    if (parsed.name !== null && parsed.location !== null) {
      return parsed;
    }
    for (const url of parsed.urls) {
      const resolved = await this.resolver.resolve(url);
      if (resolved !== null) {
        return {
          ...parsed,
          name: parsed.name ?? resolved.name,
          location: parsed.location ?? resolved.location,
        };
      }
    }
    return parsed;
  }
}
