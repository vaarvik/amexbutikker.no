import type { Clock, UserId } from '@amexbutikker/contracts';
import { ValidationError } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { describe, expect, it } from 'vitest';
import { HmacAttestationChallengeService } from '../../src/devices/hmac-attestation-challenge.service.js';

const SECRET = 'a-device-token-secret-of-at-least-32-bytes';

class MovableClock implements Clock {
  public current = new Date('2026-11-08T12:00:00.000Z');

  public now(): Date {
    return this.current;
  }
}

function setup() {
  const clock = new MovableClock();
  const service = new HmacAttestationChallengeService({ secret: SECRET, ttlSeconds: 300 }, clock);
  const data = new TestData();
  return { clock, service, me: data.userId(), other: data.userId() };
}

function issueOf(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return (error as ValidationError).issues[0]?.message;
  }
}

describe('HmacAttestationChallengeService', () => {
  it('accepts its own challenge from the same device until it expires', () => {
    const { clock, service, me } = setup();
    const challenge = service.issue(me);

    expect(
      issueOf(() => {
        service.verify(me, challenge);
      }),
    ).toBeUndefined();
    clock.current = new Date(clock.current.getTime() + 300_000);
    expect(
      issueOf(() => {
        service.verify(me, challenge);
      }),
    ).toBeUndefined();
    clock.current = new Date(clock.current.getTime() + 1000);
    expect(
      issueOf(() => {
        service.verify(me, challenge);
      }),
    ).toBe('has expired');
  });

  it('issues a different challenge each time', () => {
    const { service, me } = setup();

    expect(service.issue(me)).not.toBe(service.issue(me));
  });

  it('refuses a challenge issued to another device', () => {
    const { service, me, other } = setup();

    expect(
      issueOf(() => {
        service.verify(other, service.issue(me));
      }),
    ).toBe('was not issued to this device');
  });

  it('refuses a challenge signed with another secret', () => {
    const { clock, service, me } = setup();
    const foreign = new HmacAttestationChallengeService(
      { secret: `${SECRET}-other`, ttlSeconds: 300 },
      clock,
    );

    expect(
      issueOf(() => {
        service.verify(me, foreign.issue(me));
      }),
    ).toBe('was not issued to this device');
  });

  it.each(['', 'c1', 'c2.1.a.b', 'c1.x.a.b', 'c1.1.a.b.c', 'c1.99999999999.a'])(
    'refuses the malformed challenge %j',
    (challenge) => {
      const { service, me } = setup();

      expect(
        issueOf(() => {
          service.verify(me, challenge);
        }),
      ).toBe('is malformed');
    },
  );

  it('refuses a secret shorter than 32 bytes', () => {
    expect(
      () =>
        new HmacAttestationChallengeService(
          { secret: 'short', ttlSeconds: 300 },
          new MovableClock(),
        ),
    ).toThrow();
  });

  it('binds the challenge to the user id', () => {
    const { service } = setup();
    const userId = '0190a000-0000-7000-8000-000000000001' as UserId;

    expect(service.issue(userId)).toMatch(/^c1\.\d+\.[\w-]+\.[\w-]+$/);
  });
});
