import { PasskeyIdSchema } from '@amexbutikker/contracts';
import type {
  CompletePasskeyRegistration,
  CompletePasskeySignIn,
  IssuedAccessSession,
  RenewAccessSession,
  StartPasskeyRegistration,
  StartPasskeyRegistrationInput,
  StartPasskeySignIn,
} from '@amexbutikker/contracts';
import { ZodInputValidator } from '@amexbutikker/application';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { AccessController } from '../../src/access/access.controller.js';
import { DomainHttpErrorMapper } from '../../src/shared/domain-http-error.mapper.js';
import { FastifyHttpServer } from '../../src/shared/fastify-http.server.js';
import { NullAccessAuthenticator } from '../../src/shared/null-access.authenticator.js';

const ISSUED_AT = new Date('2026-11-19T12:00:00.000Z');
const SESSION: IssuedAccessSession = {
  token: 's1.payload.sig',
  passkeyId: PasskeyIdSchema.parse('cGFzc2tleQ'),
  issuedAt: ISSUED_AT,
  expiresAt: new Date(ISSUED_AT.getTime() + 365 * 86_400_000),
};
const COOKIE = `__Host-amex_session=s1.payload.sig; Path=/; Max-Age=${String(365 * 86_400)}; HttpOnly; Secure; SameSite=Lax`;

class Recorder
  implements
    StartPasskeyRegistration,
    CompletePasskeyRegistration,
    StartPasskeySignIn,
    CompletePasskeySignIn,
    RenewAccessSession
{
  public readonly inputs: unknown[] = [];

  public execute(input?: unknown): Promise<never> {
    this.inputs.push(input);
    return Promise.resolve(
      (input as Partial<StartPasskeyRegistrationInput> | undefined)?.inviteCode === undefined &&
        input !== undefined
        ? SESSION
        : { options: { challenge: 'c' } },
    ) as Promise<never>;
  }
}

function serverWith(renew: RenewAccessSession = new Recorder()) {
  const recorder = new Recorder();
  const server = new FastifyHttpServer(
    [new AccessController(recorder, recorder, recorder, recorder, renew, new ZodInputValidator())],
    new DomainHttpErrorMapper(),
    pino({ level: 'silent' }),
    new NullAccessAuthenticator(),
    { bodyLimit: 4096, trustProxy: false, corsOrigins: [] },
  );
  return { app: server.app(), recorder };
}

describe('AccessController', () => {
  it('starts a registration with the invite code and a hashed client key', async () => {
    const { app, recorder } = serverWith();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/access/registration/options',
      payload: { inviteCode: 'blue-otter-42' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ options: { challenge: 'c' } });
    expect(recorder.inputs).toHaveLength(1);
    expect(recorder.inputs[0]).toMatchObject({ inviteCode: 'blue-otter-42' });
    expect((recorder.inputs[0] as { clientKey: string }).clientKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sets the session cookie after a registration or a sign-in', async () => {
    const { app } = serverWith();

    for (const url of ['/v1/access/registration', '/v1/access/sign-in']) {
      const response = await app.inject({
        method: 'POST',
        url,
        payload: { credential: { id: 'Y3JlZA' } },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['set-cookie']).toBe(COOKIE);
      expect(response.headers['cache-control']).toBe('no-store');
    }
  });

  it('starts a sign-in', async () => {
    const response = await serverWith().app.inject({
      method: 'POST',
      url: '/v1/access/sign-in/options',
    });

    expect(response.json()).toEqual({ options: { challenge: 'c' } });
  });

  it('renews the session from its cookie', async () => {
    const renew = new Recorder();
    const response = await serverWith(renew).app.inject({
      method: 'POST',
      url: '/v1/access/session',
      headers: { cookie: 'a=1; __Host-amex_session=s1.old.sig' },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toBe(COOKIE);
    expect(renew.inputs).toEqual([{ token: 's1.old.sig' }]);
  });

  it('answers 401 to a renewal without a cookie', async () => {
    const response = await serverWith().app.inject({
      method: 'POST',
      url: '/v1/access/session',
    });

    expect(response.statusCode).toBe(401);
  });

  it('answers 400 to a request without a credential', async () => {
    const response = await serverWith().app.inject({
      method: 'POST',
      url: '/v1/access/sign-in',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});
