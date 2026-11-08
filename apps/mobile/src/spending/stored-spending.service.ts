import type { Card } from '@amexbutikker/contracts';
import type { LocalDate, Milestone, Purchase, SpendingState } from './spending.model';
import type {
  IdGenerator,
  LocalDateProvider,
  MilestoneProgressCalculator,
  NewMilestone,
  NewPurchase,
  SpendingOverview,
  SpendingService,
  SpendingStorage,
  YearSpendingSummarizer,
} from './spending.ports';

/**
 * The Bonus tab over one stored document. Every change reads, changes and saves the whole
 * document; it is small (a few hundred entries) and only this screen writes it.
 */
export class StoredSpendingService implements SpendingService {
  public constructor(
    private readonly storage: SpendingStorage,
    private readonly calculator: MilestoneProgressCalculator,
    private readonly dates: LocalDateProvider,
    private readonly ids: IdGenerator,
    private readonly years: YearSpendingSummarizer,
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
    };
    await this.change((state) => ({ ...state, entries: [...state.entries, added] }));
    return added;
  }

  public updateTotal(milestoneId: string, amountNok: number): Promise<SpendingOverview> {
    return this.change((state) => ({
      ...state,
      entries: [
        ...state.entries,
        { kind: 'total', id: this.ids.next(), milestoneId, date: this.dates.today(), amountNok },
      ],
    }));
  }

  public removeEntry(id: string): Promise<SpendingOverview> {
    return this.change((state) => ({
      ...state,
      entries: state.entries.filter((entry) => entry.id !== id),
    }));
  }

  public addMilestone(milestone: NewMilestone): Promise<SpendingOverview> {
    return this.change((state) => ({
      ...state,
      milestones: [...state.milestones, { ...milestone, id: this.ids.next(), programmeId: null }],
    }));
  }

  public setCard(card: Card | null): Promise<SpendingOverview> {
    return this.change((state) => {
      // Goals of the card chosen before go; the chosen card's own goals stay, with their totals.
      const previous = state.card?.id === card?.id ? null : (state.card?.id ?? null);
      const removed = new Set(
        state.milestones
          .filter((milestone) => previous !== null && milestone.programmeId === previous)
          .map((milestone) => milestone.id),
      );
      const kept = state.milestones.filter((milestone) => !removed.has(milestone.id));
      const added: Milestone[] =
        card === null || kept.some((milestone) => milestone.programmeId === card.id)
          ? []
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
      return {
        card: card === null ? null : { id: card.id, name: card.name, shortName: card.shortName },
        // The card's goals first: they are what the Bonus tab is about.
        milestones: [...added, ...kept],
        entries: state.entries.filter(
          (entry) => entry.kind !== 'total' || !removed.has(entry.milestoneId),
        ),
      };
    });
  }

  public removeMilestone(id: string): Promise<SpendingOverview> {
    return this.change((state) => ({
      ...state,
      milestones: state.milestones.filter((milestone) => milestone.id !== id),
      entries: state.entries.filter((entry) => entry.kind !== 'total' || entry.milestoneId !== id),
    }));
  }

  public today(): LocalDate {
    return this.dates.today();
  }

  private async change(apply: (state: SpendingState) => SpendingState): Promise<SpendingOverview> {
    const next = apply(await this.storage.find());
    await this.storage.save(next);
    return this.present(next);
  }

  private present(state: SpendingState): SpendingOverview {
    const today = this.dates.today();
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
    };
  }
}
