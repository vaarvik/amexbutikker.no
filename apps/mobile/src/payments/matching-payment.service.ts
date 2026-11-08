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
import type { HandledPaymentStorage, PaymentService } from './payments.ports';

export interface MatchingPaymentServiceConfig {
  /** The same merchant and amount again within this time is the same payment. */
  readonly duplicateWindowMs: number;
}

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
    private readonly clock: Clock,
    private readonly config: MatchingPaymentServiceConfig,
  ) {}

  public async handle(payment: WalletPayment): Promise<PaymentOutcome> {
    if (await this.seenBefore(payment)) {
      return { type: 'duplicate' };
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

  private async match(merchant: string, purchase: Purchase | null): Promise<PaymentOutcome> {
    const here = await this.location.findCurrent();
    const match = await this.places.matchPayment({
      merchant,
      ...(here === null ? {} : { lat: here.lat, lng: here.lng }),
    });
    const merchantName = match.merchantName ?? merchant;
    const { decision } = match;
    const clear =
      decision.type === 'open'
        ? match.candidates.find((candidate) => candidate.place.id === decision.placeId)
        : undefined;
    if (clear !== undefined) {
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
    const key = `${payment.merchant.toLocaleLowerCase('nb')}|${String(payment.amountNok ?? '')}`;
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
