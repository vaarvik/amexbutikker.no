import type { Milestone, Purchase, SpentTotal } from '../../src/spending/spending.model';
import type { Clock } from '@amexbutikker/contracts';
import { EqualSpendingShareCalculator } from '../../src/spending/equal-spending-share.calculator';
import { CalendarYearSpendingSummarizer } from '../../src/spending/calendar-year-spending.summarizer';
import { NullSpendingChangeNotifier } from '../../src/spending/null-spending-change.notifier';
import { PeriodMilestoneProgressCalculator } from '../../src/spending/period-milestone-progress.calculator';
import { ReplayingSpendingStateCalculator } from '../../src/spending/replaying-spending-state.calculator';
import type {
  IdGenerator,
  LocalDateProvider,
  MemberIdProvider,
  SpendingChangeNotifier,
  SpendingStorage,
} from '../../src/spending/spending.ports';
import { StoredSpendingService } from '../../src/spending/stored-spending.service';

export function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: 'm1',
    title: '2-for-1',
    targetNok: 150_000,
    period: { kind: 'calendar_year' },
    reward: 'En kupong',
    programmeId: null,
    ...overrides,
  };
}

export function purchase(
  date: string,
  amountNok: number,
  id = `p-${date}-${String(amountNok)}`,
): Purchase {
  return {
    kind: 'purchase',
    id,
    date,
    amountNok,
    merchant: null,
    placeId: null,
    source: 'manual',
    paidBy: null,
    split: 'shared',
  };
}

export function total(
  date: string,
  amountNok: number,
  milestoneId = 'm1',
  id = `t-${date}`,
): SpentTotal {
  return { kind: 'total', id, milestoneId, date, amountNok };
}

export class FixedLocalDateProvider implements LocalDateProvider {
  public constructor(public date: string) {}

  public today(): string {
    return this.date;
  }
}

export class CountingIdGenerator implements IdGenerator {
  private count = 0;

  public next(): string {
    this.count += 1;
    return `id-${String(this.count)}`;
  }
}

export class FixedClock implements Clock {
  public constructor(public current = new Date('2026-11-08T12:00:00.000Z')) {}

  public now(): Date {
    return this.current;
  }
}

export class FixedMemberIdProvider implements MemberIdProvider {
  public constructor(public id = 'me') {}

  public current(): Promise<string> {
    return Promise.resolve(this.id);
  }
}

/** A spending service with the real calculators, counting ids and a fixed clock. */
export function spendingService(
  storage: SpendingStorage,
  dates: LocalDateProvider = new FixedLocalDateProvider('2026-11-07'),
  notifier: SpendingChangeNotifier = new NullSpendingChangeNotifier(),
  me: MemberIdProvider = new FixedMemberIdProvider(),
): StoredSpendingService {
  return new StoredSpendingService(
    storage,
    new PeriodMilestoneProgressCalculator(),
    dates,
    new CountingIdGenerator(),
    new CalendarYearSpendingSummarizer(),
    new ReplayingSpendingStateCalculator(),
    notifier,
    new FixedClock(),
    new EqualSpendingShareCalculator(),
    me,
  );
}
