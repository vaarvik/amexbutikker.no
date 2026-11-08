import { describe, expect, it } from 'vitest';
import { ReplayingSpendingStateCalculator } from '../../src/spending/replaying-spending-state.calculator';
import { EMPTY_SPENDING_STATE } from '../../src/spending/spending.model';
import type { SpendingChange, SpendingState } from '../../src/spending/spending.model';
import { milestone, purchase, total } from './spending-test.data';

const AT = '2026-11-08T12:00:00.000Z';
const calculator = new ReplayingSpendingStateCalculator();
const card = { id: 'premium', name: 'SAS Amex Premium', shortName: 'SAS Premium' };
const goal = milestone({ id: 'g1', programmeId: 'premium' });
const own = milestone({ id: 'o1', title: 'Velkomst' });

let n = 0;
function change(body: Record<string, unknown>): SpendingChange {
  n += 1;
  return { ...body, id: `c${String(n)}`, at: AT } as unknown as SpendingChange;
}

describe('ReplayingSpendingStateCalculator', () => {
  it('adds an entry once, however often it arrives', () => {
    const added = change({ kind: 'entry_added', entry: purchase('2026-11-01', 100, 'p1') });

    expect(calculator.apply(EMPTY_SPENDING_STATE, [added, added]).entries).toEqual([
      purchase('2026-11-01', 100, 'p1'),
    ]);
  });

  it('keeps a removal final, even when the addition arrives again later', () => {
    const state = calculator.apply(EMPTY_SPENDING_STATE, [
      change({ kind: 'entry_added', entry: purchase('2026-11-01', 100, 'p1') }),
      change({ kind: 'entry_removed', entryId: 'p1' }),
      change({ kind: 'entry_removed', entryId: 'p1' }),
      change({ kind: 'entry_added', entry: purchase('2026-11-01', 100, 'p1') }),
    ]);

    expect(state.entries).toEqual([]);
    expect(state.removedIds).toEqual(['p1']);
  });

  it('sets the card and its goals first, keeping the own goals', () => {
    const state = calculator.apply(EMPTY_SPENDING_STATE, [
      change({ kind: 'milestone_added', milestone: own }),
      change({ kind: 'card_set', card, milestones: [goal] }),
    ]);

    expect(state.card).toEqual(card);
    expect(state.milestones).toEqual([goal, own]);
  });

  it('drops the totals of goals a new card replaces', () => {
    const state = calculator.apply(EMPTY_SPENDING_STATE, [
      change({ kind: 'card_set', card, milestones: [goal] }),
      change({ kind: 'entry_added', entry: total('2026-11-01', 5_000, 'g1') }),
      change({ kind: 'entry_added', entry: purchase('2026-11-01', 100, 'p1') }),
      change({ kind: 'card_set', card: null, milestones: [] }),
    ]);

    expect(state.card).toBeNull();
    expect(state.milestones).toEqual([]);
    expect(state.entries).toEqual([purchase('2026-11-01', 100, 'p1')]);
  });

  it('adds a goal once and removes it with its totals for good', () => {
    const added = change({ kind: 'milestone_added', milestone: own });
    const state = calculator.apply(EMPTY_SPENDING_STATE, [
      added,
      added,
      change({ kind: 'entry_added', entry: total('2026-11-01', 5_000, 'o1') }),
      change({ kind: 'milestone_removed', milestoneId: 'o1' }),
      added,
      change({ kind: 'card_set', card, milestones: [goal, own] }),
    ]);

    expect(state.milestones).toEqual([goal]);
    expect(state.entries).toEqual([]);
  });

  it('turns a state into changes that rebuild it', () => {
    const state: SpendingState = {
      card,
      milestones: [goal, own],
      entries: [purchase('2026-11-01', 100, 'p1'), total('2026-11-02', 900, 'g1')],
      removedIds: [],
    };

    const changes = calculator.changesFor(state, AT);

    expect(calculator.apply(EMPTY_SPENDING_STATE, changes)).toEqual(state);
    expect(calculator.changesFor(state, AT)).toEqual(changes);
    expect(changes.every((each) => each.at === AT)).toBe(true);
  });

  it('has nothing to share for an empty state', () => {
    expect(calculator.changesFor(EMPTY_SPENDING_STATE, AT)).toEqual([]);
  });
});
