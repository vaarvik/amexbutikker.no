import { z } from 'zod';
import { HouseholdIdSchema } from '../shared/shared.model.js';
import { JoinTokenSchema, SealedRecordSchema } from './households.model.js';
import type { HouseholdId } from '../shared/shared.model.js';

// Every endpoint needs the device token. Amounts never appear here: records are sealed on the
// phone with a key the server never gets.

// ---------------------------------------------------------------------------
// POST /v1/households                 CreateHouseholdRequestDto -> 201 HouseholdResponseDto
// POST /v1/households/:id/members     JoinHouseholdRequestDto   -> HouseholdResponseDto
// GET  /v1/households/me              -> HouseholdResponseDto, 404 when in none
// DELETE /v1/households/me            -> 204

export interface CreateHouseholdRequestDto {
  readonly joinToken: string;
}

export const CreateHouseholdRequestDtoSchema: z.ZodType<CreateHouseholdRequestDto> = z.strictObject(
  { joinToken: JoinTokenSchema },
);

export type JoinHouseholdRequestDto = CreateHouseholdRequestDto;

export const JoinHouseholdRequestDtoSchema: z.ZodType<JoinHouseholdRequestDto> =
  CreateHouseholdRequestDtoSchema;

export interface HouseholdResponseDto {
  readonly householdId: HouseholdId;
  readonly memberCount: number;
}

export const HouseholdResponseDtoSchema: z.ZodType<HouseholdResponseDto> = z.object({
  householdId: HouseholdIdSchema,
  memberCount: z.int().min(1),
});

// ---------------------------------------------------------------------------
// POST /v1/households/me/records   AppendHouseholdRecordsRequestDto -> AppendHouseholdRecordsResponseDto
// GET  /v1/households/me/records?after=<seq>&limit=<n>  -> HouseholdRecordListResponseDto

export const HOUSEHOLD_RECORDS_PER_APPEND = 50;

export interface AppendHouseholdRecordsRequestDto {
  readonly records: readonly { readonly sealed: string }[];
}

export const AppendHouseholdRecordsRequestDtoSchema: z.ZodType<AppendHouseholdRecordsRequestDto> =
  z.strictObject({
    records: z
      .array(z.strictObject({ sealed: SealedRecordSchema }))
      .min(1)
      .max(HOUSEHOLD_RECORDS_PER_APPEND),
  });

export interface AppendHouseholdRecordsResponseDto {
  readonly seqs: readonly number[];
}

export const AppendHouseholdRecordsResponseDtoSchema: z.ZodType<AppendHouseholdRecordsResponseDto> =
  z.object({ seqs: z.array(z.int().min(1)) });

export interface HouseholdRecordListQueryDto {
  readonly after: number;
  /** Default 200. */
  readonly limit: number;
}

export const HouseholdRecordListQueryDtoSchema: z.ZodType<HouseholdRecordListQueryDto> =
  z.strictObject({
    after: z.coerce.number().int().min(0),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  });

export interface HouseholdRecordDto {
  readonly seq: number;
  readonly sealed: string;
  readonly mine: boolean;
}

export interface HouseholdRecordListResponseDto {
  readonly records: readonly HouseholdRecordDto[];
  readonly hasMore: boolean;
}

export const HouseholdRecordListResponseDtoSchema: z.ZodType<HouseholdRecordListResponseDto> =
  z.object({
    records: z.array(
      z.object({ seq: z.int().min(1), sealed: SealedRecordSchema, mine: z.boolean() }),
    ),
    hasMore: z.boolean(),
  });
