import type {
  AcceptanceResult,
  Clock,
  MatchCandidateDto,
  PlaceId,
  StatusChangeResponseDto,
} from '@amexbutikker/contracts';
import type { LocationProvider } from '../location/location.ports';
import type { PlacesApiClient } from '../places/places.ports';
import type { Purchase } from '../spending/spending.model';
import type { SpendingService } from '../spending/spending.ports';
import type { PaymentOutcome, WalletPayment } from './payments.model';
import type { AskedPlaceStorage, HandledPaymentStorage, PaymentService } from './payments.ports';

export interface MatchingPaymentServiceConfig {
  /** The same merchant and amount again within this time is the same payment. */
  readonly duplicateWindowMs: number;
  /** After paying with another card, a place is not asked about again within this time. */
  readonly askAgainAfterMs: number;
}

/** A place with one of these needs no answer from a payment with another card. */
const FIRM_STATUSES: ReadonlySet<string> = new Set(['accepted', 'rejected']);

/**
 * Handles a wallet payment on the phone. Only the merchant name and the position go to the
 * API; the amount stays in Bonus.
 */
export class MatchingPaymentService implements PaymentService {
  public constructor(
    private readonly places: PlacesApiClient,
    private readonly location: LocationProvider,
    private readonly spending: SpendingService,
    private readonly handled: HandledPaymentStorage,
    private readonly asked: AskedPlaceStorage,
    private readonly clock: Clock,
    private readonly config: MatchingPaymentServiceConfig,
  ) {}

  public async handle(payment: WalletPayment): Promise<PaymentOutcome> {
    if (await this.seenBefore(payment)) {
      return { type: 'duplicate' };
    }
    if (payment.card === 'other') {
      return this.ask(payment.merchant);
    }
    const purchase =
      payment.amountNok === null
        ? null
        : await this.spending.recordPurchase({
            date: this.spending.today(),
            amountNok: payment.amountNok,
            merchant: payment.merchant,
            source: 'wallet',
          });
    return this.retry(payment.merchant, purchase);
  }

  public async retry(merchant: string, purchase: Purchase | null): Promise<PaymentOutcome> {
    try {
      return await this.match(merchant, purchase);
    } catch {
      return { type: 'offline', merchantName: merchant, purchase };
    }
  }

  public async answer(
    placeId: PlaceId,
    result: AcceptanceResult,
    purchase: Purchase | null,
  ): Promise<StatusChangeResponseDto> {
    const change = await this.places.submitReport(placeId, { result, via: 'wallet' });
    if (result === 'rejected' && purchase !== null) {
      await this.spending.removeEntry(purchase.id);
    }
    return change;
  }

  public undo(placeId: PlaceId): Promise<StatusChangeResponseDto> {
    return this.places.removeMyReport(placeId);
  }

  /** The other-card path: asks about one clear place at most once per `askAgainAfterMs`. */
  private async ask(merchant: string): Promise<PaymentOutcome> {
    let candidate: MatchCandidateDto | null;
    try {
      candidate = (await this.findClear(merchant)).clear;
    } catch {
      return { type: 'quiet', candidate: null };
    }
    if (candidate === null || FIRM_STATUSES.has(candidate.status.status)) {
      return { type: 'quiet', candidate };
    }
    const now = this.clock.now().getTime();
    const recent = (await this.asked.list()).filter(
      (asked) => now - Date.parse(asked.askedAt) < this.config.askAgainAfterMs,
    );
    const placeId = candidate.place.id;
    if (recent.some((asked) => asked.placeId === placeId)) {
      return { type: 'quiet', candidate };
    }
    await this.asked.save([...recent, { placeId, askedAt: new Date(now).toISOString() }]);
    return { type: 'ask', candidate };
  }

  private async findClear(merchant: string) {
    const here = await this.location.findCurrent();
    const match = await this.places.matchPayment({
      merchant,
      ...(here === null ? {} : { lat: here.lat, lng: here.lng }),
    });
    const { decision } = match;
    const clear =
      decision.type === 'open'
        ? (match.candidates.find((candidate) => candidate.place.id === decision.placeId) ?? null)
        : null;
    return { match, clear };
  }

  private async match(merchant: string, purchase: Purchase | null): Promise<PaymentOutcome> {
    const { match, clear } = await this.findClear(merchant);
    const merchantName = match.merchantName ?? merchant;
    if (clear !== null) {
      const answered = await this.answerClear(clear, match.candidates, purchase);
      if (answered !== null) {
        return answered;
      }
    }
    return match.candidates.length === 0
      ? { type: 'none', merchantName, purchase }
      : { type: 'choose', merchantName, candidates: match.candidates, purchase };
  }

  /** null when the answer could not be sent; the user then picks the place by hand. */
  private async answerClear(
    candidate: MatchCandidateDto,
    candidates: readonly MatchCandidateDto[],
    purchase: Purchase | null,
  ): Promise<PaymentOutcome | null> {
    try {
      const { status } = await this.answer(candidate.place.id, 'accepted', purchase);
      return { type: 'answered', candidate, status, candidates, purchase };
    } catch {
      return null;
    }
  }

  /** Remembers the payment; true when the same one was handled within the window. */
  private async seenBefore(payment: WalletPayment): Promise<boolean> {
    const now = this.clock.now().getTime();
    const key = `${payment.card}|${payment.merchant.toLocaleLowerCase('nb')}|${String(payment.amountNok ?? '')}`;
    const recent = (await this.handled.list()).filter(
      (handled) => now - Date.parse(handled.handledAt) < this.config.duplicateWindowMs,
    );
    const seen = recent.some((handled) => handled.key === key);
    if (!seen) {
      await this.handled.save([...recent, { key, handledAt: new Date(now).toISOString() }]);
    }
    return seen;
  }
}
