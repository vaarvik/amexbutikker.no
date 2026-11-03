import { z } from 'zod';
import { PlaceDtoSchema } from '../places/place-dtos.js';
import type { PlaceDto } from '../places/place-dtos.js';
import { PlaceIdSchema } from '../shared/ids.js';
import type { PlaceId } from '../shared/ids.js';
import { PlaceStatusDtoSchema } from '../status/status-dtos.js';
import type { PlaceStatusDto } from '../status/status-dtos.js';
import {
  MatchReasonSchema,
  SHARED_PLACE_PROVIDERS,
  SHARED_TEXT_MAX_LENGTH,
} from './shared-place.js';
import type { MatchReason, SharedPlaceProvider } from './shared-place.js';

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
