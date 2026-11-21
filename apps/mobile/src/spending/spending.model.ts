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

/**
 * Who a purchase is for, in a household sharing a card: `shared` (split equally between the
 * members, the default) or `private` (only the one who paid).
 */
export type PurchaseSplit = 'shared' | 'private';

export const PurchaseSplitSchema: z.ZodType<PurchaseSplit> = z.enum(['shared', 'private']);

/** One purchase on the card. Whole kroner. */
export interface Purchase {
  readonly kind: 'purchase';
  readonly id: string;
  readonly date: LocalDate;
  readonly amountNok: number;
  readonly merchant: string | null;
  readonly placeId: PlaceId | null;
  readonly source: SpendingSource;
  /**
   * The member (phone) that paid: the one that recorded it, until someone changes it. Null for
   * purchases stored before members existed.
   */
  readonly paidBy: string | null;
  readonly split: PurchaseSplit;
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
    // Stored before members: nobody, shared.
    paidBy: z.string().min(1).nullable().default(null),
    split: PurchaseSplitSchema.default('shared'),
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

/**
 * One phone in the household, by the name its owner gave it. Every phone has a member id, also
 * without a household; the id is random and the name is sealed like the rest of spending.
 */
export interface SpendingMember {
  readonly id: string;
  readonly name: string;
}

export const MEMBER_NAME_MAX_LENGTH = 40;

export const SpendingMemberSchema: z.ZodType<SpendingMember> = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(MEMBER_NAME_MAX_LENGTH),
});

/** Everything the Bonus tab stores, as one document. */
export interface SpendingState {
  /** The card the user has; the Bonus tab always tracks its goals. */
  readonly card: ChosenCard | null;
  readonly milestones: readonly Milestone[];
  readonly entries: readonly SpendingEntry[];
  /**
   * Ids of removed entries and milestones. A household replays changes from several phones, so a
   * removal must stay final even when the addition arrives again or later.
   */
  readonly removedIds: readonly string[];
  /** The members that have named themselves. */
  readonly members: readonly SpendingMember[];
}

export const SpendingStateSchema: z.ZodType<SpendingState> = z.object({
  // Stored before cards were chosen: none.
  card: ChosenCardSchema.nullable().default(null),
  milestones: z.array(MilestoneSchema),
  entries: z.array(SpendingEntrySchema),
  // Stored before households: nothing removed.
  removedIds: z.array(z.string()).default([]),
  // Stored before members: none.
  members: z.array(SpendingMemberSchema).default([]),
});

export const EMPTY_SPENDING_STATE: SpendingState = {
  card: null,
  milestones: [],
  entries: [],
  removedIds: [],
  members: [],
};

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

/** What one member paid, and where they stand on the shared purchases. */
export interface MemberShare {
  readonly member: SpendingMember;
  readonly paidSharedNok: number;
  readonly privateNok: number;
  /**
   * Paid for shared purchases minus an equal share of them: above 0 the others owe this member,
   * below 0 this member owes.
   */
  readonly balanceNok: number;
}

/** How a household's purchases split between its members. */
export interface SpendingShares {
  /** Shared purchases with a known payer. */
  readonly sharedNok: number;
  /** In member order: the named members, then anyone who paid without a name. */
  readonly members: readonly MemberShare[];
  /** Purchases from before members, which count for nobody. */
  readonly unassignedNok: number;
}

/** Purchases registered in the app this calendar year, for the Bonus tab's progress. */
export interface YearSpending {
  readonly year: number;
  readonly spentNok: number;
  readonly purchaseCount: number;
  /** January up to and including the current month. */
  readonly months: readonly MonthSpending[];
}

/**
 * One change to spending, as the phones in a household share it (sealed). Replaying the same
 * changes in the same order gives the same state on every phone; applying one twice does nothing.
 * - `entry_added` / `entry_removed`: purchases and typed totals, by id; a removal is final.
 * - `card_set`: the household's card and its goals, replacing the previous card's goals.
 * - `milestone_added` / `milestone_removed`: the user's own goals, e.g. a welcome bonus.
 * - `purchase_updated`: who paid and whether it is shared, and, when given, a corrected amount,
 *   date or place; the latest wins. Phones on older versions ignore the corrections.
 * - `member_named`: a phone's owner names themselves; the latest wins.
 */
export type SpendingChange = { readonly id: string; readonly at: string } & (
  | { readonly kind: 'entry_added'; readonly entry: SpendingEntry }
  | { readonly kind: 'entry_removed'; readonly entryId: string }
  | {
      readonly kind: 'card_set';
      readonly card: ChosenCard | null;
      readonly milestones: readonly Milestone[];
    }
  | { readonly kind: 'milestone_added'; readonly milestone: Milestone }
  | { readonly kind: 'milestone_removed'; readonly milestoneId: string }
  | {
      readonly kind: 'purchase_updated';
      readonly entryId: string;
      readonly paidBy: string | null;
      readonly split: PurchaseSplit;
      readonly date?: LocalDate;
      readonly amountNok?: number;
      readonly merchant?: string | null;
    }
  | { readonly kind: 'member_named'; readonly member: SpendingMember }
);

const changeBase = { id: z.string().min(1), at: z.iso.datetime() };

export const SpendingChangeSchema: z.ZodType<SpendingChange> = z.discriminatedUnion('kind', [
  z.object({ ...changeBase, kind: z.literal('entry_added'), entry: SpendingEntrySchema }),
  z.object({ ...changeBase, kind: z.literal('entry_removed'), entryId: z.string().min(1) }),
  z.object({
    ...changeBase,
    kind: z.literal('card_set'),
    card: ChosenCardSchema.nullable(),
    milestones: z.array(MilestoneSchema),
  }),
  z.object({ ...changeBase, kind: z.literal('milestone_added'), milestone: MilestoneSchema }),
  z.object({
    ...changeBase,
    kind: z.literal('milestone_removed'),
    milestoneId: z.string().min(1),
  }),
  z.object({
    ...changeBase,
    kind: z.literal('purchase_updated'),
    entryId: z.string().min(1),
    paidBy: z.string().min(1).nullable(),
    split: PurchaseSplitSchema,
    date: LocalDateSchema.exactOptional(),
    amountNok: amountNok.exactOptional(),
    merchant: z.string().nullable().exactOptional(),
  }),
  z.object({ ...changeBase, kind: z.literal('member_named'), member: SpendingMemberSchema }),
]);
