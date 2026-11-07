import { describe, expect, it } from 'vitest';
import { ClockLocalDateProvider } from '../../src/spending/clock-local-date.provider';

describe('ClockLocalDateProvider', () => {
  it("gives today's date in the phone's time zone", () => {
    // Built from local fields, so it holds in any time zone the tests run in.
    const now = new Date(2026, 0, 5, 0, 30);

    expect(new ClockLocalDateProvider({ now: () => now }).today()).toBe('2026-01-05');
  });
});
