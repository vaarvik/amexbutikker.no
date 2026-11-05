import type { AcceptanceStatus } from '@amexbutikker/contracts';

/**
 * How a status is shown. The answer and label are always rendered as text, and the symbol
 * differs per status, so the status never depends on colour alone.
 */
export interface StatusView {
  readonly status: AcceptanceStatus;
  /** The one-word answer: Ja, Nei, Varierer, Ikke sjekket. */
  readonly answer: string;
  /** A short explanation of the answer, e.g. "Tar Amex". */
  readonly label: string;
  /** ✓ ✕ ± ? */
  readonly symbol: string;
}
