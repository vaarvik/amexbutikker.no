import type { Card, Clock } from '@amexbutikker/contracts';
import type {
  LocalDate,
  Milestone,
  Purchase,
  SpendingChange,
  SpendingState,
} from './spending.model';
import { MEMBER_NAME_MAX_LENGTH } from './spending.model';
import type {
  IdGenerator,
  LocalDateProvider,
  MemberIdProvider,
  MilestoneProgressCalculator,
  NewMilestone,
  NewPurchase,
  PurchaseUpdate,
  SpendingOverview,
  SpendingChangeNotifier,
  SpendingService,
  SpendingShareCalculator,
  SpendingStateCalculator,
  SpendingStorage,
  YearSpendingSummarizer,
} from './spending.ports';

/** What a change looks like before it gets its id and time. */
type ChangeBody = SpendingChange extends infer C
  ? C extends SpendingChange
    ? Omit<C, 'id' | 'at'>
    : never
  : never;

/**
 * The Bonus tab over one stored document. Every change is a `SpendingChange`: replayed onto the
 * document, saved, and passed to the listener so a household can share it. The document is small
 * (a few hundred entries).
 */
export class StoredSpendingService implements SpendingService {
  public constructor(
    private readonly storage: SpendingStorage,
    private readonly calculator: MilestoneProgressCalculator,
    private readonly dates: LocalDateProvider,
    private readonly ids: IdGenerator,
    private readonly years: YearSpendingSummarizer,
    private readonly replay: SpendingStateCalculator,
    private readonly notifier: SpendingChangeNotifier,
    private readonly clock: Clock,
    private readonly shares: SpendingShareCalculator,
    private readonly me: MemberIdProvider,
  ) {}

  public async overview(): Promise<SpendingOverview> {
    return this.present(await this.storage.find());
  }

  public async addPurchase(purchase: NewPurchase): Promise<SpendingOverview> {
    await this.recordPurchase(purchase);
    return this.overview();
  }

  public async recordPurchase(purchase: NewPurchase): Promise<Purchase> {
    const added: Purchase = {
      kind: 'purchase',
      id: this.ids.next(),
      date: purchase.date,
      amountNok: purchase.amountNok,
      merchant: purchase.merchant ?? null,
      placeId: purchase.placeId ?? null,
      source: purchase.source ?? 'manual',
      paidBy: await this.me.current(),
      split: purchase.split ?? 'shared',
    };
    await this.change(() => [{ kind: 'entry_added', entry: added }]);
    return added;
  }

  public updateTotal(milestoneId: string, amountNok: number): Promise<SpendingOverview> {
    return this.change(() => [
      {
        kind: 'entry_added',
        entry: {
          kind: 'total',
          id: this.ids.next(),
          milestoneId,
          date: this.dates.today(),
          amountNok,
        },
      },
    ]);
  }

  public removeEntry(id: string): Promise<SpendingOverview> {
    return this.change(() => [{ kind: 'entry_removed', entryId: id }]);
  }

  public updatePurchase(id: string, update: PurchaseUpdate): Promise<SpendingOverview> {
    return this.change(() => [
      {
        kind: 'purchase_updated',
        entryId: id,
        paidBy: update.paidBy,
        split: update.split,
        ...(update.date === undefined ? {} : { date: update.date }),
        ...(update.amountNok === undefined ? {} : { amountNok: update.amountNok }),
        ...(update.merchant === undefined
          ? {}
          : { merchant: update.merchant === null ? null : update.merchant.trim() || null }),
      },
    ]);
  }

  public async nameMe(name: string): Promise<SpendingOverview> {
    const trimmed = name.trim().slice(0, MEMBER_NAME_MAX_LENGTH);
    if (trimmed === '') {
      return this.overview();
    }
    const id = await this.me.current();
    return this.change(() => [{ kind: 'member_named', member: { id, name: trimmed } }]);
  }

  public addMilestone(milestone: NewMilestone): Promise<SpendingOverview> {
    return this.change(() => [
      {
        kind: 'milestone_added',
        milestone: { ...milestone, id: this.ids.next(), programmeId: null },
      },
    ]);
  }

  public setCard(card: Card | null): Promise<SpendingOverview> {
    return this.change((state) => {
      // The same card keeps its goals (and their totals); another card brings its own.
      const kept = state.milestones.filter(
        (milestone) => card !== null && milestone.programmeId === card.id,
      );
      const goals: Milestone[] =
        card === null || kept.length > 0
          ? kept
          : card.goals
              .filter((goal) => goal.period.kind === 'calendar_year')
              .map((goal) => ({
                id: this.ids.next(),
                title: goal.title,
                targetNok: goal.targetNok,
                period: { kind: 'calendar_year' } as const,
                reward: goal.reward,
                programmeId: card.id,
              }));
      return [
        {
          kind: 'card_set',
          card: card === null ? null : { id: card.id, name: card.name, shortName: card.shortName },
          milestones: goals,
        },
      ];
    });
  }

  public removeMilestone(id: string): Promise<SpendingOverview> {
    return this.change(() => [{ kind: 'milestone_removed', milestoneId: id }]);
  }

  public async receive(changes: readonly SpendingChange[]): Promise<SpendingOverview> {
    const next = this.replay.apply(await this.storage.find(), changes);
    await this.storage.save(next);
    return this.present(next);
  }

  public today(): LocalDate {
    return this.dates.today();
  }

  private async change(
    describe: (state: SpendingState) => readonly ChangeBody[],
  ): Promise<SpendingOverview> {
    const state = await this.storage.find();
    const at = this.clock.now().toISOString();
    const changes: SpendingChange[] = describe(state).map((body) => ({
      ...body,
      id: this.ids.next(),
      at,
    }));
    const next = this.replay.apply(state, changes);
    await this.storage.save(next);
    // Sharing must never break the Bonus tab; a household catches up on its next sync.
    await this.notifier.changed(changes).catch(() => undefined);
    return this.present(next);
  }

  private async present(state: SpendingState): Promise<SpendingOverview> {
    const today = this.dates.today();
    const me = await this.me.current();
    const purchases = state.entries
      .filter((entry): entry is Purchase => entry.kind === 'purchase')
      .reverse()
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
    return {
      progress: state.milestones.map((milestone) =>
        this.calculator.calculate(milestone, state.entries, today),
      ),
      // Newest date first; on the same date, the one added last first.
      purchases,
      year: this.years.summarize(purchases, today),
      card: state.card,
      me,
      members: state.members,
      shares: this.shares.calculate(purchases, state.members, me),
    };
  }
}
