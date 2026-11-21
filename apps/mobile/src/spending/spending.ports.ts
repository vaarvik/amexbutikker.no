import type { Card, PlaceId } from '@amexbutikker/contracts';
import type {
  ChosenCard,
  LocalDate,
  Milestone,
  MilestonePeriod,
  MilestoneProgress,
  Purchase,
  PurchaseSplit,
  SpendingChange,
  SpendingEntry,
  SpendingMember,
  SpendingShares,
  SpendingSource,
  SpendingState,
  YearSpending,
} from './spending.model';

/** The Bonus tab's document on the phone. */
export interface SpendingStorage {
  /** The empty state when nothing is stored or the stored value is unreadable. */
  find(): Promise<SpendingState>;
  save(state: SpendingState): Promise<void>;
}

/**
 * Applies changes to a state. Pure and idempotent: the same changes in the same order give the
 * same state, and a change applied twice does nothing. The household's phones all use it.
 */
export interface SpendingStateCalculator {
  apply(state: SpendingState, changes: readonly SpendingChange[]): SpendingState;
  /**
   * The changes that rebuild `state` from empty, to share what a phone had before joining. Their
   * ids derive from the items, so the same state gives the same changes.
   */
  changesFor(state: SpendingState, at: string): SpendingChange[];
}

/**
 * Told about every change made to spending on this phone, to share it. The household service is
 * one; a phone in no household drops them.
 */
export interface SpendingChangeNotifier {
  changed(changes: readonly SpendingChange[]): Promise<void>;
}

/** Where one milestone stands on `today`. Pure. */
export interface MilestoneProgressCalculator {
  calculate(
    milestone: Milestone,
    entries: readonly SpendingEntry[],
    today: LocalDate,
  ): MilestoneProgress;
}

/** This year's purchases, month by month. Pure. */
export interface YearSpendingSummarizer {
  summarize(purchases: readonly Purchase[], today: LocalDate): YearSpending;
}

/** How purchases split between a household's members. Pure. */
export interface SpendingShareCalculator {
  /**
   * Splits between this phone (`me`) and everyone who paid something. Named members who paid
   * nothing, such as phones that left the household, are left out.
   *
   * @param members names the people; it does not decide who takes part.
   * @returns null with fewer than two people: there is nothing to split.
   */
  calculate(
    purchases: readonly Purchase[],
    members: readonly SpendingMember[],
    me: string,
  ): SpendingShares | null;
}

/** This phone's member id: random, made once and kept on the phone. */
export interface MemberIdProvider {
  current(): Promise<string>;
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
  /** Defaults to `manual`. */
  readonly source?: SpendingSource;
  /** Defaults to `shared`. Paid by this phone's member. */
  readonly split?: PurchaseSplit;
}

/** A change to who paid a purchase and whom it is for. */
export interface PurchaseUpdate {
  readonly paidBy: string | null;
  readonly split: PurchaseSplit;
  /** Corrections; left out, the purchase keeps what it has. */
  readonly date?: LocalDate;
  readonly amountNok?: number;
  /** Null removes the place. */
  readonly merchant?: string | null;
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
  /** Registered purchases this calendar year. */
  readonly year: YearSpending;
  /** The card the user has chosen; null until then. */
  readonly card: ChosenCard | null;
  /** This phone's member id. */
  readonly me: string;
  /** The household's named members, this phone's included once it is named. */
  readonly members: readonly SpendingMember[];
  /** Null with fewer than two members. */
  readonly shares: SpendingShares | null;
}

/** Everything the Bonus tab does. Every change returns the new overview. */
export interface SpendingService {
  overview(): Promise<SpendingOverview>;
  addPurchase(purchase: NewPurchase): Promise<SpendingOverview>;
  /** Adds a purchase like `addPurchase`, and returns it, with its id, instead of the overview. */
  recordPurchase(purchase: NewPurchase): Promise<Purchase>;
  /** Records "spent so far in this milestone's period", as of today. */
  updateTotal(milestoneId: string, amountNok: number): Promise<SpendingOverview>;
  removeEntry(id: string): Promise<SpendingOverview>;
  /** Changes who paid a purchase and whom it is for, and corrects its amount, date or place. */
  updatePurchase(id: string, update: PurchaseUpdate): Promise<SpendingOverview>;
  /** Names this phone's member, as the other phones in the household see it. */
  nameMe(name: string): Promise<SpendingOverview>;
  addMilestone(milestone: NewMilestone): Promise<SpendingOverview>;
  /**
   * Chooses the user's card (null: none). Its yearly goals are added; goals of a card chosen
   * before are removed with their typed totals. Choosing the same card again keeps them.
   */
  setCard(card: Card | null): Promise<SpendingOverview>;
  /** Removes the milestone and its typed totals. */
  removeMilestone(id: string): Promise<SpendingOverview>;
  /**
   * Merges changes from the other phones in the household. They are not passed on to the
   * notifier again.
   */
  receive(changes: readonly SpendingChange[]): Promise<SpendingOverview>;
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

/** `GET /v1/cards`. */
export interface CardsApiClient {
  list(): Promise<readonly Card[]>;
}
