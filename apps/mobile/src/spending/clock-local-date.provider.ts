import type { Clock } from '@amexbutikker/contracts';
import type { LocalDate } from './spending.model';
import type { LocalDateProvider } from './spending.ports';

/** Today in the phone's own time zone, so a purchase at 00:30 lands on the right day. */
export class ClockLocalDateProvider implements LocalDateProvider {
  public constructor(private readonly clock: Clock) {}

  public today(): LocalDate {
    const now = this.clock.now();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}
