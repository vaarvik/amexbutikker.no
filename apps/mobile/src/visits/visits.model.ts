import {
  GeoPointSchema,
  IsoDateTimeSchema,
  PlaceCategorySchema,
  PlaceIdSchema,
} from '@amexbutikker/contracts';
import type { GeoPoint, IsoDateTime, PlaceCategory, PlaceId } from '@amexbutikker/contracts';
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
  readonly category: PlaceCategory;
  readonly center: GeoPoint;
  readonly radiusM: number;
  readonly prompt: VisitPromptKind;
}

export const VisitRegionSchema: z.ZodType<VisitRegion> = z.object({
  placeId: PlaceIdSchema,
  name: z.string(),
  category: PlaceCategorySchema,
  center: GeoPointSchema,
  radiusM: z.number().positive(),
  prompt: VisitPromptKindSchema,
});

/** The OS reports that the phone entered or left a region. */
export interface VisitEvent {
  readonly kind: 'enter' | 'exit';
  readonly placeId: string;
}

/** A place the user may have paid at. */
export interface VisitCandidate {
  readonly placeId: PlaceId;
  readonly name: string;
  readonly category: PlaceCategory;
}

export const VisitCandidateSchema: z.ZodType<VisitCandidate> = z.object({
  placeId: PlaceIdSchema,
  name: z.string(),
  category: PlaceCategorySchema,
});

/**
 * A local notification to show. `ask` names one place; `pick` lists the likely places when the
 * fences overlapped and no single one stood out; `announce` says that Amex works here.
 */
export type VisitPrompt =
  | { readonly kind: 'ask'; readonly candidate: VisitCandidate }
  | { readonly kind: 'pick'; readonly candidates: readonly VisitCandidate[] }
  | { readonly kind: 'announce'; readonly candidate: VisitCandidate };

/**
 * Time spent inside one region during the current visit. A visit lasts from the first enter
 * until the phone has left every region; overlapping fences make one visit, not several.
 */
export interface VisitStay {
  readonly placeId: PlaceId;
  /** Set while the phone is inside. */
  readonly enteredAt: IsoDateTime | null;
  /** Time inside before the latest enter. */
  readonly insideMs: number;
}

export const VisitStaySchema: z.ZodType<VisitStay> = z.object({
  placeId: PlaceIdSchema,
  enteredAt: IsoDateTimeSchema.nullable(),
  insideMs: z.number().nonnegative(),
});

/** A candidate with its score from the ranker, best first. */
export interface RankedVisitCandidate {
  readonly candidate: VisitCandidate;
  readonly insideMs: number;
  /** 0 to 1. */
  readonly score: number;
}

/** Everything visit detection remembers. Kept on the phone only. */
export interface VisitState {
  readonly enabled: boolean;
  readonly regions: readonly VisitRegion[];
  /** The visit in progress; empty between visits. */
  readonly stays: readonly VisitStay[];
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
  stays: z.array(VisitStaySchema),
  askedAt: TimesSchema,
  announcedAt: TimesSchema,
  recentAsks: z.array(IsoDateTimeSchema),
});

export const EMPTY_VISIT_STATE: VisitState = {
  enabled: false,
  regions: [],
  stays: [],
  askedAt: {},
  announcedAt: {},
  recentAsks: [],
};

/** Typical time spent at a place of a category, for ranking candidates. */
export interface DwellRange {
  readonly minMs: number;
  readonly maxMs: number;
}

/** The answer buttons on a question notification; the identifiers are the report results. */
export type VisitAnswer = 'accepted' | 'rejected' | 'skipped';
