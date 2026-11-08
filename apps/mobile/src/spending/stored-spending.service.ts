import { CARD_PROGRAMMES } from './spending.model';
import type {
  CardProgramme,
  LocalDate,
  Milestone,
  MilestonePeriod,
  Purchase,
  SpendingState,
} from './spending.model';
import type {
  IdGenerator,
  LocalDateProvider,
  MilestoneProgressCalculator,
  NewMilestone,
  NewPurchase,
  SpendingOverview,
  SpendingService,
  SpendingStorage,
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
    private readonly catalogue: readonly CardProgramme[] = CARD_PROGRAMMES,
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

  public addProgramme(programmeId: string, start?: LocalDate): Promise<SpendingOverview> {
    const programme = this.catalogue.find((candidate) => candidate.id === programmeId);
    if (programme === undefined) {
      return Promise.reject(new Error(`Unknown card programme ${programmeId}.`));
    }
    const milestones: Milestone[] = [];
    for (const preset of programme.milestones) {
      let period: MilestonePeriod = { kind: 'calendar_year' };
      if (preset.period.kind === 'window') {
        if (start === undefined) {
          return Promise.reject(new Error(`${programme.name} needs a start date.`));
        }
        period = { kind: 'window', start, months: preset.period.months };
      }
      milestones.push({
        id: this.ids.next(),
        title: preset.title,
        targetNok: preset.targetNok,
        period,
        reward: preset.reward,
        programmeId: programme.id,
      });
    }
    return this.change((state) => ({ ...state, milestones: [...state.milestones, ...milestones] }));
  }

  public removeMilestone(id: string): Promise<SpendingOverview> {
    return this.change((state) => ({
      milestones: state.milestones.filter((milestone) => milestone.id !== id),
      entries: state.entries.filter((entry) => entry.kind !== 'total' || entry.milestoneId !== id),
    }));
  }

  public programmes(): readonly CardProgramme[] {
    return this.catalogue;
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
    return {
      progress: state.milestones.map((milestone) =>
        this.calculator.calculate(milestone, state.entries, today),
      ),
      // Newest date first; on the same date, the one added last first.
      purchases: state.entries
        .filter((entry): entry is Purchase => entry.kind === 'purchase')
        .reverse()
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
    };
  }
}
