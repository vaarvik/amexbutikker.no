import { PlaceSchema } from '@amexbutikker/contracts';
import type {
  Clock,
  CreatePlace,
  CreatePlaceInput,
  IdGenerator,
  InputValidator,
  Place,
  PlaceWriter,
  RateLimiter,
} from '@amexbutikker/contracts';

export class CreatePlaceUseCase implements CreatePlace {
  public constructor(
    private readonly places: PlaceWriter,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
    private readonly validator: InputValidator,
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
    await this.places.create(place);
    return place;
  }
}
