import { DuplicatePlaceError, PlaceSchema } from '@amexbutikker/contracts';
import type {
  Clock,
  CreatePlace,
  CreatePlaceInput,
  ExistingPlace,
  IdGenerator,
  InputValidator,
  Place,
  PlaceDuplicateMatcher,
  PlaceReader,
  PlaceWriter,
  RateLimiter,
} from '@amexbutikker/contracts';

export interface CreatePlaceUseCaseConfig {
  /** How far around a new physical place to look for one we already have, in metres. */
  readonly duplicateRadiusM: number;
  /** How many stored places to compare against. */
  readonly duplicateCandidates: number;
}

export class CreatePlaceUseCase implements CreatePlace {
  public constructor(
    private readonly reader: PlaceReader,
    private readonly places: PlaceWriter,
    private readonly duplicates: PlaceDuplicateMatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
    private readonly validator: InputValidator,
    private readonly config: CreatePlaceUseCaseConfig,
  ) {}

  public async execute(input: CreatePlaceInput): Promise<Place> {
    await this.rateLimiter.consume({ action: 'create_place', key: input.userId });
    const base = { id: this.ids.placeId(), name: input.name, createdAt: this.clock.now() };
    const place = this.validator.validate(
      PlaceSchema,
      input.kind === 'online'
        ? { ...base, kind: 'online', category: 'online_shop', website: input.website }
        : {
            ...base,
            kind: 'physical',
            category: input.category,
            website: input.website,
            chainId: null,
            address: input.address,
            location: input.location,
            osmRef: null,
            brregOrgnr: null,
          },
    );
    if (input.allowDuplicate !== true) {
      const existing = this.duplicates.findDuplicate(place, await this.neighbours(place));
      if (existing !== null) {
        throw new DuplicatePlaceError(existing);
      }
    }
    await this.places.create(place);
    return place;
  }

  /** Stored physical places around it, or online shops with a similar name. */
  private async neighbours(place: Place): Promise<ExistingPlace[]> {
    if (place.kind === 'physical') {
      return this.reader.listNearby({
        center: place.location,
        radiusM: this.config.duplicateRadiusM,
        limit: this.config.duplicateCandidates,
      });
    }
    // By name, and by the website's name ("komplett" for www.komplett.no), since a shop may be
    // stored under another name. There is no lookup by website.
    const texts = new Set([place.name, this.siteName(place.website)]);
    const found = new Map<string, ExistingPlace>();
    for (const text of texts) {
      if (text === '') continue;
      const hits = await this.reader.search({
        text,
        kind: 'online',
        limit: this.config.duplicateCandidates,
      });
      for (const hit of hits) {
        found.set(hit.place.id, { place: hit.place, distanceM: null });
      }
    }
    return [...found.values()];
  }

  private siteName(website: string): string {
    try {
      const labels = new URL(website).hostname.replace(/^www\./, '').split('.');
      return labels.length > 1 ? labels.slice(0, -1).join(' ') : '';
    } catch {
      return '';
    }
  }
}
