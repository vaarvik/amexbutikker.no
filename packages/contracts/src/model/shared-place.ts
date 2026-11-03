import { z } from 'zod';
import { GeoPointSchema } from './geo.js';
import type { GeoPoint } from './geo.js';
import { PlaceSchema } from './place.js';
import type { Place } from './place.js';

export const SHARED_TEXT_MAX_LENGTH = 2000;

export type SharedPlaceProvider = 'google_maps' | 'apple_maps' | 'unknown';
export const SHARED_PLACE_PROVIDERS = [
  'google_maps',
  'apple_maps',
  'unknown',
] as const satisfies readonly SharedPlaceProvider[];

/** What could be read out of text shared from a maps app. Every field may be missing. */
export interface ParsedSharedPlace {
  readonly provider: SharedPlaceProvider;
  readonly name: string | null;
  readonly street: string | null;
  readonly postcode: string | null;
  readonly city: string | null;
  readonly location: GeoPoint | null;
  /** All URLs found in the text, in order of appearance. */
  readonly urls: readonly string[];
}

export const ParsedSharedPlaceSchema: z.ZodType<ParsedSharedPlace> = z.object({
  provider: z.enum(SHARED_PLACE_PROVIDERS),
  name: z.string().min(1).nullable(),
  street: z.string().min(1).nullable(),
  postcode: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  city: z.string().min(1).nullable(),
  location: GeoPointSchema.nullable(),
  urls: z.array(z.url()),
});

/** Extra detail obtained by following a shared link. */
export interface ResolvedSharedLink {
  readonly name: string | null;
  readonly location: GeoPoint | null;
}

export const ResolvedSharedLinkSchema: z.ZodType<ResolvedSharedLink> = z.object({
  name: z.string().min(1).nullable(),
  location: GeoPointSchema.nullable(),
});

/** Why a candidate matched. */
export type MatchReason =
  | { readonly kind: 'name'; readonly similarity: number }
  | { readonly kind: 'postcode' }
  | { readonly kind: 'street' }
  | { readonly kind: 'distance'; readonly distanceM: number };

export const MatchReasonSchema: z.ZodType<MatchReason> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('name'), similarity: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('postcode') }),
  z.object({ kind: z.literal('street') }),
  z.object({ kind: z.literal('distance'), distanceM: z.number().nonnegative() }),
]);

/** A possible match for a shared place. */
export interface PlaceCandidate {
  readonly place: Place;
  /** 0..1, higher is better. */
  readonly score: number;
  readonly reasons: readonly MatchReason[];
}

export const PlaceCandidateSchema: z.ZodType<PlaceCandidate> = z.object({
  place: PlaceSchema,
  score: z.number().min(0).max(1),
  reasons: z.array(MatchReasonSchema),
});
