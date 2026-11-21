import type { Milestone, SpendingChange, SpendingEntry, SpendingState } from './spending.model';
import type { SpendingStateCalculator } from './spending.ports';

/**
 * Replays spending changes. Items are keyed by id: adding one that exists or was removed does
 * nothing, and a removal is remembered in `removedIds` so it stays final. `card_set` replaces the
 * card and its goals and keeps the user's own goals. `purchase_updated` and `member_named`
 * replace what they name (a purchase's corrections only when given); the last one replayed wins.
 */
export class ReplayingSpendingStateCalculator implements SpendingStateCalculator {
  public apply(state: SpendingState, changes: readonly SpendingChange[]): SpendingState {
    return changes.reduce((current, change) => this.applyOne(current, change), state);
  }

  public changesFor(state: SpendingState, at: string): SpendingChange[] {
    const cardGoals = state.milestones.filter((milestone) => milestone.programmeId !== null);
    return [
      ...state.members.map((member) => ({
        id: `snapshot:member:${member.id}`,
        at,
        kind: 'member_named' as const,
        member,
      })),
      ...(state.card === null && cardGoals.length === 0
        ? []
        : [
            {
              id: `snapshot:card:${state.card?.id ?? 'none'}`,
              at,
              kind: 'card_set' as const,
              card: state.card,
              milestones: cardGoals,
            },
          ]),
      ...state.milestones
        .filter((milestone) => milestone.programmeId === null)
        .map((milestone) => ({
          id: `snapshot:milestone:${milestone.id}`,
          at,
          kind: 'milestone_added' as const,
          milestone,
        })),
      ...state.entries.map((entry) => ({
        id: `snapshot:entry:${entry.id}`,
        at,
        kind: 'entry_added' as const,
        entry,
      })),
    ];
  }

  private applyOne(state: SpendingState, change: SpendingChange): SpendingState {
    switch (change.kind) {
      case 'entry_added':
        return this.removed(state, change.entry.id) ||
          state.entries.some((entry) => entry.id === change.entry.id)
          ? state
          : { ...state, entries: [...state.entries, change.entry] };
      case 'entry_removed':
        return {
          ...state,
          entries: state.entries.filter((entry) => entry.id !== change.entryId),
          removedIds: this.remember(state, change.entryId),
        };
      case 'card_set':
        return this.withMilestones({ ...state, card: change.card }, [
          ...change.milestones.filter((milestone) => !this.removed(state, milestone.id)),
          ...state.milestones.filter((milestone) => milestone.programmeId === null),
        ]);
      case 'milestone_added':
        return this.removed(state, change.milestone.id) ||
          state.milestones.some((milestone) => milestone.id === change.milestone.id)
          ? state
          : { ...state, milestones: [...state.milestones, change.milestone] };
      case 'purchase_updated':
        return {
          ...state,
          entries: state.entries.map((entry): SpendingEntry =>
            entry.kind === 'purchase' && entry.id === change.entryId
              ? {
                  ...entry,
                  paidBy: change.paidBy,
                  split: change.split,
                  ...(change.date === undefined ? {} : { date: change.date }),
                  ...(change.amountNok === undefined ? {} : { amountNok: change.amountNok }),
                  ...(change.merchant === undefined ? {} : { merchant: change.merchant }),
                }
              : entry,
          ),
        };
      case 'member_named':
        return {
          ...state,
          members: state.members.some((member) => member.id === change.member.id)
            ? state.members.map((member) =>
                member.id === change.member.id ? change.member : member,
              )
            : [...state.members, change.member],
        };
      case 'milestone_removed':
        return this.withMilestones(
          { ...state, removedIds: this.remember(state, change.milestoneId) },
          state.milestones.filter((milestone) => milestone.id !== change.milestoneId),
        );
    }
  }

  /** Sets the milestones and drops the typed totals of those that are gone. */
  private withMilestones(state: SpendingState, milestones: readonly Milestone[]): SpendingState {
    const ids = new Set(milestones.map((milestone) => milestone.id));
    return {
      ...state,
      milestones,
      entries: state.entries.filter(
        (entry) => entry.kind !== 'total' || ids.has(entry.milestoneId),
      ),
    };
  }

  private removed(state: SpendingState, id: string): boolean {
    return state.removedIds.includes(id);
  }

  private remember(state: SpendingState, id: string): readonly string[] {
    return state.removedIds.includes(id) ? state.removedIds : [...state.removedIds, id];
  }
}
