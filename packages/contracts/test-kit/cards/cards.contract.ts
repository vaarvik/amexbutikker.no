import { describe, expect, it } from 'vitest';
import { CardSchema } from '../../src/index.js';
import type { CardReader } from '../../src/index.js';
import { FixtureHolder } from '../fixture.js';
import type { FixtureFactory } from '../fixture.js';

export interface CardReaderFixture {
  readonly reader: CardReader;
}

/** Behaviour every CardReader must have, whatever cards it holds. */
export function describeCardReaderContract(
  name: string,
  factory: FixtureFactory<CardReaderFixture>,
): void {
  describe(`${name} satisfies CardReader`, () => {
    const fixture = new FixtureHolder(factory);

    it('lists valid cards with unique ids', async () => {
      const cards = await fixture.current.reader.list();

      for (const card of cards) {
        expect(CardSchema.safeParse(card).success).toBe(true);
      }
      expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length);
    });

    it('names a source for every card that has goals', async () => {
      const cards = await fixture.current.reader.list();

      for (const card of cards.filter((item) => item.goals.length > 0)) {
        expect(card.sourceUrl).not.toBeNull();
      }
    });

    it('returns a fresh list each time', async () => {
      const first = await fixture.current.reader.list();
      first.length = 0;

      expect(await fixture.current.reader.list()).toEqual(await fixture.current.reader.list());
    });
  });
}
