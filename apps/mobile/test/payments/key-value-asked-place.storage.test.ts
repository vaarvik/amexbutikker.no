import { describe, expect, it } from 'vitest';
import { KeyValueAskedPlaceStorage } from '../../src/payments/key-value-asked-place.storage';
import type { KeyValueStorage } from '../../src/shared/shared.ports';
import { MapKeyValueStorage, PLACE_ID } from '../shared/mobile-test.data';

class BrokenStorage implements KeyValueStorage {
  public getItem(): Promise<string | null> {
    return Promise.reject(new Error('disk'));
  }

  public setItem(): Promise<void> {
    return Promise.reject(new Error('disk'));
  }

  public removeItem(): Promise<void> {
    return Promise.reject(new Error('disk'));
  }
}

describe('KeyValueAskedPlaceStorage', () => {
  const handled = [{ placeId: PLACE_ID, askedAt: '2026-11-08T12:00:00.000Z' }];

  it('keeps what it saves', async () => {
    const storage = new KeyValueAskedPlaceStorage(new MapKeyValueStorage(), { key: 'asked' });

    await storage.save(handled);

    await expect(storage.list()).resolves.toEqual(handled);
  });

  it('is empty when nothing is stored', async () => {
    const storage = new KeyValueAskedPlaceStorage(new MapKeyValueStorage(), { key: 'asked' });

    await expect(storage.list()).resolves.toEqual([]);
  });

  it.each(['not json', '[{"placeId":"x","askedAt":"2026-11-08T12:00:00.000Z"}]', '{}'])(
    'is empty for an unreadable value %j',
    async (raw) => {
      const values = new MapKeyValueStorage();
      values.values.set('asked', raw);

      await expect(new KeyValueAskedPlaceStorage(values, { key: 'asked' }).list()).resolves.toEqual(
        [],
      );
    },
  );

  it('is empty when the storage fails', async () => {
    await expect(
      new KeyValueAskedPlaceStorage(new BrokenStorage(), { key: 'asked' }).list(),
    ).resolves.toEqual([]);
  });
});
