import { z } from 'zod';

/** When a card's spending counts towards a goal. */
export type CardGoalPeriod =
  | { readonly kind: 'calendar_year' }
  /** From a start date the user gives, e.g. when the card was opened. */
  | { readonly kind: 'window'; readonly months: number };

export const CardGoalPeriodSchema: z.ZodType<CardGoalPeriod> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('calendar_year') }),
  z.object({ kind: z.literal('window'), months: z.int().min(1).max(60) }),
]);

/** A spending goal a card has, e.g. 150 000 kr in a calendar year for a companion ticket. */
export interface CardGoal {
  readonly title: string;
  readonly targetNok: number;
  readonly period: CardGoalPeriod;
  readonly reward: string;
}

export const CardGoalSchema: z.ZodType<CardGoal> = z.object({
  title: z.string().min(1).max(80),
  targetNok: z.int().positive().max(100_000_000),
  period: CardGoalPeriodSchema,
  reward: z.string().max(200),
});

/**
 * An American Express card issued in Norway, with the spending goals it has. Hints, not terms:
 * `fetchedAt` is when the source was read; the app tells the user to check the issuer's terms.
 */
export interface Card {
  readonly id: string;
  readonly name: string;
  /** For lists and headings, e.g. "SAS Amex Premium". */
  readonly shortName: string;
  /** Empty when no checked source gives a spending goal for the card. */
  readonly goals: readonly CardGoal[];
  /** Where the goals were read; null for a card without goals. */
  readonly sourceUrl: string | null;
  /** `YYYY-MM-DD`. */
  readonly fetchedAt: string;
}

export const CardSchema: z.ZodType<Card> = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  shortName: z.string().min(1).max(40),
  goals: z.array(CardGoalSchema),
  sourceUrl: z.url().nullable(),
  fetchedAt: z.iso.date(),
});
