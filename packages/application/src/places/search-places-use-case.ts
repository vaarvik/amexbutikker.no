import { PlaceSearchQuerySchema, UNKNOWN_PLACE_STATUS } from '@amexbutikker/contracts';
import type {
  InputValidator,
  PlaceListOutput,
  PlaceReader,
  PlaceSearchQuery,
  PlaceStatusReader,
  SearchPlaces,
} from '@amexbutikker/contracts';

export class SearchPlacesUseCase implements SearchPlaces {
  public constructor(
    private readonly places: PlaceReader,
    private readonly statuses: PlaceStatusReader,
    private readonly validator: InputValidator,
  ) {}

  public async execute(input: PlaceSearchQuery): Promise<PlaceListOutput> {
    const query = this.validator.validate(PlaceSearchQuerySchema, input);
    const hits = await this.places.search(query);
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
