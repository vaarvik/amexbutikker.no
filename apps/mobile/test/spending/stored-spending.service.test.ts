import type { PlaceId } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { KeyValueSpendingStorage } from '../../src/spending/key-value-spending.storage';
import { PeriodMilestoneProgressCalculator } from '../../src/spending/period-milestone-progress.calculator';
import type { CardProgramme } from '../../src/spending/spending.model';
import { CARD_PROGRAMMES } from '../../src/spending/spending.model';
import { StoredSpendingService } from '../../src/spending/stored-spending.service';
import { MapKeyValueStorage } from '../shared/mobile-test.data';
import { CountingIdGenerator, FixedLocalDateProvider } from './spending-test.data';

const programmes: CardProgramme[] = [
  {
    id: 'card',
    name: 'Kortet',
    milestones: [
      { title: 'Årlig', targetNok: 100_000, period: { kind: 'calendar_year' }, reward: 'Kupong' },
      {
        title: 'Velkomst',
        targetNok: 90_000,
        period: { kind: 'window', months: 9 },
        reward: 'Poeng',
      },
    ],
    sourceUrl: 'https://example.no/vilkar',
    fetchedAt: '2026-11-06',
  },
  {
    id: 'yearly',
    name: 'Bare årlig',
    milestones: [
      { title: 'Årlig', targetNok: 50_000, period: { kind: 'calendar_year' }, reward: 'Kupong' },
    ],
    sourceUrl: 'https://example.no/',
    fetchedAt: '2026-11-06',
  },
];

function setup() {
  const dates = new FixedLocalDateProvider('2026-11-07');
  const storage = new KeyValueSpendingStorage(new MapKeyValueStorage(), { key: 'spending' });
  const service = new StoredSpendingService(
    storage,
    new PeriodMilestoneProgressCalculator(),
    dates,
    new CountingIdGenerator(),
    programmes,
  );
  return { service, storage, dates };
}

describe('StoredSpendingService', () => {
  it('starts empty and uses the built-in programmes by default', async () => {
    const { storage } = setup();
    const service = new StoredSpendingService(
      storage,
      new PeriodMilestoneProgressCalculator(),
      new FixedLocalDateProvider('2026-11-07'),
      new CountingIdGenerator(),
    );

    await expect(service.overview()).resolves.toEqual({ progress: [], purchases: [] });
    expect(service.programmes()).toBe(CARD_PROGRAMMES);
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

  it('adds a programme with its start date on the window milestones', async () => {
    const { service } = setup();

    const overview = await service.addProgramme('card', '2026-02-07');

    expect(overview.progress.map((progress) => progress.milestone)).toEqual([
      expect.objectContaining({
        title: 'Årlig',
        period: { kind: 'calendar_year' },
        programmeId: 'card',
      }),
      expect.objectContaining({
        title: 'Velkomst',
        period: { kind: 'window', start: '2026-02-07', months: 9 },
        programmeId: 'card',
      }),
    ]);
  });

  it('adds a calendar-year programme without a start date', async () => {
    const { service } = setup();

    await expect(service.addProgramme('yearly')).resolves.toMatchObject({
      progress: [{ milestone: { targetNok: 50_000 } }],
    });
  });

  it('refuses an unknown programme, or a window programme without a start date', async () => {
    const { service, storage } = setup();

    await expect(service.addProgramme('nope')).rejects.toThrow('Unknown card programme');
    await expect(service.addProgramme('card')).rejects.toThrow('needs a start date');
    expect((await storage.find()).milestones).toEqual([]);
  });
});
