import { GeoPointSchema, IsoDateTimeSchema, PlaceSummaryDtoSchema } from '@amexbutikker/contracts';
import type { GeoPoint, IsoDateTime, PlaceSummaryDto } from '@amexbutikker/contracts';
import { z } from 'zod';

/** The last nearby list, kept so the next app start can show it before the network answers. */
export interface NearbySnapshot {
  readonly center: GeoPoint;
  readonly fetchedAt: IsoDateTime;
  readonly results: readonly PlaceSummaryDto[];
}

export const NearbySnapshotSchema: z.ZodType<NearbySnapshot> = z.object({
  center: GeoPointSchema,
  fetchedAt: IsoDateTimeSchema,
  results: z.array(PlaceSummaryDtoSchema),
});

/**
 * What the "Nær deg" list shows. `refreshing` is true while a newer list is on its way, so the
 * cached list stays on screen instead of a spinner.
 */
export type NearbyState =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'ready';
      readonly snapshot: NearbySnapshot;
      readonly fromCache: boolean;
      readonly refreshing: boolean;
    }
  | { readonly kind: 'no-location'; readonly snapshot: NearbySnapshot | null }
  | { readonly kind: 'failed'; readonly error: unknown; readonly snapshot: NearbySnapshot | null };
