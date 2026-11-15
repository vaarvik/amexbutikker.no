import { PAYMENT_MERCHANT_MAX_LENGTH } from '@amexbutikker/contracts';
import type { WalletPayment } from './payments.model';
import type { LinkParams, WalletLinkParser } from './payments.ports';

const MAX_AMOUNT_NOK = 100_000_000;
/** Kroner as Shortcuts writes them in Norwegian or English: `kr`, `NOK`, `,-`. */
const KRONER = /\b(?:kr|nok)\b\.?|,-/giu;
/** Any other currency means the amount is not in kroner. */
const OTHER_CURRENCY = /[$€£¥]|\b(?!nok\b)[a-z]{3}\b/iu;
/** `\s` covers the no-break spaces iOS puts in amounts; `'` groups thousands in some locales. */
const SPACES = /[\s']/gu;

/**
 * Reads `merchant`, `amount` and `card` from the link. `card=other` comes from "Registrer annen
 * betaling"; anything else is an Amex payment, as links from before the parameter are. The amount comes as Shortcuts formats it, e.g.
 * `kr 1 299,50`, `1 299,50 kr`, `NOK 249.00` or `249`; it is rounded to whole kroner.
 */
export class ShortcutWalletLinkParser implements WalletLinkParser {
  public parse(params: LinkParams): WalletPayment | null {
    const merchant = this.first(params.merchant)?.trim().slice(0, PAYMENT_MERCHANT_MAX_LENGTH);
    if (merchant === undefined || merchant === '') {
      return null;
    }
    const amount = this.first(params.amount);
    return {
      merchant,
      amountNok: amount === undefined ? null : this.kroner(amount),
      card: this.first(params.card) === 'other' ? 'other' : 'amex',
    };
  }

  private first(value: string | readonly string[] | undefined): string | undefined {
    return typeof value === 'string' ? value : value?.[0];
  }

  private kroner(text: string): number | null {
    const withoutKroner = text.replace(KRONER, ' ');
    if (OTHER_CURRENCY.test(withoutKroner)) {
      return null;
    }
    const digits = withoutKroner.replace(SPACES, '');
    if (!/^\d[\d.,]*$/u.test(digits)) {
      return null;
    }
    const nok = Math.round(Number(this.plainNumber(digits)));
    return Number.isFinite(nok) && nok > 0 && nok <= MAX_AMOUNT_NOK ? nok : null;
  }

  /**
   * `1.299,50` and `1,299.50` → `1299.50`: the last separator is the decimal one when one or
   * two digits follow it; otherwise every separator groups thousands (`1.299`, `1,299`).
   */
  private plainNumber(digits: string): string {
    const last = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'));
    const decimals = last === -1 ? '' : digits.slice(last + 1);
    if (last !== -1 && decimals.length >= 1 && decimals.length <= 2) {
      return `${digits.slice(0, last).replace(/[.,]/gu, '')}.${decimals}`;
    }
    return digits.replace(/[.,]/gu, '');
  }
}
