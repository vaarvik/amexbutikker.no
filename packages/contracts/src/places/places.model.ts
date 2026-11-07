import { z } from 'zod';
import { ChainIdSchema, GeoPointSchema, PlaceIdSchema } from '../shared/shared.model.js';
import type { ChainId, GeoPoint, PlaceId } from '../shared/shared.model.js';

export type PlaceKind = 'physical' | 'online';
export const PLACE_KINDS = ['physical', 'online'] as const satisfies readonly PlaceKind[];
export const PlaceKindSchema: z.ZodType<PlaceKind> = z.enum(PLACE_KINDS);

/**
 * Coarse category, mapped from OSM tags for imported places. Drives UI icons and,
 * later, per-category visit dwell thresholds.
 */
export type PlaceCategory =
  'restaurant' | 'cafe' | 'bar' | 'pub' | 'fast_food' | 'shop' | 'hotel' | 'online_shop' | 'other';
export const PLACE_CATEGORIES = [
  'restaurant',
  'cafe',
  'bar',
  'pub',
  'fast_food',
  'shop',
  'hotel',
  'online_shop',
  'other',
] as const satisfies readonly PlaceCategory[];
export const PlaceCategorySchema: z.ZodType<PlaceCategory> = z.enum(PLACE_CATEGORIES);

/** Postal address. Any part may be unknown for imported places. */
export interface Address {
  readonly street: string | null;
  /** Norwegian postcode, four digits. */
  readonly postcode: string | null;
  readonly city: string | null;
}

export const AddressSchema: z.ZodType<Address> = z.object({
  street: z.string().trim().min(1).max(200).nullable(),
  postcode: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  city: z.string().trim().min(1).max(100).nullable(),
});

interface PlaceBase {
  readonly id: PlaceId;
  readonly name: string;
  readonly category: PlaceCategory;
  readonly website: string | null;
  readonly createdAt: Date;
}

/** A store, restaurant, hotel etc. with a location. */
export interface PhysicalPlace extends PlaceBase {
  readonly kind: 'physical';
  readonly chainId: ChainId | null;
  readonly address: Address;
  readonly location: GeoPoint;
  /** OSM element, `node/123`, `way/456` or `relation/789`. Unique when set. */
  readonly osmRef: string | null;
  /** Brønnøysund organisation number of the underenhet, nine digits. */
  readonly brregOrgnr: string | null;
}

/** An online checkout. Has no location and no chain. */
export interface OnlinePlace extends PlaceBase {
  readonly kind: 'online';
  readonly website: string;
}

/** Either a physical place or an online checkout. Discriminated by `kind`. */
export type Place = PhysicalPlace | OnlinePlace;

const placeBaseShape = {
  id: PlaceIdSchema,
  name: z.string().trim().min(1).max(200),
  category: PlaceCategorySchema,
  createdAt: z.date(),
};

export const OSM_REF_PATTERN = /^(node|way|relation)\/\d+$/;

export const PhysicalPlaceSchema: z.ZodType<PhysicalPlace> = z.object({
  ...placeBaseShape,
  kind: z.literal('physical'),
  website: z.url().nullable(),
  chainId: ChainIdSchema.nullable(),
  address: AddressSchema,
  location: GeoPointSchema,
  osmRef: z.string().regex(OSM_REF_PATTERN).nullable(),
  brregOrgnr: z
    .string()
    .regex(/^\d{9}$/)
    .nullable(),
});

export const OnlinePlaceSchema: z.ZodType<OnlinePlace> = z.object({
  ...placeBaseShape,
  kind: z.literal('online'),
  website: z.url(),
});

export const PlaceSchema: z.ZodType<Place> = z.union([PhysicalPlaceSchema, OnlinePlaceSchema]);

export const SEARCH_TEXT_MAX_LENGTH = 100;
export const MAX_RESULT_LIMIT = 50;
export const MAX_NEARBY_RADIUS_M = 5000;

/** Narrows a list before its limit applies, so a filtered list is never a cut-short page. */
export interface PlaceFilter {
  /** Only places whose status is `accepted` or `likely_accepted`. */
  readonly acceptsOnly?: boolean;
  /** Only places in one of these categories; absent means every category. */
  readonly categories?: readonly PlaceCategory[];
}

