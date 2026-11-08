import { describeCardReaderContract } from '@amexbutikker/contracts/test-kit';
import { ListCardsUseCase } from '@amexbutikker/application';
import { InMemoryCardReader } from '@amexbutikker/in-memory';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { CardsController } from '../../src/cards/cards.controller.js';
import { CARD_CATALOGUE } from '../../src/cards/cards.model.js';

describeCardReaderContract('The card catalogue', () =>
  Promise.resolve({ reader: new InMemoryCardReader(CARD_CATALOGUE) }),
);

describe('CardsController', () => {
  it('lists the cards, cacheable for an hour', async () => {
    const app = Fastify();
    new CardsController(new ListCardsUseCase(new InMemoryCardReader(CARD_CATALOGUE))).register(app);

    const response = await app.inject({ method: 'GET', url: '/v1/cards' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=3600');
    const { cards } = response.json<{ cards: { id: string; goals: unknown[] }[] }>();
    expect(cards.map((card) => card.id)).toContain('sas-eurobonus-amex-premium');
    expect(cards.find((card) => card.id === 'sas-eurobonus-amex-premium')?.goals).toHaveLength(1);
    await app.close();
  });
});
