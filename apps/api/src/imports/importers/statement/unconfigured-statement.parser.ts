import type { StatementLine } from './statement.model.js';
import type { StatementParser } from './statement.ports.js';

/** Stands in until the first statement format is known; every parse fails with a clear message. */
export class UnconfiguredStatementParser implements StatementParser {
  public parse(): StatementLine[] {
    throw new Error('No statement format is configured yet. Add a StatementParser for the export.');
  }
}
