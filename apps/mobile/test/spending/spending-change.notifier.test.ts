import { describe, expect, it } from 'vitest';
import { ForwardingSpendingChangeNotifier } from '../../src/spending/forwarding-spending-change.notifier';
import { NullSpendingChangeNotifier } from '../../src/spending/null-spending-change.notifier';
import type { SpendingChange } from '../../src/spending/spending.model';
import type { SpendingChangeNotifier } from '../../src/spending/spending.ports';

class RecordingNotifier implements SpendingChangeNotifier {
  public readonly received: SpendingChange[][] = [];

  public changed(changes: readonly SpendingChange[]): Promise<void> {
    this.received.push([...changes]);
    return Promise.resolve();
  }
}

const removed: SpendingChange = {
  id: 'c1',
  at: '2026-11-08T12:00:00.000Z',
  kind: 'entry_removed',
  entryId: 'p1',
};

describe('ForwardingSpendingChangeNotifier', () => {
  it('drops changes until a target is attached, then passes them on', async () => {
    const forwarding = new ForwardingSpendingChangeNotifier();
    const target = new RecordingNotifier();

    await forwarding.changed([removed]);
    forwarding.attach(target);
    await forwarding.changed([removed]);

    expect(target.received).toEqual([[removed]]);
  });
});

describe('NullSpendingChangeNotifier', () => {
  it('accepts changes and does nothing', async () => {
    const notifier: SpendingChangeNotifier = new NullSpendingChangeNotifier();
    await expect(notifier.changed([removed])).resolves.toBeUndefined();
  });
});
