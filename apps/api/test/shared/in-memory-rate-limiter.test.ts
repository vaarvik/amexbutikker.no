import { RateLimitedError } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from '../../src/shared/in-memory/in-memory-rate-limiter.js';

describe('InMemoryRateLimiter', () => {
  let now = 0;
  const clock = { now: () => new Date(now) };
  const limiter = new InMemoryRateLimiter({ report: { limit: 2, windowSeconds: 60 } }, clock);

  it('allows up to the limit per key and window, then refuses with a retry hint', async () => {
    await limiter.consume({ action: 'report', key: 'a' });
    await limiter.consume({ action: 'report', key: 'a' });
    now = 15_000;

    const refused = limiter.consume({ action: 'report', key: 'a' });

    await expect(refused).rejects.toBeInstanceOf(RateLimitedError);
    await expect(refused).rejects.toMatchObject({ retryAfterSeconds: 45 });
    await expect(limiter.consume({ action: 'report', key: 'b' })).resolves.toBeUndefined();
  });

  it('starts a new window after the old one ends', async () => {
    now = 61_000;

    await expect(limiter.consume({ action: 'report', key: 'a' })).resolves.toBeUndefined();
  });

  it('does not limit actions without a rule', async () => {
    for (let i = 0; i < 10; i += 1) {
      await limiter.consume({ action: 'other', key: 'a' });
    }
  });
});
