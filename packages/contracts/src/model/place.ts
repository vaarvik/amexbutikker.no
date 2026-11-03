import { z } from 'zod';
import { ChainIdSchema, PlaceIdSchema } from '../ids.js';
import type { ChainId, PlaceId } from '../ids.js';
import { GeoPointSchema } from './geo.js';
import type { GeoPoint } from './geo.js';

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
