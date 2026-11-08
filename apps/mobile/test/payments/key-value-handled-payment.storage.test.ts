import { describe, expect, it } from 'vitest';
import { KeyValueHandledPaymentStorage } from '../../src/payments/key-value-handled-payment.storage';
import type { KeyValueStorage } from '../../src/shared/shared.ports';
import { MapKeyValueStorage } from '../shared/mobile-test.data';

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

describe('KeyValueHandledPaymentStorage', () => {
  const handled = [{ key: 'kafé|49', handledAt: '2026-11-08T12:00:00.000Z' }];

  it('keeps what it saves', async () => {
    const storage = new KeyValueHandledPaymentStorage(new MapKeyValueStorage(), { key: 'paid' });

    await storage.save(handled);

    await expect(storage.list()).resolves.toEqual(handled);
  });

  it('is empty when nothing is stored', async () => {
    const storage = new KeyValueHandledPaymentStorage(new MapKeyValueStorage(), { key: 'paid' });

    await expect(storage.list()).resolves.toEqual([]);
  });

  it.each(['not json', '[{"key":""}]', '{}'])(
    'is empty for an unreadable value %j',
    async (raw) => {
      const values = new MapKeyValueStorage();
      values.values.set('paid', raw);

      await expect(
        new KeyValueHandledPaymentStorage(values, { key: 'paid' }).list(),
      ).resolves.toEqual([]);
    },
  );

  it('is empty when the storage fails', async () => {
    await expect(
      new KeyValueHandledPaymentStorage(new BrokenStorage(), { key: 'paid' }).list(),
    ).resolves.toEqual([]);
  });
});
