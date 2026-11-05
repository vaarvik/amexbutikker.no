import { describe, expect, it } from 'vitest';
import { LocalStorageKeyValueStorage } from '../../src/shared/local-storage-key-value.storage';
import type { WebStorage } from '../../src/shared/shared.ports';

class MapWebStorage implements WebStorage {
  public readonly items = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  public removeItem(key: string): void {
    this.items.delete(key);
  }
}

describe('LocalStorageKeyValueStorage', () => {
  it('stores, reads and removes through localStorage', async () => {
    const web = new MapWebStorage();
    const storage = new LocalStorageKeyValueStorage(web);

    await storage.setItem('device-token', 't1');
    expect(web.items.get('device-token')).toBe('t1');
    await expect(storage.getItem('device-token')).resolves.toBe('t1');
    await storage.removeItem('device-token');
    await expect(storage.getItem('device-token')).resolves.toBeNull();
  });

  it('keeps nothing where there is no localStorage', async () => {
    const storage = new LocalStorageKeyValueStorage(undefined);

    await storage.setItem('device-token', 't1');
    await storage.removeItem('device-token');
    await expect(storage.getItem('device-token')).resolves.toBeNull();
  });
});
