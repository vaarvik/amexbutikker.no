import type { CardReader, ListCards, ListCardsOutput } from '@amexbutikker/contracts';

export class ListCardsUseCase implements ListCards {
  public constructor(private readonly cards: CardReader) {}

  public async execute(): Promise<ListCardsOutput> {
    return { cards: await this.cards.list() };
  }
}
