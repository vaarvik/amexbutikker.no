import type { Card, PlaceId } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { KeyValueSpendingStorage } from '../../src/spending/key-value-spending.storage';
import { MapKeyValueStorage } from '../shared/mobile-test.data';
import type { SpendingChange } from '../../src/spending/spending.model';
import type { SpendingChangeNotifier } from '../../src/spending/spending.ports';
import { FixedLocalDateProvider, spendingService } from './spending-test.data';

function card(id: string, goals: Card['goals']): Card {
  return {
    id,
    name: `Kort ${id}`,
    shortName: id,
    goals,
    sourceUrl: 'https://example.no/vilkar',
    fetchedAt: '2026-11-08',
  };
}

const PREMIUM = card('premium', [
  { title: 'Kupong', targetNok: 150_000, period: { kind: 'calendar_year' }, reward: '2-for-1' },
  // Only yearly goals come with the card; a window needs a start date the user gives.
  { title: 'Velkomst', targetNok: 90_000, period: { kind: 'window', months: 9 }, reward: '' },
]);
const CLASSIC = card('classic', [
  { title: 'Kupong', targetNok: 100_000, period: { kind: 'calendar_year' }, reward: '2-for-1' },
]);

function setup() {
  const dates = new FixedLocalDateProvider('2026-11-07');
  const storage = new KeyValueSpendingStorage(new MapKeyValueStorage(), { key: 'spending' });
  const service = spendingService(storage, dates);
  return { service, storage, dates };
}

