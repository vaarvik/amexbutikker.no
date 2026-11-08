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
import { KeyValueHandledPaymentStorage } from '../../src/payments/key-value-handled-payment.storage';
import { MatchingPaymentService } from '../../src/payments/matching-payment.service';
import type { PlacesApiClient } from '../../src/places/places.ports';
import { KeyValueSpendingStorage } from '../../src/spending/key-value-spending.storage';
import { PeriodMilestoneProgressCalculator } from '../../src/spending/period-milestone-progress.calculator';
import { StoredSpendingService } from '../../src/spending/stored-spending.service';
import { MapKeyValueStorage, PLACE_ID, physicalPlace, summary } from '../shared/mobile-test.data';
import { CountingIdGenerator, FixedLocalDateProvider } from '../spending/spending-test.data';

const OTHER_ID = '0190a000-0000-7000-8000-000000000002' as PlaceId;
const HERE: GeoPoint = { lat: 59.915, lng: 10.752 };
const T0 = new Date('2026-11-08T12:00:00.000Z');

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
  const spending = new StoredSpendingService(
    new KeyValueSpendingStorage(new MapKeyValueStorage(), { key: 'spending' }),
    new PeriodMilestoneProgressCalculator(),
    new FixedLocalDateProvider('2026-11-08'),
    new CountingIdGenerator(),
  );
  const service = new MatchingPaymentService(
    api,
    new StubLocation(here),
    spending,
    new KeyValueHandledPaymentStorage(new MapKeyValueStorage(), { key: 'paid' }),
    clock,
    { duplicateWindowMs: 10 * 60_000 },
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

    const outcome = await service.handle({ merchant: 'SQ *KAFE ASEN', amountNok: 249 });

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

    await service.handle({ merchant: 'Kafé Åsen', amountNok: 249 });

    expect(JSON.stringify([api.matches, api.reports])).not.toContain('249');
  });

  it('matches without a position when there is none, and saves no purchase without an amount', async () => {
    const { api, spending, service } = setup(clear, null);

    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: null });

    expect(api.matches).toEqual([{ merchant: 'Kafé Åsen' }]);
    expect(outcome).toMatchObject({ type: 'answered', purchase: null });
    expect((await spending.overview()).purchases).toEqual([]);
  });

  it('lets the user choose when several places are likely', async () => {
    const response: MatchPaymentResponseDto = { ...clear, decision: { type: 'choose' } };
    const { api, service } = setup(response);

    const outcome = await service.handle({ merchant: 'KAFE', amountNok: 49 });

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

    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: null });

    expect(outcome).toMatchObject({ type: 'choose', candidates: clear.candidates });
  });

  it('lets the user choose when the clear place is missing from the candidates', async () => {
    const response: MatchPaymentResponseDto = {
      ...clear,
      decision: { type: 'open', placeId: 'x' as PlaceId },
    };
    const { api, service } = setup(response);

    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: null });

    expect(api.reports).toEqual([]);
    expect(outcome.type).toBe('choose');
  });

  it('finds no place, keeping the merchant name as typed when the API cleaned nothing', async () => {
    const { service } = setup({ merchantName: null, candidates: [], decision: { type: 'none' } });

    await expect(service.handle({ merchant: 'SQ *', amountNok: 10 })).resolves.toMatchObject({
      type: 'none',
      merchantName: 'SQ *',
      purchase: { amountNok: 10 },
    });
  });

  it('keeps the amount when the API cannot be reached', async () => {
    const { spending, service } = setup(new Error('offline'));

    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: 99 });

    expect(outcome).toMatchObject({
      type: 'offline',
      merchantName: 'Kafé Åsen',
      purchase: { amountNok: 99 },
    });
    expect((await spending.overview()).purchases).toHaveLength(1);
  });

  it('matches again on retry without saving the purchase twice', async () => {
    const { api, spending, service } = setup(clear);
    const first = await service.handle({ merchant: 'Kafé Åsen', amountNok: 99 });
    const purchase = first.type === 'answered' ? first.purchase : null;

    const again = await service.retry('Kafé Åsen', purchase);

    expect(again.type).toBe('answered');
    expect(api.matches).toHaveLength(2);
    expect((await spending.overview()).purchases).toHaveLength(1);
  });

  it('ignores the same payment coming in again, but not after the window', async () => {
    const { api, clock, spending, service } = setup(clear);

    await service.handle({ merchant: 'Kafé Åsen', amountNok: 49 });
    clock.current = new Date(T0.getTime() + 60_000);
    const again = await service.handle({ merchant: 'KAFÉ ÅSEN', amountNok: 49 });
    const other = await service.handle({ merchant: 'Kafé Åsen', amountNok: 50 });
    clock.current = new Date(T0.getTime() + 11 * 60_000);
    const later = await service.handle({ merchant: 'Kafé Åsen', amountNok: 49 });

    expect(again).toEqual({ type: 'duplicate' });
    expect(other.type).toBe('answered');
    expect(later.type).toBe('answered');
    expect(api.matches).toHaveLength(3);
    expect((await spending.overview()).purchases).toHaveLength(3);
  });

  it('removes the purchase of a declined payment from Bonus', async () => {
    const { api, spending, service } = setup(clear);
    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: 49 });
    const purchase = outcome.type === 'answered' ? outcome.purchase : null;

    await service.answer(PLACE_ID, 'rejected', purchase);

    expect(api.reports.at(-1)).toEqual([PLACE_ID, { result: 'rejected', via: 'wallet' }]);
    expect((await spending.overview()).purchases).toEqual([]);
  });

  it('keeps the purchase when the user answers for another place', async () => {
    const { spending, service } = setup(clear);
    const outcome = await service.handle({ merchant: 'Kafé Åsen', amountNok: 49 });
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
});
