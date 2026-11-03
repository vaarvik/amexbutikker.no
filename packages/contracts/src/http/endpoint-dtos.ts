import { z } from 'zod';
import { ChainIdSchema, PlaceIdSchema, UserIdSchema } from '../ids.js';
import type { ChainId, PlaceId, UserId } from '../ids.js';
import { AcceptanceResultSchema, EvidenceKindSchema } from '../model/evidence.js';
import type { AcceptanceResult, EvidenceKind } from '../model/evidence.js';
import { GeoPointSchema } from '../model/geo.js';
import type { GeoPoint } from '../model/geo.js';
import { AddressSchema, PlaceCategorySchema, PlaceKindSchema } from '../model/place.js';
import type { Address, PlaceCategory, PlaceKind } from '../model/place.js';
import { MAX_NEARBY_RADIUS_M, SEARCH_TEXT_MAX_LENGTH } from '../model/queries.js';
import {
  SHARED_PLACE_PROVIDERS,
  SHARED_TEXT_MAX_LENGTH,
  MatchReasonSchema,
} from '../model/shared-place.js';
import type { MatchReason, SharedPlaceProvider } from '../model/shared-place.js';
import type { DevicePlatform } from '../use-cases/use-cases.js';
import {
  ChainHintDtoSchema,
  IsoDateTimeSchema,
  PlaceDtoSchema,
  PlaceStatusDtoSchema,
} from './common-dtos.js';
import type { ChainHintDto, IsoDateTime, PlaceDto, PlaceStatusDto } from './common-dtos.js';

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

// ---------------------------------------------------------------------------
// GET /v1/places/search?q&lat&lng&kind  ->  PlaceListResponseDto

export interface SearchPlacesQueryDto {
  readonly q: string;
  /** lat and lng are given together or not at all. */
  readonly lat?: number;
  readonly lng?: number;
  readonly kind?: PlaceKind;
}

export const SearchPlacesQueryDtoSchema: z.ZodType<SearchPlacesQueryDto> = z
  .object({
    q: z.string().trim().min(1).max(SEARCH_TEXT_MAX_LENGTH),
    lat: latitude.exactOptional(),
    lng: longitude.exactOptional(),
    kind: PlaceKindSchema.exactOptional(),
  })
  .refine((query) => (query.lat === undefined) === (query.lng === undefined), {
    message: 'lat and lng must be given together',
    path: ['lat'],
  });

// ---------------------------------------------------------------------------
// GET /v1/places/nearby?lat&lng&radiusM  ->  PlaceListResponseDto

export interface NearbyPlacesQueryDto {
  readonly lat: number;
  readonly lng: number;
  /** Defaults to 1000 when omitted. */
  readonly radiusM?: number;
}

export const NearbyPlacesQueryDtoSchema: z.ZodType<NearbyPlacesQueryDto> = z.object({
  lat: latitude,
  lng: longitude,
  radiusM: z.coerce.number().positive().max(MAX_NEARBY_RADIUS_M).exactOptional(),
});

// ---------------------------------------------------------------------------
// GET /v1/places/:id  ->  PlaceDetailsResponseDto

export interface PlaceIdParamsDto {
  readonly id: PlaceId;
}

export const PlaceIdParamsDtoSchema: z.ZodType<PlaceIdParamsDto> = z.object({ id: PlaceIdSchema });

export interface StatusBasisDto {
  readonly kind: EvidenceKind | null;
  readonly scope: 'place' | 'chain' | 'none';
  readonly source: string | null;
  readonly observedAt: IsoDateTime | null;
  readonly userAccepted: number;
  readonly userRejected: number;
}

export const StatusBasisDtoSchema: z.ZodType<StatusBasisDto> = z.object({
  kind: EvidenceKindSchema.nullable(),
  scope: z.enum(['place', 'chain', 'none']),
  source: z.string().nullable(),
  observedAt: IsoDateTimeSchema.nullable(),
  userAccepted: z.int().nonnegative(),
  userRejected: z.int().nonnegative(),
});

