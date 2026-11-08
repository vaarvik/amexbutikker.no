import {
  AppendHouseholdRecordsResponseDtoSchema,
  HouseholdRecordListResponseDtoSchema,
  HouseholdResponseDtoSchema,
} from '@amexbutikker/contracts';
import type {
  AppendHouseholdRecordsResponseDto,
  HouseholdId,
  HouseholdRecordListResponseDto,
  HouseholdResponseDto,
} from '@amexbutikker/contracts';
import { z } from 'zod';
import type { DeviceSession } from '../devices/devices.ports';
import { ApiError } from '../shared/fetch-json.transport';
import type { JsonRequest } from '../shared/shared.model';
import type { JsonTransport } from '../shared/shared.ports';
import type { HouseholdsApiClient } from './households.ports';

const NoContentSchema = z.unknown();

/**
 * The household endpoints, with the device token. Unlike the places client it does not register
 * a new device on 401: a new device is in no household, which `find` then reports.
 */
export class FetchHouseholdsApiClient implements HouseholdsApiClient {
  public constructor(
    private readonly transport: JsonTransport,
    private readonly session: DeviceSession,
  ) {}

  public create(joinToken: string): Promise<HouseholdResponseDto> {
    return this.send(
      { method: 'POST', path: '/v1/households', body: { joinToken } },
      HouseholdResponseDtoSchema,
    );
  }

  public join(householdId: HouseholdId, joinToken: string): Promise<HouseholdResponseDto> {
    return this.send(
      {
        method: 'POST',
        path: `/v1/households/${encodeURIComponent(householdId)}/members`,
        body: { joinToken },
      },
      HouseholdResponseDtoSchema,
    );
  }

  public async find(): Promise<HouseholdResponseDto | null> {
    try {
      return await this.send(
        { method: 'GET', path: '/v1/households/me' },
        HouseholdResponseDtoSchema,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  public async leave(): Promise<void> {
    await this.send({ method: 'DELETE', path: '/v1/households/me' }, NoContentSchema);
  }

  public append(sealed: readonly string[]): Promise<AppendHouseholdRecordsResponseDto> {
    return this.send(
      {
        method: 'POST',
        path: '/v1/households/me/records',
        body: { records: sealed.map((record) => ({ sealed: record })) },
      },
      AppendHouseholdRecordsResponseDtoSchema,
    );
  }

  public list(afterSeq: number): Promise<HouseholdRecordListResponseDto> {
    return this.send(
      { method: 'GET', path: '/v1/households/me/records', query: { after: afterSeq } },
      HouseholdRecordListResponseDtoSchema,
    );
  }

  private async send<T>(request: JsonRequest, schema: z.ZodType<T>): Promise<T> {
    return this.transport.request({ ...request, token: await this.session.getToken() }, schema);
  }
}
