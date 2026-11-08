import { PAYMENT_MERCHANT_MAX_LENGTH, UNKNOWN_PLACE_STATUS } from '@amexbutikker/contracts';
import type {
  InputValidator,
  MatchDecider,
  MatchPayment,
  MatchPaymentInput,
  MatchPaymentOutput,
  MerchantNameParser,
  PlaceMatcher,
  PlaceStatusReader,
} from '@amexbutikker/contracts';
import { z } from 'zod';

const MerchantSchema = z.string().trim().min(1).max(PAYMENT_MERCHANT_MAX_LENGTH);

export class MatchPaymentUseCase implements MatchPayment {
  public constructor(
    private readonly merchantNames: MerchantNameParser,
    private readonly matcher: PlaceMatcher,
    private readonly decider: MatchDecider,
    private readonly statuses: PlaceStatusReader,
    private readonly validator: InputValidator,
  ) {}

  public async execute(input: MatchPaymentInput): Promise<MatchPaymentOutput> {
    const merchantName = this.merchantNames.parse(
      this.validator.validate(MerchantSchema, input.merchant),
    );
    if (merchantName === null) {
      return { merchantName, candidates: [], decision: { type: 'none' } };
    }
    const candidates = (
      await this.matcher.match({
        provider: 'unknown',
        name: merchantName,
        street: null,
        postcode: null,
        city: null,
        location: input.location,
        urls: [],
      })
    ).slice(0, 3);
    const snapshots = await this.statuses.listByPlaces(
      candidates.map((candidate) => candidate.place.id),
    );
    return {
      merchantName,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        status: snapshots.get(candidate.place.id)?.status ?? UNKNOWN_PLACE_STATUS,
      })),
      decision: this.decider.decide(candidates),
    };
  }
}