describe('StoredSpendingService', () => {
  it('starts empty, without a card', async () => {
    const { storage } = setup();
    const service = spendingService(storage);

    await expect(service.overview()).resolves.toMatchObject({
      progress: [],
      purchases: [],
      year: { year: 2026, spentNok: 0, purchaseCount: 0 },
      card: null,
    });
    expect(service.today()).toBe('2026-11-07');
  });

  it('counts purchases towards a custom milestone and keeps them after a restart', async () => {
    const { service, storage } = setup();
    await service.addMilestone({
      title: 'Mål',
      targetNok: 10_000,
      period: { kind: 'calendar_year' },
      reward: 'Noe fint',
    });
    await service.addPurchase({ date: '2026-03-01', amountNok: 1_000 });
    const overview = await service.addPurchase({
      date: '2026-05-01',
      amountNok: 2_500,
      merchant: 'Kafé Åsen',
      placeId: '0190a000-0000-7000-8000-000000000001' as PlaceId,
    });

    expect(overview.progress[0]).toMatchObject({ spentNok: 3_500, remainingNok: 6_500 });
    expect(overview.purchases.map((purchase) => [purchase.date, purchase.merchant])).toEqual([
      ['2026-05-01', 'Kafé Åsen'],
      ['2026-03-01', null],
    ]);
    expect((await storage.find()).milestones).toHaveLength(1);
  });

  it('sums this year for the progress at the top', async () => {
    const { service } = setup();
    await service.addPurchase({ date: '2026-10-02', amountNok: 300 });
    const overview = await service.addPurchase({ date: '2026-11-01', amountNok: 200 });

    expect(overview.year).toMatchObject({ spentNok: 500, purchaseCount: 2 });
    expect(overview.year.months.slice(-2)).toEqual([
      { month: 10, nok: 300 },
      { month: 11, nok: 200 },
    ]);
  });

  it('records a purchase from the wallet and returns it with its id', async () => {
    const { service, storage } = setup();

    const purchase = await service.recordPurchase({
      date: '2026-11-07',
      amountNok: 249,
      merchant: 'Kaffebrenneriet',
      source: 'wallet',
    });

    expect(purchase.id).not.toBe('');
    expect(purchase).toEqual({
      kind: 'purchase',
      id: purchase.id,
      date: '2026-11-07',
      amountNok: 249,
      merchant: 'Kaffebrenneriet',
      placeId: null,
      source: 'wallet',
    });
    expect((await storage.find()).entries).toEqual([purchase]);
    expect((await service.overview()).purchases[0]?.source).toBe('wallet');
  });

  it('marks a typed purchase as manual', async () => {
    const { service } = setup();

    const overview = await service.addPurchase({ date: '2026-11-07', amountNok: 1 });

    expect(overview.purchases[0]?.source).toBe('manual');
  });

  it('lists purchases newest first, the last added first on the same day', async () => {
    const { service } = setup();
    await service.addPurchase({ date: '2026-03-01', amountNok: 1 });
    await service.addPurchase({ date: '2026-03-02', amountNok: 2 });
    const overview = await service.addPurchase({ date: '2026-03-01', amountNok: 3 });

    expect(overview.purchases.map((purchase) => purchase.amountNok)).toEqual([2, 3, 1]);
  });

  it('records a typed total as of today and removes entries by id', async () => {
    const { service } = setup();
    const added = await service.addMilestone({
      title: 'Mål',
      targetNok: 100_000,
      period: { kind: 'calendar_year' },
      reward: '',
    });
    const id = added.progress[0]?.milestone.id ?? '';
    await service.addPurchase({ date: '2026-11-07', amountNok: 500 });

    const withTotal = await service.updateTotal(id, 40_000);
    const purchaseId = withTotal.purchases[0]?.id ?? '';
    const withoutPurchase = await service.removeEntry(purchaseId);

    expect(withTotal.progress[0]).toMatchObject({ spentNok: 40_000, totalAsOf: '2026-11-07' });
    expect(withoutPurchase.purchases).toEqual([]);
  });

  it('removes a milestone together with its totals', async () => {
    const { service, storage } = setup();
    const added = await service.addMilestone({
      title: 'Mål',
      targetNok: 100,
      period: { kind: 'calendar_year' },
      reward: '',
    });
    const id = added.progress[0]?.milestone.id ?? '';
    await service.updateTotal(id, 50);
    await service.addPurchase({ date: '2026-01-01', amountNok: 10 });

    await expect(service.removeMilestone(id)).resolves.toMatchObject({ progress: [] });
    expect((await storage.find()).entries.map((entry) => entry.kind)).toEqual(['purchase']);
  });

  it('sets up the yearly goals of the chosen card, first', async () => {
    const { service } = setup();
    await service.addMilestone({
      title: 'Velkomstbonus',
      targetNok: 90_000,
      period: { kind: 'window', start: '2026-02-01', months: 9 },
      reward: '',
    });

    const overview = await service.setCard(PREMIUM);

    expect(overview.card).toEqual({ id: 'premium', name: 'Kort premium', shortName: 'premium' });
    expect(overview.progress.map((progress) => progress.milestone)).toEqual([
      expect.objectContaining({
        title: 'Kupong',
        targetNok: 150_000,
        period: { kind: 'calendar_year' },
        programmeId: 'premium',
      }),
      expect.objectContaining({ title: 'Velkomstbonus', programmeId: null }),
    ]);
  });

  it('keeps the goals and their totals when the same card is chosen again', async () => {
    const { service } = setup();
    const first = await service.setCard(PREMIUM);
    const id = first.progress[0]?.milestone.id ?? '';
    await service.updateTotal(id, 40_000);

    const again = await service.setCard(PREMIUM);

    expect(again.progress).toHaveLength(1);
    expect(again.progress[0]).toMatchObject({ milestone: { id }, spentNok: 40_000 });
  });

  it('swaps the goals and drops their totals when another card is chosen', async () => {
    const { service, storage } = setup();
    const first = await service.setCard(PREMIUM);
    await service.updateTotal(first.progress[0]?.milestone.id ?? '', 40_000);

    const overview = await service.setCard(CLASSIC);

    expect(overview.progress.map((progress) => progress.milestone.targetNok)).toEqual([100_000]);
    expect((await storage.find()).entries).toEqual([]);
  });

  it('clears the card and its goals for "Annet kort", keeping the user\'s own', async () => {
    const { service } = setup();
    await service.setCard(CLASSIC);
    await service.addMilestone({
      title: 'Eget',
      targetNok: 10_000,
      period: { kind: 'calendar_year' },
      reward: '',
    });

    const overview = await service.setCard(null);

    expect(overview.card).toBeNull();
    expect(overview.progress.map((progress) => progress.milestone.title)).toEqual(['Eget']);
  });

  it('adds no goals for a card without any', async () => {
    const { service } = setup();

    const overview = await service.setCard(card('gold', []));

    expect(overview).toMatchObject({ card: { id: 'gold' }, progress: [] });
  });

  it('tells the notifier each change, with an id and time, and merges received ones silently', async () => {
    const notifier = new RecordingNotifier();
    const storage = new KeyValueSpendingStorage(new MapKeyValueStorage(), { key: 'spending' });
    const service = spendingService(storage, undefined, notifier);

    const bought = await service.recordPurchase({ date: '2026-11-07', amountNok: 120 });
    await service.removeEntry(bought.id);
    await service.setCard(CLASSIC);

    expect(notifier.received.map((change) => change.kind)).toEqual([
      'entry_added',
      'entry_removed',
      'card_set',
    ]);
    expect(notifier.received[0]).toMatchObject({ at: '2026-11-08T12:00:00.000Z' });

    const overview = await service.receive([
      {
        id: 'remote-1',
        at: '2026-11-08T13:00:00.000Z',
        kind: 'entry_added',
        entry: {
          kind: 'purchase',
          id: 'other-phone',
          date: '2026-11-06',
          amountNok: 900,
          merchant: 'Kafé',
          placeId: null,
          source: 'wallet',
        },
      },
    ]);

    expect(overview.purchases.map((purchase) => purchase.id)).toEqual(['other-phone']);
    expect(notifier.received).toHaveLength(3);
  });

  it('keeps working when sharing a change fails', async () => {
    const storage = new KeyValueSpendingStorage(new MapKeyValueStorage(), { key: 'spending' });
    const service = spendingService(storage, undefined, new FailingNotifier());

    await expect(service.addPurchase({ date: '2026-11-07', amountNok: 50 })).resolves.toMatchObject(
      { purchases: [{ amountNok: 50 }] },
    );
  });
});

class RecordingNotifier implements SpendingChangeNotifier {
  public readonly received: SpendingChange[] = [];

  public changed(changes: readonly SpendingChange[]): Promise<void> {
    this.received.push(...changes);
    return Promise.resolve();
  }
}

class FailingNotifier implements SpendingChangeNotifier {
  public changed(): Promise<void> {
    return Promise.reject(new Error('disk'));
  }
}
