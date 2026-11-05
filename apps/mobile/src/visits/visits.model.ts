import { GeoPointSchema, IsoDateTimeSchema, PlaceIdSchema } from '@amexbutikker/contracts';
import type { GeoPoint, IsoDateTime, PlaceId } from '@amexbutikker/contracts';
import { z } from 'zod';

/**
 * What the app does when the user visits a place: `ask` whether Amex worked (on leaving), or
 * `announce` that it works (on arrival). See docs/adr/0001-visit-detection.md.
 */
export type VisitPromptKind = 'ask' | 'announce';

export const VisitPromptKindSchema: z.ZodType<VisitPromptKind> = z.enum(['ask', 'announce']);

/** A geofence around one place. Its identifier at the OS is the place id. */
export interface VisitRegion {
  readonly placeId: PlaceId;
  readonly name: string;
  readonly center: GeoPoint;
  readonly radiusM: number;
  readonly prompt: VisitPromptKind;
}

export const VisitRegionSchema: z.ZodType<VisitRegion> = z.object({
  placeId: PlaceIdSchema,
  name: z.string(),
  center: GeoPointSchema,
  radiusM: z.number().positive(),
  prompt: VisitPromptKindSchema,
});

/** The OS reports that the phone entered or left a region. */
export interface VisitEvent {
  readonly kind: 'enter' | 'exit';
  readonly placeId: string;
}

/** A local notification to show. */
export interface VisitPrompt {
  readonly kind: VisitPromptKind;
  readonly placeId: PlaceId;
  readonly name: string;
}

/** Everything visit detection remembers. Kept on the phone only. */
export interface VisitState {
  readonly enabled: boolean;
  readonly regions: readonly VisitRegion[];
  /** When the phone entered each region it is still inside. */
  readonly enteredAt: Readonly<Record<string, IsoDateTime>>;
  /** The last question per place. */
  readonly askedAt: Readonly<Record<string, IsoDateTime>>;
  /** The last "Amex works here" per place. */
  readonly announcedAt: Readonly<Record<string, IsoDateTime>>;
  /** Every question asked in the last 24 hours, oldest first. */
  readonly recentAsks: readonly IsoDateTime[];
}

const TimesSchema = z.record(z.string(), IsoDateTimeSchema);

export const VisitStateSchema: z.ZodType<VisitState> = z.object({
  enabled: z.boolean(),
  regions: z.array(VisitRegionSchema),
  enteredAt: TimesSchema,
  askedAt: TimesSchema,
  announcedAt: TimesSchema,
  recentAsks: z.array(IsoDateTimeSchema),
});

export const EMPTY_VISIT_STATE: VisitState = {
  enabled: false,
  regions: [],
  enteredAt: {},
  askedAt: {},
  announcedAt: {},
  recentAsks: [],
};

/** The answer buttons on a question notification; the identifiers are the report results. */
export type VisitAnswer = 'accepted' | 'rejected' | 'skipped';
