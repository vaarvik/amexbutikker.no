import {
  CreatePlaceRequestDtoSchema,
  CreatePlaceResponseDtoSchema,
  NearbyPlacesQueryDtoSchema,
  PlaceDetailsResponseDtoSchema,
  PlaceIdParamsDtoSchema,
  PlaceAreaResponseDtoSchema,
  PlaceListResponseDtoSchema,
  PlacesInAreaQueryDtoSchema,
  SearchPlacesQueryDtoSchema,
} from '@amexbutikker/contracts';
import type {
  CreatePlace,
  GetPlaceDetails,
  InputValidator,
  ListNearbyPlaces,
  ListPlacesInArea,
  PlaceFilter,
  PlaceFilterQueryDto,
  SearchPlaces,
} from '@amexbutikker/contracts';
import type { FastifyInstance } from 'fastify';
import type {
  HttpController,
  HttpDtoMapper,
  RequestAuthenticator,
} from '../shared/shared.ports.js';

export interface PlacesControllerConfig {
  readonly searchLimit: number;
  readonly nearbyLimit: number;
  /** Most places the map gets for one area. */
  readonly areaLimit: number;
  readonly defaultRadiusM: number;
}

export class PlacesController implements HttpController {
  public constructor(
    private readonly searchPlaces: SearchPlaces,
    private readonly listNearbyPlaces: ListNearbyPlaces,
    private readonly listPlacesInArea: ListPlacesInArea,
    private readonly getPlaceDetails: GetPlaceDetails,
    private readonly createPlace: CreatePlace,
    private readonly auth: RequestAuthenticator,
    private readonly validator: InputValidator,
    private readonly dtos: HttpDtoMapper,
    private readonly options: PlacesControllerConfig,
  ) {}

  public register(app: FastifyInstance): void {
    app.get('/v1/places/search', async (request) => {
      const query = this.validator.validate(SearchPlacesQueryDtoSchema, request.query);
      const output = await this.searchPlaces.execute({
        text: query.q,
        limit: this.options.searchLimit,
        ...(query.lat !== undefined && query.lng !== undefined
          ? { near: { lat: query.lat, lng: query.lng } }
          : {}),
        ...(query.kind !== undefined ? { kind: query.kind } : {}),
        ...this.filter(query),
      });
      return PlaceListResponseDtoSchema.parse(this.dtos.placeList(output));
    });

    app.get('/v1/places/nearby', async (request) => {
      const query = this.validator.validate(NearbyPlacesQueryDtoSchema, request.query);
      const output = await this.listNearbyPlaces.execute({
        center: { lat: query.lat, lng: query.lng },
        radiusM: query.radiusM ?? this.options.defaultRadiusM,
        limit: this.options.nearbyLimit,
        ...this.filter(query),
      });
      return PlaceListResponseDtoSchema.parse(this.dtos.placeList(output));
    });

    app.get('/v1/places/in-area', async (request) => {
      const { answeredOnly = false, ...bounds } = this.validator.validate(
        PlacesInAreaQueryDtoSchema,
        request.query,
      );
      const output = await this.listPlacesInArea.execute({
        bounds,
        limit: this.options.areaLimit,
        answeredOnly,
      });
      return PlaceAreaResponseDtoSchema.parse({
        ...this.dtos.placeList(output),
        truncated: output.truncated,
      });
    });

    app.get('/v1/places/:id', async (request) => {
      const { id } = this.validator.validate(PlaceIdParamsDtoSchema, request.params);
      const userId = await this.auth.optionalUser(request);
      const details = await this.getPlaceDetails.execute({
        placeId: id,
        ...(userId === null ? {} : { userId }),
      });
      return PlaceDetailsResponseDtoSchema.parse(this.dtos.placeDetails(details));
    });

    app.post('/v1/places', async (request, reply) => {
      const userId = await this.auth.requireUser(request);
      const body = this.validator.validate(CreatePlaceRequestDtoSchema, request.body);
      const place = await this.createPlace.execute(
        body.kind === 'online'
          ? {
              kind: 'online',
              userId,
              name: body.name,
              website: body.website,
              ...(body.allowDuplicate === true ? { allowDuplicate: true } : {}),
            }
          : {
              kind: 'physical',
              userId,
              name: body.name,
              category: body.category,
              address: body.address,
              location: body.location,
              website: body.website ?? null,
              ...(body.allowDuplicate === true ? { allowDuplicate: true } : {}),
            },
      );
      return reply
        .status(201)
        .send(CreatePlaceResponseDtoSchema.parse({ place: this.dtos.place(place) }));
    });
  }

  /** The query's filter, or nothing when it narrows nothing. */
  private filter(query: PlaceFilterQueryDto): { readonly filter?: PlaceFilter } {
    const filter: PlaceFilter = {
      ...(query.acceptsOnly === true ? { acceptsOnly: true } : {}),
      ...(query.categories === undefined ? {} : { categories: query.categories }),
    };
    return Object.keys(filter).length === 0 ? {} : { filter };
  }
}
