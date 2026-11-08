import type { MatchCandidateDto, PlaceStatusDto } from '@amexbutikker/contracts';
import { z } from 'zod';
import type { Purchase } from '../spending/spending.model';

/**
 * A card payment handed over by the iOS Shortcuts "Transaction" automation, which opens
 * `amexbutikker://paid?merchant=…&amount=…`. See docs/wallet-shortcut.md and Phase 13.
 */
export interface WalletPayment {
  readonly merchant: string;
  /** Whole kroner; null when the shortcut sent none or it was not in NOK. Stays on the phone. */
  readonly amountNok: number | null;
}

/** What happened to a payment, for the screen to show. */
export type PaymentOutcome =
  /** The same payment came in a moment ago (the automation or the link ran twice). */
  | { readonly type: 'duplicate' }
  /** One clear place: "Tar Amex" saved there without asking, with Angre on screen. */
  | {
      readonly type: 'answered';
      readonly candidate: MatchCandidateDto;
      readonly status: PlaceStatusDto;
      /** Every candidate, the answered one first, for "Feil sted?". */
      readonly candidates: readonly MatchCandidateDto[];
      readonly purchase: Purchase | null;
    }
  /** Several places are likely: the user picks one. */
  | {
      readonly type: 'choose';
      readonly merchantName: string;
      readonly candidates: readonly MatchCandidateDto[];
      readonly purchase: Purchase | null;
    }
  /** No known place: the user may search or add it. */
  | { readonly type: 'none'; readonly merchantName: string; readonly purchase: Purchase | null }
  /** The API could not be reached; the amount is saved anyway. */
  | { readonly type: 'offline'; readonly merchantName: string; readonly purchase: Purchase | null };

/** A payment the app has handled, to ignore it if it comes in again. */
export interface HandledPayment {
  readonly key: string;
  readonly handledAt: string;
}

export const HandledPaymentSchema: z.ZodType<HandledPayment> = z.object({
  key: z.string().min(1),
  handledAt: z.iso.datetime(),
});

/**
 * Whether the Apple Pay automation is set up: `new` until the user says it is done or a payment
 * link arrives, which means it works.
 */
export const WalletSetupStateSchema = z.enum(['new', 'done']);
export type WalletSetupState = z.infer<typeof WalletSetupStateSchema>;
