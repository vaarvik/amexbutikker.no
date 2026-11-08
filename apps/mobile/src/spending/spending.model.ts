import { PlaceIdSchema } from '@amexbutikker/contracts';
import type { PlaceId } from '@amexbutikker/contracts';
import { z } from 'zod';

/**
 * Spending on the card and bonus milestones. Everything here stays on the phone: the server
 * never sees an amount. See docs/PROMPTS.md, Phase 14.
 */

/** A calendar date in the phone's time zone, `YYYY-MM-DD`. */
export type LocalDate = string;

export const LocalDateSchema: z.ZodType<LocalDate> = z.iso.date();

/** Where an amount came from: typed in, an Apple Wallet payment (Phase 13), or a statement (14d, not built). */
export type SpendingSource = 'manual' | 'wallet' | 'statement';

export const SpendingSourceSchema: z.ZodType<SpendingSource> = z.enum([
  'manual',
  'wallet',
  'statement',
]);

/** One purchase on the card. Whole kroner. */
export interface Purchase {
  readonly kind: 'purchase';
  readonly id: string;
  readonly date: LocalDate;
  readonly amountNok: number;
  readonly merchant: string | null;
  readonly placeId: PlaceId | null;
  readonly source: SpendingSource;
}

/**
 * "So far in this milestone's period I have spent X", typed from the card issuer's app. It
 * replaces every purchase up to and including its date; purchases after it are added on top.
 */
export interface SpentTotal {
  readonly kind: 'total';
  readonly id: string;
  readonly milestoneId: string;
  readonly date: LocalDate;
  readonly amountNok: number;
}

export type SpendingEntry = Purchase | SpentTotal;

const amountNok = z.int().min(0).max(100_000_000);

export const SpendingEntrySchema: z.ZodType<SpendingEntry> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('purchase'),
    id: z.string().min(1),
    date: LocalDateSchema,
    amountNok,
    merchant: z.string().nullable(),
    placeId: PlaceIdSchema.nullable(),
    source: SpendingSourceSchema,
  }),
  z.object({
    kind: z.literal('total'),
    id: z.string().min(1),
    milestoneId: z.string().min(1),
    date: LocalDateSchema,
    amountNok,
  }),
]);

/**
 * When a milestone counts spending: every calendar year (the current one), or a window of
 * `months` starting on `start` (e.g. a welcome bonus from the day the card was opened).
 */
export type MilestonePeriod =
  | { readonly kind: 'calendar_year' }
  | { readonly kind: 'window'; readonly start: LocalDate; readonly months: number };

export const MilestonePeriodSchema: z.ZodType<MilestonePeriod> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('calendar_year') }),
  z.object({ kind: z.literal('window'), start: LocalDateSchema, months: z.int().min(1).max(60) }),
]);

/** Spend `targetNok` within `period` to get `reward`. */
export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly targetNok: number;
  readonly period: MilestonePeriod;
  /** Free text, e.g. "90 000 EuroBonus-poeng". */
  readonly reward: string;
  /** The card id when the milestone is one of the chosen card's goals; null for the user's own. */
  readonly programmeId: string | null;
}

export const MilestoneSchema: z.ZodType<Milestone> = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  targetNok: z.int().min(1).max(100_000_000),
  period: MilestonePeriodSchema,
  reward: z.string().max(120),
  programmeId: z.string().nullable(),
});

/** Everything the Bonus tab stores, as one document. */
/** The card the user has, as it was when chosen. Its goals are milestones with its id. */
export interface ChosenCard {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
}

export const ChosenCardSchema: z.ZodType<ChosenCard> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
});

export interface SpendingState {
  /** The card the user has; the Bonus tab always tracks its goals. */
  readonly card: ChosenCard | null;
  readonly milestones: readonly Milestone[];
  readonly entries: readonly SpendingEntry[];
}

export const SpendingStateSchema: z.ZodType<SpendingState> = z.object({
  // Stored before cards were chosen: none.
  card: ChosenCardSchema.nullable().default(null),
  milestones: z.array(MilestoneSchema),
  entries: z.array(SpendingEntrySchema),
});

export const EMPTY_SPENDING_STATE: SpendingState = { card: null, milestones: [], entries: [] };

/**
 * Where a milestone stands on a given day.
 * - `upcoming`: the period has not started; `active`: running; `reached`: target met (any time);
 * - `missed`: the period is over without reaching the target.
 */
export type MilestoneStanding = 'upcoming' | 'active' | 'reached' | 'missed';

export interface MilestoneProgress {
  readonly milestone: Milestone;
  /** First and last day of the period, both included. */
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly spentNok: number;
  readonly remainingNok: number;
  /** Days from today to the end, today included; 0 once the period is over. */
  readonly daysLeft: number;
  /** Kroner per 30 days needed from today to reach the target in time; 0 when reached. */
  readonly perMonthNeededNok: number;
  /** Spent at least the share of the target that the share of the period gone by asks for. */
  readonly onPace: boolean;
  readonly standing: MilestoneStanding;
  /** The latest typed total counted, if any. */
  readonly totalAsOf: LocalDate | null;
}

/** Spending in one month of the current year. */
export interface MonthSpending {
  /** 1 = January. */
  readonly month: number;
  readonly nok: number;
}

/** Purchases registered in the app this calendar year, for the Bonus tab's progress. */
export interface YearSpending {
  readonly year: number;
  readonly spentNok: number;
  readonly purchaseCount: number;
  /** January up to and including the current month. */
  readonly months: readonly MonthSpending[];
}
