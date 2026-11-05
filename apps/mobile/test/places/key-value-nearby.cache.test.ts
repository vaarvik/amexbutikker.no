import { beforeEach, describe, expect, it } from 'vitest';
import { KeyValueNearbyCache } from '../../src/places/key-value-nearby.cache';
import type { NearbySnapshot } from '../../src/places/places.model';
import { MapKeyValueStorage, summary } from '../shared/mobile-test.data';

const snapshot: NearbySnapshot = {
  center: { lat: 59.91, lng: 10.75 },
  fetchedAt: '2026-11-05T10:00:00.000Z',
  results: [summary()],
};

describe('KeyValueNearbyCache', () => {
  let storage: MapKeyValueStorage;
  let cache: KeyValueNearbyCache;

  beforeEach(() => {
    storage = new MapKeyValueStorage();
    cache = new KeyValueNearbyCache(storage, { key: 'nearby' });
  });

  it('returns null when nothing is stored', async () => {
    await expect(cache.find()).resolves.toBeNull();
  });

  it('returns what it saved', async () => {
    await cache.save(snapshot);

    await expect(cache.find()).resolves.toEqual(snapshot);
  });

  it.each([
    ['not JSON', '{oops'],
    ['an old or foreign shape', JSON.stringify({ center: 'here', results: [] })],
  ])('treats %s as nothing stored', async (_case, raw) => {
    storage.values.set('nearby', raw);

    await expect(cache.find()).resolves.toBeNull();
  });
});