export const PlaceFilterSchema: z.ZodType<PlaceFilter> = z.object({
  acceptsOnly: z.boolean().exactOptional(),
  categories: z.array(PlaceCategorySchema).min(1).exactOptional(),
});

/** Free-text place search. Ranked by name similarity, boosted by proximity when `near` is set. */
export interface PlaceSearchQuery {
  /** Search text, 1..100 characters after trimming. Matched accent- and case-insensitively. */
  readonly text: string;
  readonly near?: GeoPoint;
  readonly kind?: PlaceKind;
  readonly filter?: PlaceFilter;
  /** 1..50. */
  readonly limit: number;
}

export const PlaceSearchQuerySchema: z.ZodType<PlaceSearchQuery> = z.object({
  text: z.string().trim().min(1).max(SEARCH_TEXT_MAX_LENGTH),
  near: GeoPointSchema.exactOptional(),
  kind: PlaceKindSchema.exactOptional(),
  filter: PlaceFilterSchema.exactOptional(),
  limit: z.int().min(1).max(MAX_RESULT_LIMIT),
});

/** Physical places within `radiusM` of `center`, nearest first. */
export interface NearbyQuery {
  readonly center: GeoPoint;
  /** 1..5000 metres. */
  readonly radiusM: number;
  readonly filter?: PlaceFilter;
  /** 1..50. */
  readonly limit: number;
}

export const NearbyQuerySchema: z.ZodType<NearbyQuery> = z.object({
  center: GeoPointSchema,
  radiusM: z.number().positive().max(MAX_NEARBY_RADIUS_M),
  filter: PlaceFilterSchema.exactOptional(),
  limit: z.int().min(1).max(MAX_RESULT_LIMIT),
});

export const MAX_AREA_LIMIT = 500;
/** About 33 km north-south and 17 km east-west at Oslo: a city, not a country. */
export const MAX_AREA_SPAN_DEG = 0.3;

/** A rectangle in degrees, e.g. the visible map. Does not cross the antimeridian. */
export interface GeoBounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

export const GeoBoundsSchema: z.ZodType<GeoBounds> = z
  .object({
    south: z.number().min(-90).max(90),
    west: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
  })
  .refine((b) => b.south < b.north && b.west < b.east, {
    message: 'south must be below north and west left of east',
  })
  .refine((b) => b.north - b.south <= MAX_AREA_SPAN_DEG && b.east - b.west <= MAX_AREA_SPAN_DEG, {
    message: `at most ${String(MAX_AREA_SPAN_DEG)} degrees each way`,
  });

/** Physical places inside `bounds`, nearest to its centre first. */
export interface AreaQuery {
  readonly bounds: GeoBounds;
  /** 1..500. */
  readonly limit: number;
  /** Only places whose status is not `unknown`, so the cut never hides an answer. */
  readonly answeredOnly: boolean;
}

export const AreaQuerySchema: z.ZodType<AreaQuery> = z.object({
  bounds: GeoBoundsSchema,
  limit: z.int().min(1).max(MAX_AREA_LIMIT),
  answeredOnly: z.boolean(),
});

/** A place returned by text search. */
export interface PlaceSearchHit {
  readonly place: Place;
  /** 0..1 relevance, higher is better. */
  readonly score: number;
  /** Distance in metres from the query's `near` point; null when no point was given or the place is online. */
  readonly distanceM: number | null;
}

export const PlaceSearchHitSchema: z.ZodType<PlaceSearchHit> = z.object({
  place: PlaceSchema,
  score: z.number().min(0).max(1),
  distanceM: z.number().nonnegative().nullable(),
});

/** A physical place returned by a nearby query. */
export interface NearbyPlaceHit {
  readonly place: PhysicalPlace;
  readonly distanceM: number;
}

export const NearbyPlaceHitSchema: z.ZodType<NearbyPlaceHit> = z.object({
  place: PhysicalPlaceSchema,
  distanceM: z.number().nonnegative(),
});

/** A place already stored, as the duplicate check sees it: with its distance when known. */
export interface ExistingPlace {
  readonly place: Place;
  /** Metres from the new place; null for online places. */
  readonly distanceM: number | null;
}
