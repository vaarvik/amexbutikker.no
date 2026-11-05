import {
  CreatePlaceResponseDtoSchema,
  PlaceDetailsResponseDtoSchema,
  PlaceListResponseDtoSchema,
  StatusChangeResponseDtoSchema,
} from '@amexbutikker/contracts';
import type {
  CreatePlaceRequestDto,
  CreatePlaceResponseDto,
  NearbyPlacesQueryDto,
  PlaceDetailsResponseDto,
  PlaceId,
  PlaceListResponseDto,
  SearchPlacesQueryDto,
  StatusChangeResponseDto,
  SubmitReportRequestDto,
} from '@amexbutikker/contracts';
import type { z } from 'zod';
import type { DeviceSession } from '../devices/devices.ports';
import { ApiError } from '../shared/fetch-json.transport';
import type { JsonRequest } from '../shared/shared.model';
import type { JsonTransport } from '../shared/shared.ports';
import type { PlacesApiClient } from './places.ports';

export class FetchPlacesApiClient implements PlacesApiClient {
  public constructor(
    private readonly transport: JsonTransport,
    private readonly session: DeviceSession,
  ) {}

  public search(query: SearchPlacesQueryDto): Promise<PlaceListResponseDto> {
    return this.transport.request(
      { method: 'GET', path: '/v1/places/search', query: { ...query } },
      PlaceListResponseDtoSchema,
    );
  }

  public listNearby(query: NearbyPlacesQueryDto): Promise<PlaceListResponseDto> {
    return this.transport.request(
      { method: 'GET', path: '/v1/places/nearby', query: { ...query } },
      PlaceListResponseDtoSchema,
    );
  }

  public async getDetails(placeId: PlaceId): Promise<PlaceDetailsResponseDto> {
    const token = await this.session.findToken();
    return this.transport.request(
      { method: 'GET', path: this.placePath(placeId), ...(token === null ? {} : { token }) },
      PlaceDetailsResponseDtoSchema,
    );
  }

  public create(input: CreatePlaceRequestDto): Promise<CreatePlaceResponseDto> {
    return this.authorized(
      { method: 'POST', path: '/v1/places', body: input },
      CreatePlaceResponseDtoSchema,
    );
  }

  public submitReport(
    placeId: PlaceId,
    input: SubmitReportRequestDto,
  ): Promise<StatusChangeResponseDto> {
    return this.authorized(
      { method: 'POST', path: `${this.placePath(placeId)}/reports`, body: input },
      StatusChangeResponseDtoSchema,
    );
  }

  public removeMyReport(placeId: PlaceId): Promise<StatusChangeResponseDto> {
    return this.authorized(
      { method: 'DELETE', path: `${this.placePath(placeId)}/reports/me` },
      StatusChangeResponseDtoSchema,
    );
  }

  /** Sends the device token; a rejected token is dropped and the request retried once. */
  private async authorized<T>(request: JsonRequest, schema: z.ZodType<T>): Promise<T> {
    try {
      return await this.transport.request(
        { ...request, token: await this.session.getToken() },
        schema,
      );
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
      await this.session.reset();
      return this.transport.request({ ...request, token: await this.session.getToken() }, schema);
    }
  }

  private placePath(placeId: PlaceId): string {
    return `/v1/places/${encodeURIComponent(placeId)}`;
  }
}
