import type { Card } from './cards.model.js';

/** The cards the app knows. */
export interface CardReader {
  /** @returns every card, in the order to show them. */
  list(): Promise<Card[]>;
}
