import type { AcceptanceResult, PlaceId, StatusChangeResponseDto } from '@amexbutikker/contracts';
import type { Purchase } from '../spending/spending.model';
import type {
  AskedPlace,
  HandledPayment,
  PaymentOutcome,
  WalletPayment,
  WalletSetupState,
} from './payments.model';

/** Query parameters as expo-router hands them to a screen. */
export type LinkParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** Reads a payment out of the `amexbutikker://paid` link the shortcut opens. Pure. */
export interface WalletLinkParser {
  /** @returns null when the link has no usable merchant name. */
  parse(params: LinkParams): WalletPayment | null;
}

/** The payments handled lately, on the phone. */
export interface HandledPaymentStorage {
  /** Empty when nothing is stored or the stored value is unreadable. */
  list(): Promise<HandledPayment[]>;
  save(payments: readonly HandledPayment[]): Promise<void>;
}

/** The places the user was asked about after paying with another card, on the phone. */
export interface AskedPlaceStorage {
  /** Empty when nothing is stored or the stored value is unreadable. */
  list(): Promise<AskedPlace[]>;
  save(places: readonly AskedPlace[]): Promise<void>;
}

/** Turns a wallet payment into an answer and, with an amount, a purchase in Bonus. */
export interface PaymentService {
  /**
   * Saves the amount as a `wallet` purchase, matches the merchant and the phone's position to
   * a place and, when one place is clear, answers "Tar Amex" there. Never throws: a failing API
   * gives `offline`.
   *
   * A payment with another card saves nothing and answers nothing: it gives `ask` for one clear
   * place without a firm answer that the user was not asked about lately, and `quiet` otherwise.
   */
  handle(payment: WalletPayment): Promise<PaymentOutcome>;
  /** Matches again after `offline`, without saving the purchase a second time. */
  retry(merchant: string, purchase: Purchase | null): Promise<PaymentOutcome>;
  /**
   * Answers for the place the payment was made at. A declined payment was not spent, so its
   * purchase is removed from Bonus.
   */
  answer(
    placeId: PlaceId,
    result: AcceptanceResult,
    purchase: Purchase | null,
  ): Promise<StatusChangeResponseDto>;
  /** Takes back an answer saved without asking ("Angre"). The purchase stays. */
  undo(placeId: PlaceId): Promise<StatusChangeResponseDto>;
}

/** Whether the Apple Pay automation is set up, on the phone. */
export interface WalletSetupStorage {
  /** `new` when nothing is stored or the stored value is unreadable. */
  find(): Promise<WalletSetupState>;
  save(state: WalletSetupState): Promise<void>;
}
