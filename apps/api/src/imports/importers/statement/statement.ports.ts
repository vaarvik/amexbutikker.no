import type { PlaceId } from '@amexbutikker/contracts';
import type { StatementLine } from './statement.model.js';

/** Reads one statement export format. The first real format comes with an anonymised export. */
export interface StatementParser {
  /** @throws Error when the text is not in this parser's format. */
  parse(text: string): StatementLine[];
}

/** Finds the place a statement descriptor refers to. */
export interface MerchantDescriptorMatcher {
  /** @returns the place, or null when the descriptor should go to manual review. */
  match(descriptor: string): Promise<PlaceId | null>;
}
