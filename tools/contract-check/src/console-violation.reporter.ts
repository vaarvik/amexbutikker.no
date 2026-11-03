import type { Violation } from './violation.model.js';

/** Presents violations to whoever ran the check. */
export interface ViolationReporter {
  report(violations: readonly Violation[]): void;
}

export class ConsoleViolationReporter implements ViolationReporter {
  public report(violations: readonly Violation[]): void {
    if (violations.length === 0) {
      console.log('contract-check: no violations.');
      return;
    }
    for (const violation of violations) {
      console.error(
        `${violation.file}:${String(violation.line)}  ${violation.ruleId}  ${violation.message}`,
      );
    }
    console.error(`\ncontract-check: ${String(violations.length)} violation(s).`);
  }
}
