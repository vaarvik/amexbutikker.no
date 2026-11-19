import { createHmac } from 'node:crypto';
import { PasskeyIdSchema, UnauthenticatedError } from '@amexbutikker/contracts';
import type { Clock } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { HmacAccessSessionService } from '../../src/access/hmac-access-session.service.js';

const SECRET = 'a-secret-that-is-at-least-32-bytes-long';
const PASSKEY = PasskeyIdSchema.parse('cGFzc2tleQ');
const DAY_MS = 86_400_000;

class MovableClock implements Clock {
  public constructor(public at = new Date('2026-11-19T12:00:00.500Z')) {}

  public now(): Date {
    return this.at;
  }
}

describe('HmacAccessSessionService', () => {
  it('issues a session for a year and verifies it', () => {
    const service = new HmacAccessSessionService(SECRET, new MovableClock());
    const session = service.issue(PASSKEY);

    expect(session.issuedAt).toEqual(new Date('2026-11-19T12:00:00.000Z'));
    expect(session.expiresAt.getTime() - session.issuedAt.getTime()).toBe(365 * DAY_MS);
    expect(service.verify(session.token)).toEqual({
      passkeyId: PASSKEY,
      issuedAt: session.issuedAt,
    });
  });

  it('refuses an expired session', () => {
    const clock = new MovableClock();
    const service = new HmacAccessSessionService(SECRET, clock, 30);
    const { token } = service.issue(PASSKEY);
    clock.at = new Date(clock.at.getTime() + 31 * DAY_MS);

    expect(() => service.verify(token)).toThrow('expired');
  });

  it('refuses a forged or malformed session', () => {
    const clock = new MovableClock();
    const forged = new HmacAccessSessionService(`${SECRET}-other`, clock).issue(PASSKEY).token;
    const service = new HmacAccessSessionService(SECRET, clock);
    const [version, , signature] = service.issue(PASSKEY).token.split('.');
    const garbled = `${String(version)}.${Buffer.from('nope').toString('base64url')}`;

    expect(() => service.verify(forged)).toThrow(UnauthenticatedError);
    expect(() => service.verify('v1.a.b')).toThrow('Malformed');
    expect(() => service.verify(`${String(version)}.x.${String(signature)}`)).toThrow('signature');
    expect(() => service.verify(`${garbled}.${sign(garbled)}`)).toThrow('Malformed');
  });

  it('refuses a short secret', () => {
    expect(() => new HmacAccessSessionService('short', new MovableClock())).toThrow();
  });
});

/** Signs any body with the service's derived key, to reach the payload checks. */
function sign(body: string): string {
  const key = createHmac('sha256', SECRET).update('access-session').digest();
  return createHmac('sha256', key).update(body).digest('base64url');
}
