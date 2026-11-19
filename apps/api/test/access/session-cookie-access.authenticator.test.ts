import { PasskeyIdSchema, UnauthenticatedError } from '@amexbutikker/contracts';
import { InMemoryPasskeyRepository } from '@amexbutikker/in-memory';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { HmacAccessSessionService } from '../../src/access/hmac-access-session.service.js';
import { SessionCookieAccessAuthenticator } from '../../src/access/session-cookie-access.authenticator.js';

const SECRET = 'a-secret-that-is-at-least-32-bytes-long';
const PASSKEY = PasskeyIdSchema.parse('cGFzc2tleQ');
const clock = { now: () => new Date('2026-11-19T12:00:00.000Z') };

function request(cookie?: string): FastifyRequest {
  return { headers: cookie === undefined ? {} : { cookie } } as FastifyRequest;
}

async function setup(stored: boolean) {
  const sessions = new HmacAccessSessionService(SECRET, clock);
  const passkeys = new InMemoryPasskeyRepository();
  if (stored) {
    await passkeys.create({
      id: PASSKEY,
      publicKey: 'cGs',
      counter: 0,
      transports: [],
      createdAt: clock.now(),
    });
  }
  return {
    token: sessions.issue(PASSKEY).token,
    authenticator: new SessionCookieAccessAuthenticator(sessions, passkeys),
  };
}

describe('SessionCookieAccessAuthenticator', () => {
  it('lets in the session cookie of a stored passkey', async () => {
    const { token, authenticator } = await setup(true);

    await expect(
      authenticator.requireAccess(request(`other=1; __Host-amex_session=${token}`)),
    ).resolves.toBeUndefined();
  });

  it('refuses a request without the cookie', async () => {
    const { authenticator } = await setup(true);

    await expect(authenticator.requireAccess(request())).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(authenticator.requireAccess(request('other=1'))).rejects.toThrow('passkey');
  });

  it('refuses a session whose passkey was removed', async () => {
    const { token, authenticator } = await setup(false);

    await expect(
      authenticator.requireAccess(request(`__Host-amex_session=${token}`)),
    ).rejects.toThrow('removed');
  });
});
