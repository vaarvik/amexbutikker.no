import { describe, expect, it } from 'vitest';
import { KeyValueSpendingStorage } from '../../src/spending/key-value-spending.storage';
import { EMPTY_SPENDING_STATE } from '../../src/spending/spending.model';
import { MapKeyValueStorage } from '../shared/mobile-test.data';
import { milestone, purchase, total } from './spending-test.data';

const config = { key: 'spending' };

describe('KeyValueSpendingStorage', () => {
  it('reads the empty state when nothing is stored', async () => {
    const storage = new KeyValueSpendingStorage(new MapKeyValueStorage(), config);

    await expect(storage.find()).resolves.toEqual(EMPTY_SPENDING_STATE);
  });

  it('reads back what it saved', async () => {
    const storage = new KeyValueSpendingStorage(new MapKeyValueStorage(), config);
    const state = {
      card: { id: 'premium', name: 'SAS EuroBonus Premium', shortName: 'SAS Premium' },
      milestones: [milestone({ period: { kind: 'window', start: '2026-02-07', months: 9 } })],
      entries: [purchase('2026-03-01', 1_200), total('2026-03-02', 5_000)],
      removedIds: ['gone'],
      members: [{ id: 'me', name: 'Johann' }],
    };

    await storage.save(state);

    await expect(storage.find()).resolves.toEqual(state);
  });

  it('reads a document stored before cards were chosen as having no card', async () => {
    const values = new MapKeyValueStorage();
    await values.setItem(config.key, '{"milestones":[],"entries":[]}');

    await expect(new KeyValueSpendingStorage(values, config).find()).resolves.toEqual(
      EMPTY_SPENDING_STATE,
    );
  });

  it.each([['not json'], ['{"milestones":[{"id":1}],"entries":[]}']])(
    'reads an unreadable document (%s) as the empty state',
    async (raw) => {
      const values = new MapKeyValueStorage();
      await values.setItem(config.key, raw);

      await expect(new KeyValueSpendingStorage(values, config).find()).resolves.toEqual(
        EMPTY_SPENDING_STATE,
      );
    },
  );
});
