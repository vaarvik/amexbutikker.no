import type { Clock } from '@amexbutikker/contracts';

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
