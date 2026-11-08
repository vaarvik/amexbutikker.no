import type { SpendingChangeNotifier } from './spending.ports';

/** Drops changes: for tests, and until the household service is attached. */
export class NullSpendingChangeNotifier implements SpendingChangeNotifier {
  public changed(): Promise<void> {
    return Promise.resolve();
  }
}
