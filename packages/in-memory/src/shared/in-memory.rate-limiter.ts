import { RateLimitedError } from '@amexbutikker/contracts';
import type { Clock, RateLimiter, RateLimitKey } from '@amexbutikker/contracts';
import type { RateLimitRules } from './shared.model.js';

interface Window {
  readonly startedAt: number;
  count: number;
}

/**
 * Fixed-window counters in process memory. Correct for a single API instance; several instances
 * need a shared store (Postgres or Redis) behind the same port. Actions without a rule are not limited.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>();

  public constructor(
    private readonly rules: RateLimitRules,
    private readonly clock: Clock,
    private readonly maxTrackedKeys = 100_000,
  ) {}

  public consume(key: RateLimitKey): Promise<void> {
    const rule = this.rules[key.action];
    if (rule === undefined) {
      return Promise.resolve();
    }
    const now = this.clock.now().getTime();
    const windowMs = rule.windowSeconds * 1000;
    const id = `${key.action}\u0000${key.key}`;
    let window = this.windows.get(id);
    if (window === undefined || now - window.startedAt >= windowMs) {
      this.pruneIfFull(now, windowMs);
      window = { startedAt: now, count: 0 };
      this.windows.set(id, window);
    }
    if (window.count >= rule.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((window.startedAt + windowMs - now) / 1000));
      return Promise.reject(new RateLimitedError(retryAfterSeconds));
    }
    window.count += 1;
    return Promise.resolve();
  }

  private pruneIfFull(now: number, windowMs: number): void {
    if (this.windows.size < this.maxTrackedKeys) {
      return;
    }
    for (const [id, window] of this.windows) {
      if (now - window.startedAt >= windowMs) {
        this.windows.delete(id);
      }
    }
  }
}
