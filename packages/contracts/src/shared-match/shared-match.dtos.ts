import { z } from 'zod';
import { PlaceDtoSchema } from '../places/places.dtos.js';
import type { PlaceDto } from '../places/places.dtos.js';
import {
  MatchReasonSchema,
  PAYMENT_MERCHANT_MAX_LENGTH,
  SHARED_PLACE_PROVIDERS,
  SHARED_TEXT_MAX_LENGTH,
} from './shared-match.model.js';
import type { MatchReason, SharedPlaceProvider } from './shared-match.model.js';
import { PlaceIdSchema } from '../shared/shared.model.js';
import type { PlaceId } from '../shared/shared.model.js';
import { PlaceStatusDtoSchema } from '../status/status.dtos.js';
import type { PlaceStatusDto } from '../status/status.dtos.js';

// ---------------------------------------------------------------------------
// POST /v1/match/shared  ->  MatchSharedResponseDto

export interface MatchSharedRequestDto {
  readonly text: string;
}

export const MatchSharedRequestDtoSchema: z.ZodType<MatchSharedRequestDto> = z.object({
  text: z.string().min(1).max(SHARED_TEXT_MAX_LENGTH),
});

export interface MatchCandidateDto {
  readonly place: PlaceDto;
  readonly status: PlaceStatusDto;
  readonly score: number;
  readonly reasons: readonly MatchReason[];
}

export const MatchCandidateDtoSchema: z.ZodType<MatchCandidateDto> = z.object({
  place: PlaceDtoSchema,
  status: PlaceStatusDtoSchema,
  score: z.number().min(0).max(1),
  reasons: z.array(MatchReasonSchema),
});

export interface MatchSharedResponseDto {
  readonly parsed: {
    readonly provider: SharedPlaceProvider;
    readonly name: string | null;
    readonly street: string | null;
    readonly postcode: string | null;
    readonly city: string | null;
  };
  readonly candidates: readonly MatchCandidateDto[];
  readonly decision:
    | { readonly type: 'open'; readonly placeId: PlaceId }
    | { readonly type: 'choose' }
    | { readonly type: 'none' };
}

export const MatchSharedResponseDtoSchema: z.ZodType<MatchSharedResponseDto> = z.object({
  parsed: z.object({
    provider: z.enum(SHARED_PLACE_PROVIDERS),
    name: z.string().nullable(),
    street: z.string().nullable(),
    postcode: z.string().nullable(),
    city: z.string().nullable(),
  }),
  candidates: z.array(MatchCandidateDtoSchema).max(3),
  decision: z.discriminatedUnion('type', [
    z.object({ type: z.literal('open'), placeId: PlaceIdSchema }),
    z.object({ type: z.literal('choose') }),
    z.object({ type: z.literal('none') }),
  ]),
});

// ---------------------------------------------------------------------------
// POST /v1/match/payment  ->  MatchPaymentResponseDto

export interface MatchPaymentRequestDto {
  readonly merchant: string;
  /** Both or neither. */
  readonly lat?: number;
  readonly lng?: number;
}

/** Strict: an amount, or any other field, is refused, so amounts can never reach the API. */
export const MatchPaymentRequestDtoSchema: z.ZodType<MatchPaymentRequestDto> = z
  .strictObject({
    merchant: z.string().trim().min(1).max(PAYMENT_MERCHANT_MAX_LENGTH),
    lat: z.number().min(-90).max(90).exactOptional(),
    lng: z.number().min(-180).max(180).exactOptional(),
  })
  .refine((body) => (body.lat === undefined) === (body.lng === undefined), {
    message: 'lat and lng go together',
    path: ['lat'],
  });

export interface MatchPaymentResponseDto {
  readonly merchantName: string | null;
  readonly candidates: readonly MatchCandidateDto[];
  readonly decision: MatchSharedResponseDto['decision'];
}

export const MatchPaymentResponseDtoSchema: z.ZodType<MatchPaymentResponseDto> = z.object({
  merchantName: z.string().nullable(),
  candidates: z.array(MatchCandidateDtoSchema).max(3),
  decision: z.discriminatedUnion('type', [
    z.object({ type: z.literal('open'), placeId: PlaceIdSchema }),
    z.object({ type: z.literal('choose') }),
    z.object({ type: z.literal('none') }),
  ]),
});
