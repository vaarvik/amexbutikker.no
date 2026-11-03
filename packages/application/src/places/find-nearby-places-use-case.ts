import { NearbyQuerySchema, UNKNOWN_PLACE_STATUS } from '@amexbutikker/contracts';
import type {
  FindNearbyPlaces,
  InputValidator,
  NearbyQuery,
  PlaceListOutput,
  PlaceReader,
  PlaceStatusReader,
} from '@amexbutikker/contracts';

export class FindNearbyPlacesUseCase implements FindNearbyPlaces {
  public constructor(
    private readonly places: PlaceReader,
    private readonly statuses: PlaceStatusReader,
    private readonly validator: InputValidator,
  ) {}

  public async execute(input: NearbyQuery): Promise<PlaceListOutput> {
    const query = this.validator.validate(NearbyQuerySchema, input);
    const hits = await this.places.nearby(query);
    const snapshots = await this.statuses.getMany(hits.map((hit) => hit.place.id));
    return {
      results: hits.map((hit) => ({
        place: hit.place,
        status: snapshots.get(hit.place.id)?.status ?? UNKNOWN_PLACE_STATUS,
        distanceM: hit.distanceM,
      })),
    };
  }
}
