import type { Card } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { CachingCardReader } from '../../src/spending/caching-card.reader';
import { FetchCardsApiClient } from '../../src/spending/fetch-cards-api.client';
import type { CardsApiClient } from '../../src/spending/spending.ports';
import { MapKeyValueStorage } from '../shared/mobile-test.data';
import { RecordingTransport } from '../shared/recording.transport';

const CARDS: Card[] = [
  {
    id: 'premium',
    name: 'SAS EuroBonus American Express Premium',
    shortName: 'SAS Amex Premium',
    goals: [{ title: 'Kupong', targetNok: 150_000, period: { kind: 'calendar_year' }, reward: '' }],
    sourceUrl: 'https://example.no/',
    fetchedAt: '2026-11-08',
  },
];

class StubApi implements CardsApiClient {
  public online = true;

  public list(): Promise<readonly Card[]> {
    return this.online ? Promise.resolve(CARDS) : Promise.reject(new Error('offline'));
  }
}

describe('CachingCardReader', () => {
  it('lists the API cards and keeps a copy for when it is offline', async () => {
    const api = new StubApi();
    const catalogue = new CachingCardReader(api, new MapKeyValueStorage(), { key: 'cards' });

    await expect(catalogue.list()).resolves.toEqual(CARDS);
    api.online = false;
    await expect(catalogue.list()).resolves.toEqual(CARDS);
  });

  it('fails offline without a copy, or with an unreadable one', async () => {
    const api = new StubApi();
    api.online = false;
    const storage = new MapKeyValueStorage();

    await expect(new CachingCardReader(api, storage, { key: 'cards' }).list()).rejects.toThrow(
      'offline',
    );
    storage.values.set('cards', 'not json');
    await expect(new CachingCardReader(api, storage, { key: 'cards' }).list()).rejects.toThrow(
      'offline',
    );
  });
});

describe('FetchCardsApiClient', () => {
  it('gets the cards', async () => {
    const transport = new RecordingTransport().answer({ cards: CARDS });

    await expect(new FetchCardsApiClient(transport).list()).resolves.toEqual(CARDS);
    expect(transport.requests).toEqual([{ method: 'GET', path: '/v1/cards' }]);
  });
});
