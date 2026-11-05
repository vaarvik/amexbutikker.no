import { describe, expect, it } from 'vitest';
import { KeyValueVisitStateStorage } from '../../src/visits/key-value-visit-state.storage';
import { EMPTY_VISIT_STATE } from '../../src/visits/visits.model';
import { MapKeyValueStorage } from '../shared/mobile-test.data';
import { ASK_ID, enabledState } from './visits-test.data';

const config = { key: 'visit-state' };

describe('KeyValueVisitStateStorage', () => {
  it('reads the empty, disabled state when nothing is stored', async () => {
    const storage = new KeyValueVisitStateStorage(new MapKeyValueStorage(), config);

    await expect(storage.find()).resolves.toEqual(EMPTY_VISIT_STATE);
  });

  it('reads back what it saved', async () => {
    const storage = new KeyValueVisitStateStorage(new MapKeyValueStorage(), config);
    const state = enabledState({
      stays: [{ placeId: ASK_ID, enteredAt: '2026-11-05T12:00:00.000Z', insideMs: 0 }],
    });

    await storage.save(state);

    await expect(storage.find()).resolves.toEqual(state);
  });

  it.each([['not json'], ['{"enabled":"yes"}']])(
    'reads an unreadable document (%s) as the empty state',
    async (raw) => {
      const values = new MapKeyValueStorage();
      await values.setItem(config.key, raw);

      await expect(new KeyValueVisitStateStorage(values, config).find()).resolves.toEqual(
        EMPTY_VISIT_STATE,
      );
    },
  );
});
