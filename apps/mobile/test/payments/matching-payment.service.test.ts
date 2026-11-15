import type {
  Clock,
  GeoPoint,
  MatchCandidateDto,
  MatchPaymentRequestDto,
  MatchPaymentResponseDto,
  PlaceId,
  StatusChangeResponseDto,
  SubmitReportRequestDto,
} from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import type { LocationProvider } from '../../src/location/location.ports';
import { KeyValueAskedPlaceStorage } from '../../src/payments/key-value-asked-place.storage';
import { KeyValueHandledPaymentStorage } from '../../src/payments/key-value-handled-payment.storage';
import { MatchingPaymentService } from '../../src/payments/matching-payment.service';
import type { PlacesApiClient } from '../../src/places/places.ports';
import { KeyValueSpendingStorage } from '../../src/spending/key-value-spending.storage';
import { MapKeyValueStorage, PLACE_ID, physicalPlace, summary } from '../shared/mobile-test.data';
import { FixedLocalDateProvider, spendingService } from '../spending/spending-test.data';

const OTHER_ID = '0190a000-0000-7000-8000-000000000002' as PlaceId;
const HERE: GeoPoint = { lat: 59.915, lng: 10.752 };
const T0 = new Date('2026-11-08T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60_000;

function candidate(id: PlaceId, name: string): MatchCandidateDto {
  return { place: physicalPlace({ id, name }), status: summary().status, score: 0.9, reasons: [] };
}

const change: StatusChangeResponseDto = {
  status: { ...summary().status, status: 'likely_accepted', basis: 'visit_report', verified: true },
  chainHint: null,
};

class StubPlacesApi implements PlacesApiClient {
  public matches: MatchPaymentRequestDto[] = [];
  public reports: [PlaceId, SubmitReportRequestDto][] = [];
  public removed: PlaceId[] = [];
  public reportFails = false;

  public constructor(private readonly response: MatchPaymentResponseDto | Error) {}

  public matchPayment(input: MatchPaymentRequestDto): Promise<MatchPaymentResponseDto> {
    this.matches.push(input);
    return this.response instanceof Error
      ? Promise.reject(this.response)
      : Promise.resolve(this.response);
  }

  public submitReport(
    placeId: PlaceId,
    input: SubmitReportRequestDto,
  ): Promise<StatusChangeResponseDto> {
    this.reports.push([placeId, input]);
    return this.reportFails ? Promise.reject(new Error('offline')) : Promise.resolve(change);
  }

  public removeMyReport(placeId: PlaceId): Promise<StatusChangeResponseDto> {
    this.removed.push(placeId);
    return Promise.resolve(change);
  }

  public search(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }

  public listNearby(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }

  public listInArea(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }

  public getDetails(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }

  public create(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }

  public matchShared(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }
}

class StubLocation implements LocationProvider {
  public constructor(private readonly point: GeoPoint | null) {}

  public findCurrent(): Promise<GeoPoint | null> {
    return Promise.resolve(this.point);
  }
}

class MovableClock implements Clock {
  public current = T0;

  public now(): Date {
    return this.current;
  }
}

function setup(response: MatchPaymentResponseDto | Error, here: GeoPoint | null = HERE) {
  const api = new StubPlacesApi(response);
  const clock = new MovableClock();
  const spending = spendingService(
    new KeyValueSpendingStorage(new MapKeyValueStorage(), { key: 'spending' }),
    new FixedLocalDateProvider('2026-11-08'),
  );
  const service = new MatchingPaymentService(
    api,
    new StubLocation(here),
    spending,
    new KeyValueHandledPaymentStorage(new MapKeyValueStorage(), { key: 'paid' }),
    new KeyValueAskedPlaceStorage(new MapKeyValueStorage(), { key: 'asked' }),
    clock,
    { duplicateWindowMs: 10 * 60_000, askAgainAfterMs: DAY_MS },
  );
  return { api, clock, spending, service };
}

const clear: MatchPaymentResponseDto = {
  merchantName: 'Kafé Åsen',
  candidates: [candidate(PLACE_ID, 'Kafé Åsen'), candidate(OTHER_ID, 'Narvesen')],
  decision: { type: 'open', placeId: PLACE_ID },
};

describe('MatchingPaymentService', () => {
  it('answers "Tar Amex" at one clear place and saves the amount as a wallet purchase', async () => {
    const { api, spending, service } = setup(clear);

    const outcome = await service.handle({
      merchant: 'SQ *KAFE ASEN',
      amountNok: 249,
      card: 'amex',
    });

    expect(api.matches).toEqual([{ merchant: 'SQ *KAFE ASEN', lat: HERE.lat, lng: HERE.lng }]);
    expect(api.reports).toEqual([[PLACE_ID, { result: 'accepted', via: 'wallet' }]]);
    expect(outcome).toMatchObject({
      type: 'answered',
      candidate: { place: { id: PLACE_ID } },
      status: { status: 'likely_accepted' },
      candidates: clear.candidates,
      purchase: { amountNok: 249, merchant: 'SQ *KAFE ASEN', source: 'wallet', date: '2026-11-08' },
    });
    expect((await spending.overview()).purchases).toHaveLength(1);
  });

  it('never sends the amount to the API', async () => {
    const { api, service } = setup(clear);

    await service.handle({ merchant: 'Kafé Åsen', amountNok: 249, card: 'amex' });

    expect(JSON.stringify([api.matches, api.reports])).not.toContain('249');
  });

  it('matches without a position when there is none, and saves no purchase without an amount', async () => {
    const { api, spending, service } = setup(clear, null);

    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: null, card: 'amex' });

    expect(api.matches).toEqual([{ merchant: 'Kafé Åsen' }]);
    expect(outcome).toMatchObject({ type: 'answered', purchase: null });
    expect((await spending.overview()).purchases).toEqual([]);
  });

  it('lets the user choose when several places are likely', async () => {
    const response: MatchPaymentResponseDto = { ...clear, decision: { type: 'choose' } };
    const { api, service } = setup(response);

    const outcome = await service.handle({ merchant: 'KAFE', amountNok: 49, card: 'amex' });

    expect(api.reports).toEqual([]);
    expect(outcome).toMatchObject({
      type: 'choose',
      merchantName: 'Kafé Åsen',
      candidates: response.candidates,
      purchase: { amountNok: 49 },
    });
  });

  it('lets the user choose when the clear answer could not be sent', async () => {
    const { api, service } = setup(clear);
    api.reportFails = true;

    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: null, card: 'amex' });

    expect(outcome).toMatchObject({ type: 'choose', candidates: clear.candidates });
  });

  it('lets the user choose when the clear place is missing from the candidates', async () => {
    const response: MatchPaymentResponseDto = {
      ...clear,
      decision: { type: 'open', placeId: 'x' as PlaceId },
    };
    const { api, service } = setup(response);

    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: null, card: 'amex' });

    expect(api.reports).toEqual([]);
    expect(outcome.type).toBe('choose');
  });

  it('finds no place, keeping the merchant name as typed when the API cleaned nothing', async () => {
    const { service } = setup({ merchantName: null, candidates: [], decision: { type: 'none' } });

    await expect(
      service.handle({ merchant: 'SQ *', amountNok: 10, card: 'amex' }),
    ).resolves.toMatchObject({
      type: 'none',
      merchantName: 'SQ *',
      purchase: { amountNok: 10 },
    });
  });

  it('keeps the amount when the API cannot be reached', async () => {
    const { spending, service } = setup(new Error('offline'));

    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: 99, card: 'amex' });

    expect(outcome).toMatchObject({
      type: 'offline',
      merchantName: 'Kafé Åsen',
      purchase: { amountNok: 99 },
    });
    expect((await spending.overview()).purchases).toHaveLength(1);
  });

  it('matches again on retry without saving the purchase twice', async () => {
    const { api, spending, service } = setup(clear);
    const first = await service.handle({ merchant: 'Kafé Åsen', amountNok: 99, card: 'amex' });
    const purchase = first.type === 'answered' ? first.purchase : null;

    const again = await service.retry('Kafé Åsen', purchase);

    expect(again.type).toBe('answered');
    expect(api.matches).toHaveLength(2);
    expect((await spending.overview()).purchases).toHaveLength(1);
  });

  it('ignores the same payment coming in again, but not after the window', async () => {
    const { api, clock, spending, service } = setup(clear);

    await service.handle({ merchant: 'Kafé Åsen', amountNok: 49, card: 'amex' });
    clock.current = new Date(T0.getTime() + 60_000);
    const again = await service.handle({ merchant: 'KAFÉ ÅSEN', amountNok: 49, card: 'amex' });
    const other = await service.handle({ merchant: 'Kafé Åsen', amountNok: 50, card: 'amex' });
    clock.current = new Date(T0.getTime() + 11 * 60_000);
    const later = await service.handle({ merchant: 'Kafé Åsen', amountNok: 49, card: 'amex' });

    expect(again).toEqual({ type: 'duplicate' });
    expect(other.type).toBe('answered');
    expect(later.type).toBe('answered');
    expect(api.matches).toHaveLength(3);
    expect((await spending.overview()).purchases).toHaveLength(3);
  });

  it('removes the purchase of a declined payment from Bonus', async () => {
    const { api, spending, service } = setup(clear);
    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: 49, card: 'amex' });
    const purchase = outcome.type === 'answered' ? outcome.purchase : null;

    await service.answer(PLACE_ID, 'rejected', purchase);

    expect(api.reports.at(-1)).toEqual([PLACE_ID, { result: 'rejected', via: 'wallet' }]);
    expect((await spending.overview()).purchases).toEqual([]);
  });

  it('keeps the purchase when the user answers for another place', async () => {
    const { spending, service } = setup(clear);
    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: 49, card: 'amex' });
    const purchase = outcome.type === 'answered' ? outcome.purchase : null;

    await service.answer(OTHER_ID, 'accepted', purchase);
    await service.answer(OTHER_ID, 'rejected', null);

    expect((await spending.overview()).purchases).toHaveLength(1);
  });

  it('takes back an answer with Angre', async () => {
    const { api, service } = setup(clear);

    await expect(service.undo(PLACE_ID)).resolves.toEqual(change);
    expect(api.removed).toEqual([PLACE_ID]);
  });

  describe('with another card', () => {
    const other = { merchant: 'Kafé Åsen', amountNok: 249, card: 'other' } as const;
    const unsure: MatchPaymentResponseDto = {
      ...clear,
      candidates: clear.candidates.map((found) => ({
        ...found,
        status: { ...found.status, status: 'unknown' },
      })),
    };

    it('asks about one clear place, saving no purchase and no answer', async () => {
      const { api, spending, service } = setup(unsure);

      const outcome = await service.handle(other);

      expect(outcome).toMatchObject({ type: 'ask', candidate: { place: { id: PLACE_ID } } });
      expect(api.reports).toEqual([]);
      expect((await spending.overview()).purchases).toEqual([]);
    });

    it('asks about a place once per window', async () => {
      const { clock, service } = setup(unsure);

      await service.handle(other);
      clock.current = new Date(T0.getTime() + 60 * 60_000);
      const again = await service.handle(other);
      clock.current = new Date(T0.getTime() + DAY_MS + 60 * 60_000);
      const later = await service.handle(other);

      expect(again).toMatchObject({ type: 'quiet', candidate: { place: { id: PLACE_ID } } });
      expect(later.type).toBe('ask');
    });

    it.each(['accepted', 'rejected'] as const)(
      'stays quiet at a place that is already %s',
      async (status) => {
        const firm = candidate(PLACE_ID, 'Kafé Åsen');
        const response: MatchPaymentResponseDto = {
          ...clear,
          candidates: [{ ...firm, status: { ...firm.status, status } }],
        };
        const { service } = setup(response);

        await expect(service.handle(other)).resolves.toMatchObject({ type: 'quiet' });
      },
    );

    it('stays quiet without one clear place or without the API', async () => {
      const several = setup({ ...unsure, decision: { type: 'choose' } });
      const offline = setup(new Error('offline'));

      await expect(several.service.handle(other)).resolves.toEqual({
        type: 'quiet',
        candidate: null,
      });
      await expect(offline.service.handle(other)).resolves.toEqual({
        type: 'quiet',
        candidate: null,
      });
    });

    it('is not mistaken for the same payment with the Amex card', async () => {
      const { service } = setup(unsure);

      await service.handle({ ...other, card: 'amex' });

      await expect(service.handle(other)).resolves.toMatchObject({ type: 'ask' });
    });
  });
});
