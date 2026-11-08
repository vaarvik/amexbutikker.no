import type { Card } from './cards.model.js';

export interface ListCardsOutput {
  readonly cards: readonly Card[];
}

/** The cards a user can choose, with their spending goals. */
export interface ListCards {
  execute(): Promise<ListCardsOutput>;
}
