import type { PlaceId } from '@amexbutikker/contracts';
import type {
  CardProgramme,
  LocalDate,
  Milestone,
  MilestonePeriod,
  MilestoneProgress,
  Purchase,
  SpendingEntry,
  SpendingState,
} from './spending.model';

/** The Bonus tab's document on the phone. */
export interface SpendingStorage {
  /** The empty state when nothing is stored or the stored value is unreadable. */
  find(): Promise<SpendingState>;
  save(state: SpendingState): Promise<void>;
}

/** Where one milestone stands on `today`. Pure. */
export interface MilestoneProgressCalculator {
  calculate(
    milestone: Milestone,
    entries: readonly SpendingEntry[],
    today: LocalDate,
  ): MilestoneProgress;
}

/** Today's date on the phone. */
export interface LocalDateProvider {
  today(): LocalDate;
}

/** Ids for stored items. Unique on this phone. */
export interface IdGenerator {
  next(): string;
}

export interface NewPurchase {
  readonly date: LocalDate;
  readonly amountNok: number;
  readonly merchant?: string;
  readonly placeId?: PlaceId;
}

export interface NewMilestone {
  readonly title: string;
  readonly targetNok: number;
  readonly period: MilestonePeriod;
  readonly reward: string;
}

/** What the Bonus tab shows. */
export interface SpendingOverview {
  readonly progress: readonly MilestoneProgress[];
  /** Newest first. */
  readonly purchases: readonly Purchase[];
}

/** Everything the Bonus tab does. Every change returns the new overview. */
export interface SpendingService {
  overview(): Promise<SpendingOverview>;
  addPurchase(purchase: NewPurchase): Promise<SpendingOverview>;
  /** Records "spent so far in this milestone's period", as of today. */
  updateTotal(milestoneId: string, amountNok: number): Promise<SpendingOverview>;
  removeEntry(id: string): Promise<SpendingOverview>;
  addMilestone(milestone: NewMilestone): Promise<SpendingOverview>;
  /**
   * Adds every milestone of a preset programme. `start` is required when one of them runs
   * from a start date.
   *
   * @throws Error for an unknown programme or a missing start.
   */
  addProgramme(programmeId: string, start?: LocalDate): Promise<SpendingOverview>;
  /** Removes the milestone and its typed totals. */
  removeMilestone(id: string): Promise<SpendingOverview>;
  programmes(): readonly CardProgramme[];
  /** Today on the phone, the default date for a new purchase. */
  today(): LocalDate;
}

/** Norwegian text for amounts and dates, and parsing what the user types. */
export interface SpendingPresenter {
  /** `150 000 kr`. */
  amount(nok: number): string;
  /** `31. des. 2026`. */
  date(date: LocalDate): string;
  /** `150 000`, `150000`, `1 299,50` → whole kroner; null when it is not a positive amount. */
  parseAmount(text: string): number | null;
  /** `31.12.2026`, `31.12.26`, `2026-12-31` → LocalDate; null when it is not a real date. */
  parseDate(text: string): LocalDate | null;
  /** `31.12.2026`, the form `parseDate` reads. */
  dateInput(date: LocalDate): string;
}
