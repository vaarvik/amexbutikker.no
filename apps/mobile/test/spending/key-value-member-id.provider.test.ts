import { describe, expect, it } from 'vitest';
import { KeyValueMemberIdProvider } from '../../src/spending/key-value-member-id.provider';
import type { KeyValueStorage } from '../../src/shared/shared.ports';
import { MapKeyValueStorage } from '../shared/mobile-test.data';
import { CountingIdGenerator } from './spending-test.data';

class FailingOnceStorage extends MapKeyValueStorage {
  private failed = false;

  public override getItem(key: string): Promise<string | null> {
    if (!this.failed) {
      this.failed = true;
      return Promise.reject(new Error('disk'));
    }
    return super.getItem(key);
  }
}

describe('KeyValueMemberIdProvider', () => {
  it('makes one id and keeps it, also for callers at the same time', async () => {
    const storage = new MapKeyValueStorage();
    const provider = new KeyValueMemberIdProvider(storage, new CountingIdGenerator(), {
      key: 'me',
    });

    const [first, second] = await Promise.all([provider.current(), provider.current()]);
    const later = new KeyValueMemberIdProvider(storage, new CountingIdGenerator(), { key: 'me' });

    expect(first).toBe('id-1');
    expect(second).toBe('id-1');
    await expect(later.current()).resolves.toBe('id-1');
  });

  it('tries again after the storage failed', async () => {
    const storage: KeyValueStorage = new FailingOnceStorage();
    const provider = new KeyValueMemberIdProvider(storage, new CountingIdGenerator(), {
      key: 'me',
    });

    await expect(provider.current()).rejects.toThrow('disk');
    await expect(provider.current()).resolves.toBe('id-1');
  });
});
