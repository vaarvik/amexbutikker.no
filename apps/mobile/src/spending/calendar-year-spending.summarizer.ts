import type { LocalDate, MonthSpending, Purchase, YearSpending } from './spending.model';
import type { YearSpendingSummarizer } from './spending.ports';

/** Purchases from 1 January to today, by month. Typed totals are not counted: they have no month. */
export class CalendarYearSpendingSummarizer implements YearSpendingSummarizer {
  public summarize(purchases: readonly Purchase[], today: LocalDate): YearSpending {
    const year = Number(today.slice(0, 4));
    const currentMonth = Number(today.slice(5, 7));
    const months: number[] = Array.from({ length: currentMonth }, () => 0);
    let count = 0;
    for (const purchase of purchases) {
      if (purchase.date.startsWith(`${String(year)}-`) && purchase.date <= today) {
        const index = Number(purchase.date.slice(5, 7)) - 1;
        months[index] = (months[index] ?? 0) + purchase.amountNok;
        count += 1;
      }
    }
    const byMonth: MonthSpending[] = months.map((nok, index) => ({ month: index + 1, nok }));
    return {
      year,
      spentNok: months.reduce((sum, nok) => sum + nok, 0),
      purchaseCount: count,
      months: byMonth,
    };
  }
}
