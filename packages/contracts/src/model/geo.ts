import { z } from 'zod';

/** WGS 84 coordinate. */
export interface GeoPoint {
  /** Latitude in degrees, -90..90. */
  readonly lat: number;
  /** Longitude in degrees, -180..180. */
  readonly lng: number;
}

export const GeoPointSchema: z.ZodType<GeoPoint> = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
