import type {
  LocalDate,
  Milestone,
  MilestoneProgress,
  MilestoneStanding,
  SpendingEntry,
  SpentTotal,
} from './spending.model';
import type { MilestoneProgressCalculator } from './spending.ports';

const DAY_MS = 86_400_000;
/** "Per month" means per average month: 365.25 / 12 days. */
const DAYS_PER_MONTH = 365.25 / 12;

/**
 * Counts the spending inside a milestone's period. The latest typed total in the period stands
 * for everything up to its date; purchases after that date are added on top. Without a total,
 * the purchases in the period are summed. Dates are compared as calendar days, so time zones
 * and daylight saving never move a purchase into another day.
 */
export class PeriodMilestoneProgressCalculator implements MilestoneProgressCalculator {
  public calculate(
    milestone: Milestone,
    entries: readonly SpendingEntry[],
    today: LocalDate,
  ): MilestoneProgress {
    const { start, end } = this.bounds(milestone, today);
    const inPeriod = (date: LocalDate) => date >= start && date <= end;

    let total: SpentTotal | null = null;
    for (const entry of entries) {
      if (entry.kind === 'total' && entry.milestoneId === milestone.id && inPeriod(entry.date)) {
        // Later dates win; on the same date, the one added last wins.
        if (total === null || entry.date >= total.date) total = entry;
      }
    }
    const purchases = entries.filter(
      (entry) =>
        entry.kind === 'purchase' &&
        inPeriod(entry.date) &&
        (total === null || entry.date > total.date),
    );
    const spentNok =
      (total?.amountNok ?? 0) + purchases.reduce((sum, entry) => sum + entry.amountNok, 0);

    const remainingNok = Math.max(0, milestone.targetNok - spentNok);
    const standing: MilestoneStanding =
      remainingNok === 0
        ? 'reached'
        : today < start
          ? 'upcoming'
          : today > end
            ? 'missed'
            : 'active';
    const daysLeft = today > end ? 0 : this.days(today < start ? start : today, end) + 1;
    const perMonthNeededNok =
      remainingNok === 0
        ? 0
        : daysLeft === 0
          ? remainingNok
          : Math.ceil(remainingNok / Math.max(1, daysLeft / DAYS_PER_MONTH));

    return {
      milestone,
      start,
      end,
      spentNok,
      remainingNok,
      daysLeft,
      perMonthNeededNok,
      onPace: this.onPace(standing, milestone.targetNok, spentNok, start, end, today),
      standing,
      totalAsOf: total?.date ?? null,
    };
  }

  private onPace(
    standing: MilestoneStanding,
    targetNok: number,
    spentNok: number,
    start: LocalDate,
    end: LocalDate,
    today: LocalDate,
  ): boolean {
    switch (standing) {
      case 'reached':
      case 'upcoming':
        return true;
      case 'missed':
        return false;
      case 'active': {
        const share = (this.days(start, today) + 1) / (this.days(start, end) + 1);
        return spentNok >= targetNok * share;
      }
    }
  }

  private bounds(milestone: Milestone, today: LocalDate): { start: LocalDate; end: LocalDate } {
    const period = milestone.period;
    if (period.kind === 'calendar_year') {
      const year = today.slice(0, 4);
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
    const end = this.addDays(this.addMonths(period.start, period.months), -1);
    return { start: period.start, end };
  }

  /** Whole days from `from` to `to`; negative when `to` is earlier. */
  private days(from: LocalDate, to: LocalDate): number {
    return Math.round((this.utc(to) - this.utc(from)) / DAY_MS);
  }

  /** 31 Jan + 1 month is the last day of February, not 3 March. */
  private addMonths(date: LocalDate, months: number): LocalDate {
    const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  }

  private addDays(date: LocalDate, days: number): LocalDate {
    return new Date(this.utc(date) + days * DAY_MS).toISOString().slice(0, 10);
  }

  private utc(date: LocalDate): number {
    return Date.parse(`${date}T00:00:00Z`);
  }
}
