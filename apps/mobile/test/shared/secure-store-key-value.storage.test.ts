import { describe, expect, it } from 'vitest';
import { SecureStoreKeyValueStorage } from '../../src/shared/secure-store-key-value.storage';
import type { SecureStoreModule } from '../../src/shared/shared.ports';

class FakeSecureStore implements SecureStoreModule {
  public readonly items = new Map<string, string>();

  public getItemAsync(key: string): Promise<string | null> {
    return Promise.resolve(this.items.get(key) ?? null);
  }

  public setItemAsync(key: string, value: string): Promise<void> {
    this.items.set(key, value);
    return Promise.resolve();
  }

  public deleteItemAsync(key: string): Promise<void> {
    this.items.delete(key);
    return Promise.resolve();
  }
}

describe('SecureStoreKeyValueStorage', () => {
  it('stores, reads and removes through SecureStore', async () => {
    const secureStore = new FakeSecureStore();
    const storage = new SecureStoreKeyValueStorage(secureStore);

    await storage.setItem('device-token', 't1');
    expect(secureStore.items.get('device-token')).toBe('t1');
    await expect(storage.getItem('device-token')).resolves.toBe('t1');
    await storage.removeItem('device-token');
    await expect(storage.getItem('device-token')).resolves.toBeNull();
  });
});
