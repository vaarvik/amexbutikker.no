import type { Card, CardReader } from '@amexbutikker/contracts';

/** Cards from a list given at construction, e.g. the catalogue the API ships with. */
export class InMemoryCardReader implements CardReader {
  public constructor(private readonly cards: readonly Card[]) {}

  public list(): Promise<Card[]> {
    return Promise.resolve([...this.cards]);
  }
}
