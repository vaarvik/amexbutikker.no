import type { Milestone, Purchase, SpentTotal } from '../../src/spending/spending.model';
import type { IdGenerator, LocalDateProvider } from '../../src/spending/spending.ports';

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
  return { kind: 'purchase', id, date, amountNok, merchant: null, placeId: null, source: 'manual' };
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
