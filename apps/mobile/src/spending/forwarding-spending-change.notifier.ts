import type { SpendingChange } from './spending.model';
import type { SpendingChangeNotifier } from './spending.ports';

/**
 * Passes changes on to a notifier attached after construction. The household service needs the
 * spending service and the spending service notifies the household service, so the composition
 * root builds this first and attaches the household service once both exist.
 */
export class ForwardingSpendingChangeNotifier implements SpendingChangeNotifier {
  private target: SpendingChangeNotifier | null = null;

  public attach(target: SpendingChangeNotifier): void {
    this.target = target;
  }

  public changed(changes: readonly SpendingChange[]): Promise<void> {
    return this.target === null ? Promise.resolve() : this.target.changed(changes);
  }
}
