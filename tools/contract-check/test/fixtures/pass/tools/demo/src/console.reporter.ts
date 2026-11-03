export interface Reporter {
  report(lines: readonly string[]): void;
}

export class ConsoleReporter implements Reporter {
  public report(lines: readonly string[]): void {
    void lines;
  }
}
