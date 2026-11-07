import { describe, expect, it } from 'vitest';
import { PeriodMilestoneProgressCalculator } from '../../src/spending/period-milestone-progress.calculator';
import { milestone, purchase, total } from './spending-test.data';

const calculator = new PeriodMilestoneProgressCalculator();

describe('PeriodMilestoneProgressCalculator', () => {
  it('sums the purchases in the current calendar year and says how much is left', () => {
    const progress = calculator.calculate(
      milestone({ targetNok: 100_000 }),
      [
        purchase('2025-12-31', 50_000),
        purchase('2026-01-01', 10_000),
        purchase('2026-06-30', 20_000),
      ],
      '2026-07-01',
    );

    expect(progress).toMatchObject({
      start: '2026-01-01',
      end: '2026-12-31',
      spentNok: 30_000,
      remainingNok: 70_000,
      daysLeft: 184,
      standing: 'active',
      totalAsOf: null,
    });
    // 70 000 kr over 184 days is about 11 573 kr per average month.
    expect(progress.perMonthNeededNok).toBe(Math.ceil(70_000 / (184 / (365.25 / 12))));
  });

  it('lets the latest typed total stand for everything up to its date', () => {
    const progress = calculator.calculate(
      milestone(),
      [
        purchase('2026-02-01', 5_000),
        total('2026-03-01', 40_000),
        purchase('2026-03-01', 999),
        total('2026-01-15', 1_000),
        purchase('2026-03-02', 2_000),
        total('2026-03-01', 1, 'other-milestone'),
      ],
      '2026-03-10',
    );

    expect(progress).toMatchObject({ spentNok: 42_000, totalAsOf: '2026-03-01' });
  });

  it('takes the total added last when two share a date', () => {
    const progress = calculator.calculate(
      milestone(),
      [total('2026-03-01', 10_000, 'm1', 'a'), total('2026-03-01', 12_000, 'm1', 'b')],
      '2026-03-10',
    );

    expect(progress.spentNok).toBe(12_000);
  });

  it('runs a window from its start for the given months, ending the day before', () => {
    const welcome = milestone({
      targetNok: 90_000,
      period: { kind: 'window', start: '2026-02-07', months: 9 },
    });

    const progress = calculator.calculate(
      welcome,
      [
        purchase('2026-02-06', 50_000),
        purchase('2026-02-07', 30_000),
        purchase('2026-11-06', 1_000),
      ],
      '2026-11-06',
    );

    expect(progress).toMatchObject({
      start: '2026-02-07',
      end: '2026-11-06',
      spentNok: 31_000,
      remainingNok: 59_000,
      daysLeft: 1,
      perMonthNeededNok: 59_000,
      onPace: false,
    });
  });

  it('ends a window from the 31st on the last day of a short month', () => {
    const progress = calculator.calculate(
      milestone({ period: { kind: 'window', start: '2026-01-31', months: 1 } }),
      [],
      '2026-02-01',
    );

    expect(progress.end).toBe('2026-02-27');
  });

  it('is reached as soon as the target is met, with nothing more needed', () => {
    const progress = calculator.calculate(
      milestone({ targetNok: 1_000 }),
      [purchase('2026-01-05', 1_500)],
      '2026-01-10',
    );

    expect(progress).toMatchObject({
      standing: 'reached',
      remainingNok: 0,
      perMonthNeededNok: 0,
      onPace: true,
    });
  });

  it('is missed once the window is over without reaching the target', () => {
    const progress = calculator.calculate(
      milestone({ period: { kind: 'window', start: '2025-01-01', months: 6 } }),
      [purchase('2025-03-01', 1_000)],
      '2026-01-01',
    );

    expect(progress).toMatchObject({ standing: 'missed', daysLeft: 0, onPace: false });
    expect(progress.perMonthNeededNok).toBe(progress.remainingNok);
  });

  it('is upcoming before its window starts, counting the whole window as left', () => {
    const progress = calculator.calculate(
      milestone({ period: { kind: 'window', start: '2026-12-01', months: 1 } }),
      [],
      '2026-11-07',
    );

    expect(progress).toMatchObject({ standing: 'upcoming', daysLeft: 31, onPace: true });
  });

  it('is on pace when the share spent keeps up with the share of the period gone', () => {
    const target = milestone({
      targetNok: 10_000,
      period: { kind: 'window', start: '2026-01-01', months: 1 },
    });
    // Day 10 of 31: 10/31 of 10 000 is about 3 226 kr.
    const behind = calculator.calculate(target, [purchase('2026-01-02', 3_200)], '2026-01-10');
    const ahead = calculator.calculate(target, [purchase('2026-01-02', 3_300)], '2026-01-10');

    expect(behind.onPace).toBe(false);
    expect(ahead.onPace).toBe(true);
  });
});