export interface ReportNoteDto {
  readonly result: AcceptanceResult;
  readonly note: string;
  readonly observedAt: IsoDateTime;
}

export const ReportNoteDtoSchema: z.ZodType<ReportNoteDto> = z.object({
  result: AcceptanceResultSchema,
  note: z.string(),
  observedAt: IsoDateTimeSchema,
});

export interface PlaceDetailsResponseDto {
  readonly place: PlaceDto;
  readonly status: PlaceStatusDto;
  readonly basis: StatusBasisDto;
  readonly chain: { readonly id: ChainId; readonly name: string } | null;
  readonly chainHint: ChainHintDto | null;
  readonly latestNotes: readonly ReportNoteDto[];
  readonly myReport: AcceptanceResult | null;
}

export const PlaceDetailsResponseDtoSchema: z.ZodType<PlaceDetailsResponseDto> = z.object({
  place: PlaceDtoSchema,
  status: PlaceStatusDtoSchema,
  basis: StatusBasisDtoSchema,
  chain: z.object({ id: ChainIdSchema, name: z.string() }).nullable(),
  chainHint: ChainHintDtoSchema.nullable(),
  latestNotes: z.array(ReportNoteDtoSchema).max(5),
  myReport: AcceptanceResultSchema.nullable(),
});

// ---------------------------------------------------------------------------
// POST /v1/places  (device token required)  ->  201 CreatePlaceResponseDto

export type CreatePlaceRequestDto =
  | {
      readonly kind: 'physical';
      readonly name: string;
      readonly category: PlaceCategory;
      readonly address: Address;
      readonly location: GeoPoint;
      readonly website?: string;
    }
  | {
      readonly kind: 'online';
      readonly name: string;
      readonly website: string;
    };

const placeName = z.string().trim().min(1).max(200);

export const CreatePlaceRequestDtoSchema: z.ZodType<CreatePlaceRequestDto> = z.discriminatedUnion(
  'kind',
  [
    z.object({
      kind: z.literal('physical'),
      name: placeName,
      category: PlaceCategorySchema,
      address: AddressSchema,
      location: GeoPointSchema,
      website: z.url().exactOptional(),
    }),
    z.object({
      kind: z.literal('online'),
      name: placeName,
      website: z.url(),
    }),
  ],
);

export interface CreatePlaceResponseDto {
  readonly place: PlaceDto;
}

export const CreatePlaceResponseDtoSchema: z.ZodType<CreatePlaceResponseDto> = z.object({
  place: PlaceDtoSchema,
});

// ---------------------------------------------------------------------------
// POST /v1/places/:id/reports  (device token required)  ->  StatusChangeResponseDto
// DELETE /v1/places/:id/reports/me  (device token required)  ->  StatusChangeResponseDto

export interface SubmitReportRequestDto {
  readonly result: AcceptanceResult;
  readonly note?: string;
}

export const SubmitReportRequestDtoSchema: z.ZodType<SubmitReportRequestDto> = z.object({
  result: AcceptanceResultSchema,
  note: z.string().trim().min(1).max(500).exactOptional(),
});

export interface StatusChangeResponseDto {
  readonly status: PlaceStatusDto;
  readonly chainHint: ChainHintDto | null;
}

export const StatusChangeResponseDtoSchema: z.ZodType<StatusChangeResponseDto> = z.object({
  status: PlaceStatusDtoSchema,
  chainHint: ChainHintDtoSchema.nullable(),
});

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
// POST /v1/devices  ->  201 RegisterDeviceResponseDto

export interface RegisterDeviceRequestDto {
  readonly platform: DevicePlatform;
}

export const RegisterDeviceRequestDtoSchema: z.ZodType<RegisterDeviceRequestDto> = z.object({
  platform: z.enum(['ios', 'android', 'web']),
});

export interface RegisterDeviceResponseDto {
  readonly userId: UserId;
  /** Send as `Authorization: Bearer <token>` on write endpoints. */
  readonly token: string;
}

export const RegisterDeviceResponseDtoSchema: z.ZodType<RegisterDeviceResponseDto> = z.object({
  userId: UserIdSchema,
  token: z.string().min(1),
});
