import { describe, expect, it } from 'vitest';
import { CalendarYearSpendingSummarizer } from '../../src/spending/calendar-year-spending.summarizer';
import { purchase } from './spending-test.data';

describe('CalendarYearSpendingSummarizer', () => {
  const summarizer = new CalendarYearSpendingSummarizer();

  it('sums this year month by month, up to the current month', () => {
    const year = summarizer.summarize(
      [
        purchase('2026-01-05', 100),
        purchase('2026-01-31', 50),
        purchase('2026-03-10', 1_000),
        purchase('2025-12-31', 9_999),
        purchase('2026-12-01', 7),
      ],
      '2026-03-15',
    );

    expect(year).toEqual({
      year: 2026,
      spentNok: 1_150,
      purchaseCount: 3,
      months: [
        { month: 1, nok: 150 },
        { month: 2, nok: 0 },
        { month: 3, nok: 1_000 },
      ],
    });
  });

  it('is empty in January without purchases', () => {
    expect(summarizer.summarize([], '2026-01-01')).toEqual({
      year: 2026,
      spentNok: 0,
      purchaseCount: 0,
      months: [{ month: 1, nok: 0 }],
    });
  });

  it('leaves out purchases dated after today', () => {
    expect(summarizer.summarize([purchase('2026-03-16', 5)], '2026-03-15').purchaseCount).toBe(0);
  });
});
