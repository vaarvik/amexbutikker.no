import { z } from 'zod';

/** One element of an Overpass `out center tags` response. Ways and relations carry `center`. */
export interface OverpassElement {
  readonly type: 'node' | 'way' | 'relation';
  readonly id: number;
  readonly lat?: number;
  readonly lon?: number;
  readonly center?: { readonly lat: number; readonly lon: number };
  readonly tags?: Readonly<Record<string, string>>;
}

export const OverpassElementSchema: z.ZodType<OverpassElement> = z.object({
  type: z.enum(['node', 'way', 'relation']),
  id: z.int().positive(),
  lat: z.number().exactOptional(),
  lon: z.number().exactOptional(),
  center: z.object({ lat: z.number(), lon: z.number() }).exactOptional(),
  tags: z.record(z.string(), z.string()).exactOptional(),
});

/** The envelope only; elements are validated one by one so one bad element does not fail the run. */
export interface OverpassEnvelope {
  readonly elements: readonly unknown[];
  readonly remark?: string;
}

export const OverpassEnvelopeSchema: z.ZodType<OverpassEnvelope> = z.object({
  elements: z.array(z.unknown()),
  remark: z.string().exactOptional(),
});

/** OSM relation 406091 is Oslo kommune; Overpass area ids are relation ids plus 3 600 000 000. */
export const OSLO_AREA_ID = 3_600_406_091;

/** `amenity` values imported as their own category. */
export const OSM_AMENITY_CATEGORIES = ['restaurant', 'cafe', 'bar', 'pub', 'fast_food'] as const;
