import { z } from 'zod';
import { GeoPointSchema } from './geo.js';
import type { GeoPoint } from './geo.js';
import { PlaceKindSchema } from './place.js';
import type { PlaceKind } from './place.js';

export const SEARCH_TEXT_MAX_LENGTH = 100;
export const MAX_RESULT_LIMIT = 50;
export const MAX_NEARBY_RADIUS_M = 5000;

/** Free-text place search. Ranked by name similarity, boosted by proximity when `near` is set. */
export interface PlaceSearchQuery {
  /** Search text, 1..100 characters after trimming. Matched accent- and case-insensitively. */
  readonly text: string;
  readonly near?: GeoPoint;
  readonly kind?: PlaceKind;
  /** 1..50. */
  readonly limit: number;
}

export const PlaceSearchQuerySchema: z.ZodType<PlaceSearchQuery> = z.object({
  text: z.string().trim().min(1).max(SEARCH_TEXT_MAX_LENGTH),
  near: GeoPointSchema.exactOptional(),
  kind: PlaceKindSchema.exactOptional(),
  limit: z.int().min(1).max(MAX_RESULT_LIMIT),
});

/** Physical places within `radiusM` of `center`, nearest first. */
export interface NearbyQuery {
  readonly center: GeoPoint;
  /** 1..5000 metres. */
  readonly radiusM: number;
  /** 1..50. */
  readonly limit: number;
}

export const NearbyQuerySchema: z.ZodType<NearbyQuery> = z.object({
  center: GeoPointSchema,
  radiusM: z.number().positive().max(MAX_NEARBY_RADIUS_M),
  limit: z.int().min(1).max(MAX_RESULT_LIMIT),
});
