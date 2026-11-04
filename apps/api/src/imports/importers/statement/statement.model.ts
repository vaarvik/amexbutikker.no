/** One purchase line from a card statement, as much as matching needs. */
export interface StatementLine {
  /** UTC date the purchase was posted. */
  readonly postedOn: Date;
  /** The merchant text on the statement, e.g. `REMA 1000 GRONLAND OSLO`. */
  readonly descriptor: string;
}
