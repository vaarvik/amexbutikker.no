import { z } from 'zod';
import { PhysicalPlaceSchema, PlaceSchema } from './place.js';
import type { PhysicalPlace, Place } from './place.js';

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
