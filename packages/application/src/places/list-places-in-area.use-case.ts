import { AreaQuerySchema, UNKNOWN_PLACE_STATUS } from '@amexbutikker/contracts';
import type {
  AreaQuery,
  InputValidator,
  ListPlacesInArea,
  PlaceAreaOutput,
  PlaceReader,
  PlaceStatusReader,
} from '@amexbutikker/contracts';

/** The map: places in the visible area with their status. Asks for one extra to see a cut. */
export class ListPlacesInAreaUseCase implements ListPlacesInArea {
  public constructor(
    private readonly places: PlaceReader,
    private readonly statuses: PlaceStatusReader,
    private readonly validator: InputValidator,
  ) {}

  public async execute(input: AreaQuery): Promise<PlaceAreaOutput> {
    const query = this.validator.validate(AreaQuerySchema, input);
    const found = await this.places.listInArea({ ...query, limit: query.limit + 1 });
    const shown = found.slice(0, query.limit);
    const snapshots = await this.statuses.listByPlaces(shown.map((place) => place.id));
    return {
      results: shown.map((place) => ({
        place,
        status: snapshots.get(place.id)?.status ?? UNKNOWN_PLACE_STATUS,
        distanceM: null,
      })),
      truncated: found.length > query.limit,
    };
  }
}
