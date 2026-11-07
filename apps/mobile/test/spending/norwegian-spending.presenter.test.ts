import { describe, expect, it } from 'vitest';
import { NorwegianSpendingPresenter } from '../../src/spending/norwegian-spending.presenter';

const presenter = new NorwegianSpendingPresenter();

describe('NorwegianSpendingPresenter', () => {
  it.each([
    [0, '0 kr'],
    [999, '999 kr'],
    [150_000, '150 000 kr'],
    [1_234_567, '1 234 567 kr'],
    [-2_500, '−2 500 kr'],
  ])('writes %d as %s', (nok, text) => {
    expect(presenter.amount(nok)).toBe(text);
  });

  it('writes dates with a short Norwegian month', () => {
    expect(presenter.date('2026-12-31')).toBe('31. des. 2026');
    expect(presenter.date('2026-05-01')).toBe('1. mai 2026');
  });

  it.each([
    ['150 000', 150_000],
    ['150000', 150_000],
    ['150.000', 150_000],
    ['1 299,50', 1_300],
    ['89,4', 89],
    ['2 500 kr', 2_500],
  ])('reads the amount %s', (text, nok) => {
    expect(presenter.parseAmount(text)).toBe(nok);
  });

  it.each([[''], ['abc'], ['0'], ['-5'], ['1,234,5']])('rejects the amount "%s"', (text) => {
    expect(presenter.parseAmount(text)).toBeNull();
  });

  it.each([
    ['31.12.2026', '2026-12-31'],
    ['1.2.26', '2026-02-01'],
    ['2026-02-28', '2026-02-28'],
    [' 07.11.2026 ', '2026-11-07'],
  ])('reads the date %s', (text, date) => {
    expect(presenter.parseDate(text)).toBe(date);
  });

  it.each([['31.02.2026'], ['13.13.2026'], ['1.1.1999'], ['i går'], ['']])(
    'rejects the date "%s"',
    (text) => {
      expect(presenter.parseDate(text)).toBeNull();
    },
  );

  it('writes a date in the form it reads', () => {
    expect(presenter.dateInput('2026-11-07')).toBe('07.11.2026');
    expect(presenter.parseDate(presenter.dateInput('2026-11-07'))).toBe('2026-11-07');
  });
});
