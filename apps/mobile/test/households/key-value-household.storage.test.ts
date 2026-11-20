import { describe, expect, it } from 'vitest';
import { KeyValueHouseholdStorage } from '../../src/households/key-value-household.storage';
import type { StoredHousehold } from '../../src/households/households.model';
import type { KeyValueStorage } from '../../src/shared/shared.ports';
import { MapKeyValueStorage } from '../shared/mobile-test.data';
import { HOUSEHOLD_ID } from './household-test.data';

const household: StoredHousehold = {
  invite: { householdId: HOUSEHOLD_ID, key: 'A'.repeat(42) + 'Q' },
  cursor: 4,
  pending: [{ id: 'c1', at: '2026-11-08T12:00:00.000Z', kind: 'entry_removed', entryId: 'p1' }],
  memberCount: 2,
  syncedAt: '2026-11-08T12:00:00.000Z',
};

class BrokenStorage implements KeyValueStorage {
  public getItem(): Promise<string | null> {
    return Promise.reject(new Error('keychain'));
  }

  public setItem(): Promise<void> {
    return Promise.reject(new Error('keychain'));
  }

  public removeItem(): Promise<void> {
    return Promise.reject(new Error('keychain'));
  }
}

function setup() {
  const secure = new MapKeyValueStorage();
  const plain = new MapKeyValueStorage();
  return { secure, plain, storage: new KeyValueHouseholdStorage(secure, plain, { key: 'h' }) };
}

describe('KeyValueHouseholdStorage', () => {
  it('keeps the key in secure storage and the rest in plain storage', async () => {
    const { secure, plain, storage } = setup();

    await storage.save(household);

    await expect(storage.find()).resolves.toEqual(household);
    expect(secure.values.get('h')).toContain(household.invite.key);
    expect(plain.values.get('h:progress')).not.toContain(household.invite.key);
  });

  it('keeps both apart when secure and plain storage are one (localStorage on the web)', async () => {
    const shared = new MapKeyValueStorage();
    const storage = new KeyValueHouseholdStorage(shared, shared, { key: 'h' });

    await storage.save(household);

    await expect(storage.find()).resolves.toEqual(household);
  });

  it('forgets the household', async () => {
    const { secure, plain, storage } = setup();
    await storage.save(household);

    await storage.save(null);

    await expect(storage.find()).resolves.toBeNull();
    expect(secure.values.size + plain.values.size).toBe(0);
  });

  it('is in none when nothing or something unreadable is stored', async () => {
    const { secure, storage } = setup();
    await expect(storage.find()).resolves.toBeNull();

    secure.values.set('h', '{"householdId":"x"}');
    await expect(storage.find()).resolves.toBeNull();

    secure.values.set('h', 'not json');
    await expect(storage.find()).resolves.toBeNull();

    await expect(
      new KeyValueHouseholdStorage(new BrokenStorage(), new MapKeyValueStorage(), {
        key: 'h',
      }).find(),
    ).resolves.toBeNull();
  });

  it('starts over from the beginning when the progress is lost', async () => {
    const { plain, storage } = setup();
    await storage.save(household);
    plain.values.delete('h:progress');

    await expect(storage.find()).resolves.toEqual({
      invite: household.invite,
      cursor: 0,
      pending: [],
      memberCount: 1,
      syncedAt: null,
    });
  });
});
