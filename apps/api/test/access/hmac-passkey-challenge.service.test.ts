import { ValidationError } from '@amexbutikker/contracts';
import type { Clock } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { HmacPasskeyChallengeService } from '../../src/access/hmac-passkey-challenge.service.js';

const SECRET = 'a-secret-that-is-at-least-32-bytes-long';

class MovableClock implements Clock {
  public constructor(public at = new Date('2026-11-19T12:00:00.000Z')) {}

  public now(): Date {
    return this.at;
  }
}

describe('HmacPasskeyChallengeService', () => {
  it('accepts its own challenge for the same purpose', () => {
    const service = new HmacPasskeyChallengeService(SECRET, new MovableClock());
    const challenge = service.issue('register');

    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(() => {
      service.verify(challenge, 'register');
    }).not.toThrow();
  });

  it('issues a different challenge every time', () => {
    const service = new HmacPasskeyChallengeService(SECRET, new MovableClock());

    expect(service.issue('sign_in')).not.toBe(service.issue('sign_in'));
  });

  it('refuses a challenge for the other purpose', () => {
    const service = new HmacPasskeyChallengeService(SECRET, new MovableClock());

    expect(() => {
      service.verify(service.issue('sign_in'), 'register');
    }).toThrow(ValidationError);
  });

  it('refuses an expired challenge', () => {
    const clock = new MovableClock();
    const service = new HmacPasskeyChallengeService(SECRET, clock, 300);
    const challenge = service.issue('sign_in');
    clock.at = new Date(clock.at.getTime() + 301_000);

    expect(() => {
      service.verify(challenge, 'sign_in');
    }).toThrow('expired');
  });

  it('refuses a challenge signed with another secret, or malformed', () => {
    const clock = new MovableClock();
    const other = new HmacPasskeyChallengeService(`${SECRET}-other`, clock).issue('sign_in');
    const service = new HmacPasskeyChallengeService(SECRET, clock);

    expect(() => {
      service.verify(other, 'sign_in');
    }).toThrow('not issued here');
    expect(() => {
      service.verify('short', 'sign_in');
    }).toThrow('Malformed');
  });

  it('refuses a short secret', () => {
    expect(() => new HmacPasskeyChallengeService('short', new MovableClock())).toThrow();
  });
});
