import { z } from 'zod';
import { AcceptanceResultSchema, EvidenceKindSchema } from '../evidence/evidence.model.js';
import type { AcceptanceResult, EvidenceKind } from '../evidence/evidence.model.js';
import {
  AddressSchema,
  GeoBoundsSchema,
  MAX_NEARBY_RADIUS_M,
  PlaceCategorySchema,
  PlaceKindSchema,
  SEARCH_TEXT_MAX_LENGTH,
} from './places.model.js';
import type { Address, GeoBounds, PlaceCategory, PlaceKind } from './places.model.js';
import { IsoDateTimeSchema } from '../shared/shared.dtos.js';
import type { IsoDateTime } from '../shared/shared.dtos.js';
import { ChainIdSchema, GeoPointSchema, PlaceIdSchema } from '../shared/shared.model.js';
import type { ChainId, GeoPoint, PlaceId } from '../shared/shared.model.js';
import { ChainHintDtoSchema, PlaceStatusDtoSchema } from '../status/status.dtos.js';
import type { ChainHintDto, PlaceStatusDto } from '../status/status.dtos.js';

export type PlaceDto =
  | {
      readonly kind: 'physical';
      readonly id: PlaceId;
      readonly name: string;
      readonly category: PlaceCategory;
      readonly website: string | null;
      readonly chainId: ChainId | null;
      readonly address: Address;
      readonly location: GeoPoint;
    }
  | {
      readonly kind: 'online';
      readonly id: PlaceId;
      readonly name: string;
      readonly category: PlaceCategory;
      readonly website: string;
    };

export const PlaceDtoSchema: z.ZodType<PlaceDto> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('physical'),
    id: PlaceIdSchema,
    name: z.string(),
    category: PlaceCategorySchema,
    website: z.url().nullable(),
    chainId: ChainIdSchema.nullable(),
    address: AddressSchema,
    location: GeoPointSchema,
  }),
  z.object({
    kind: z.literal('online'),
    id: PlaceIdSchema,
    name: z.string(),
    category: PlaceCategorySchema,
    website: z.url(),
  }),
]);

export interface PlaceSummaryDto {
  readonly place: PlaceDto;
  readonly status: PlaceStatusDto;
  readonly distanceM: number | null;
}

export const PlaceSummaryDtoSchema: z.ZodType<PlaceSummaryDto> = z.object({
  place: PlaceDtoSchema,
  status: PlaceStatusDtoSchema,
  distanceM: z.number().nonnegative().nullable(),
});

export interface PlaceListResponseDto {
  readonly results: readonly PlaceSummaryDto[];
}

export const PlaceListResponseDtoSchema: z.ZodType<PlaceListResponseDto> = z.object({
  results: z.array(PlaceSummaryDtoSchema),
});

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
// GET /v1/places/in-area?south&west&north&east[&answeredOnly=true]  ->  PlaceAreaResponseDto

export interface PlacesInAreaQueryDto extends GeoBounds {
  /** Leave out the places nobody has answered for. Off when absent. */
  readonly answeredOnly?: boolean;
}

/** Query strings arrive as text; the numbers are then held to the GeoBounds rules. */
export const PlacesInAreaQueryDtoSchema: z.ZodType<PlacesInAreaQueryDto> = z
  .object({
    south: z.coerce.number(),
    west: z.coerce.number(),
    north: z.coerce.number(),
    east: z.coerce.number(),
    answeredOnly: z.stringbool().exactOptional(),
  })
  .superRefine(({ south, west, north, east }, ctx) => {
    const parsed = GeoBoundsSchema.safeParse({ south, west, north, east });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
    }
  });

export interface PlaceAreaResponseDto extends PlaceListResponseDto {
  readonly truncated: boolean;
}

export const PlaceAreaResponseDtoSchema: z.ZodType<PlaceAreaResponseDto> = z.object({
  results: z.array(PlaceSummaryDtoSchema),
  truncated: z.boolean(),
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
