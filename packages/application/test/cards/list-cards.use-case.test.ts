import { ListCardsUseCase } from '@amexbutikker/application';
import { InMemoryCardReader } from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

describe('ListCardsUseCase', () => {
  it('lists the cards in their order', async () => {
    const cards = [
      { id: 'b', name: 'B', shortName: 'B', goals: [], sourceUrl: null, fetchedAt: '2026-11-08' },
      { id: 'a', name: 'A', shortName: 'A', goals: [], sourceUrl: null, fetchedAt: '2026-11-08' },
    ];

    await expect(new ListCardsUseCase(new InMemoryCardReader(cards)).execute()).resolves.toEqual({
      cards,
    });
  });
});
