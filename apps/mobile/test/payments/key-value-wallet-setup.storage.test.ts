import { describe, expect, it } from 'vitest';
import { KeyValueWalletSetupStorage } from '../../src/payments/key-value-wallet-setup.storage';
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

describe('KeyValueWalletSetupStorage', () => {
  it('is new until something is saved', async () => {
    const storage = new KeyValueWalletSetupStorage(new MapKeyValueStorage(), { key: 'wallet' });

    await expect(storage.find()).resolves.toBe('new');
  });

  it.each(['done', 'dismissed'] as const)('keeps %s', async (state) => {
    const storage = new KeyValueWalletSetupStorage(new MapKeyValueStorage(), { key: 'wallet' });

    await storage.save(state);

    await expect(storage.find()).resolves.toBe(state);
  });

  it('is new for an unreadable value', async () => {
    const values = new MapKeyValueStorage();
    await values.setItem('wallet', 'maybe');

    await expect(new KeyValueWalletSetupStorage(values, { key: 'wallet' }).find()).resolves.toBe(
      'new',
    );
  });

  it('is new when the disk fails', async () => {
    await expect(
      new KeyValueWalletSetupStorage(new BrokenStorage(), { key: 'wallet' }).find(),
    ).resolves.toBe('new');
  });
});
