import {
  CreatePlaceRequestDtoSchema,
  CreatePlaceResponseDtoSchema,
  NearbyPlacesQueryDtoSchema,
  PlaceDetailsResponseDtoSchema,
  PlaceIdParamsDtoSchema,
  PlaceListResponseDtoSchema,
  SearchPlacesQueryDtoSchema,
} from '@amexbutikker/contracts';
import type {
  CreatePlace,
  ListNearbyPlaces,
  GetPlaceDetails,
  InputValidator,
  SearchPlaces,
} from '@amexbutikker/contracts';
import type { FastifyInstance } from 'fastify';
import type { HttpController } from '../shared/shared.ports.js';
import type { HttpDtoMapper } from '../shared/default-http-dto.mapper.js';
import type { RequestAuthenticator } from '../shared/bearer-token.authenticator.js';

export interface PlacesControllerOptions {
  readonly searchLimit: number;
  readonly nearbyLimit: number;
  readonly defaultRadiusM: number;
}

export class PlacesController implements HttpController {
  public constructor(
    private readonly searchPlaces: SearchPlaces,
    private readonly listNearbyPlaces: ListNearbyPlaces,
    private readonly getPlaceDetails: GetPlaceDetails,
    private readonly createPlace: CreatePlace,
    private readonly auth: RequestAuthenticator,
    private readonly validator: InputValidator,
    private readonly dtos: HttpDtoMapper,
    private readonly options: PlacesControllerOptions,
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
      });
      return PlaceListResponseDtoSchema.parse(this.dtos.placeList(output));
    });

    app.get('/v1/places/nearby', async (request) => {
      const query = this.validator.validate(NearbyPlacesQueryDtoSchema, request.query);
      const output = await this.listNearbyPlaces.execute({
        center: { lat: query.lat, lng: query.lng },
        radiusM: query.radiusM ?? this.options.defaultRadiusM,
        limit: this.options.nearbyLimit,
      });
      return PlaceListResponseDtoSchema.parse(this.dtos.placeList(output));
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
          ? { kind: 'online', userId, name: body.name, website: body.website }
          : {
              kind: 'physical',
              userId,
              name: body.name,
              category: body.category,
              address: body.address,
              location: body.location,
              website: body.website ?? null,
            },
      );
      return reply
        .status(201)
        .send(CreatePlaceResponseDtoSchema.parse({ place: this.dtos.place(place) }));
    });
  }
}
