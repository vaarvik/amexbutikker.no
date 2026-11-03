import { z } from 'zod';
import { ChainIdSchema, PlaceIdSchema } from '../ids.js';
import type { ChainId, PlaceId } from '../ids.js';
import { EvidenceKindSchema } from '../model/evidence.js';
import type { EvidenceKind } from '../model/evidence.js';
import { GeoPointSchema } from '../model/geo.js';
import type { GeoPoint } from '../model/geo.js';
import { AcceptanceStatusSchema } from '../model/place-status.js';
import type { AcceptanceStatus } from '../model/place-status.js';
import { AddressSchema, PlaceCategorySchema } from '../model/place.js';
import type { Address, PlaceCategory } from '../model/place.js';

// Wire format: JSON. Dates are ISO 8601 strings with offset. IDs are UUID strings.

/** ISO 8601 date-time with offset, e.g. `2026-11-03T20:40:00Z`. */
export type IsoDateTime = string;
export const IsoDateTimeSchema: z.ZodType<IsoDateTime> = z.iso.datetime({ offset: true });

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

export interface PlaceStatusDto {
  readonly status: AcceptanceStatus;
  readonly confidence: number;
  readonly basis: EvidenceKind | null;
  readonly verified: boolean;
  readonly lastEvidenceAt: IsoDateTime | null;
}

export const PlaceStatusDtoSchema: z.ZodType<PlaceStatusDto> = z.object({
  status: AcceptanceStatusSchema,
  confidence: z.number().min(0).max(1),
  basis: EvidenceKindSchema.nullable(),
  verified: z.boolean(),
  lastEvidenceAt: IsoDateTimeSchema.nullable(),
});

export interface ChainHintDto {
  readonly chainId: ChainId;
  readonly acceptedCount: number;
  readonly totalWithEvidence: number;
}

export const ChainHintDtoSchema: z.ZodType<ChainHintDto> = z.object({
  chainId: ChainIdSchema,
  acceptedCount: z.int().nonnegative(),
  totalWithEvidence: z.int().nonnegative(),
});

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

/** Body of every non-2xx response. */
export interface ErrorResponseDto {
  readonly error: {
    /** DomainError.code, e.g. `not_found`, `validation_failed`, `rate_limited`, or `internal`. */
    readonly code: string;
    readonly message: string;
    readonly issues?: readonly {
      readonly path: readonly (string | number)[];
      readonly message: string;
    }[];
    readonly retryAfterSeconds?: number;
  };
}

export const ErrorResponseDtoSchema: z.ZodType<ErrorResponseDto> = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    issues: z
      .array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }))
      .exactOptional(),
    retryAfterSeconds: z.number().nonnegative().exactOptional(),
  }),
});
