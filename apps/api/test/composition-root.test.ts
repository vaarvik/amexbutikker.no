import { describe, expect, it } from 'vitest';
import { ApiConfigSchema, CompositionRoot } from '../src/composition-root.js';

const base = {
  storage: 'memory',
  deviceTokenSecret: 'test-secret-that-is-at-least-32-characters',
  imports: {},
};

describe('ApiConfigSchema', () => {
  it('disables CORS by default', () => {
    expect(ApiConfigSchema.parse(base).corsOrigins).toEqual([]);
  });

  it('reads a comma-separated list of exact origins', () => {
    expect(
      ApiConfigSchema.parse({
        ...base,
        corsOrigins: ' http://localhost:8081 , https://abc.trycloudflare.com,',
      }).corsOrigins,
    ).toEqual(['http://localhost:8081', 'https://abc.trycloudflare.com']);
  });

  it.each([['*'], ['https://*.trycloudflare.com'], ['http://localhost:8081/'], ['localhost:8081']])(
    'rejects %s',
    (corsOrigins) => {
      expect(ApiConfigSchema.safeParse({ ...base, corsOrigins }).success).toBe(false);
    },
  );
});

describe('CompositionRoot.fromEnv', () => {
  const env = { STORAGE: 'memory', DEVICE_TOKEN_SECRET: base.deviceTokenSecret };

  it.each([[undefined], ['']])('starts without a web root (WEB_ROOT=%j)', (webRoot) => {
    expect(() =>
      CompositionRoot.fromEnv(webRoot === undefined ? env : { ...env, WEB_ROOT: webRoot }),
    ).not.toThrow();
  });

  it('locks the API behind Cloudflare Access when it is configured', async () => {
    const root = CompositionRoot.fromEnv({
      ...env,
      ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com/',
      ACCESS_AUD: 'aud-tag',
    });
    const app = root.httpServer.app();

    const health = await app.inject({ method: 'GET', url: '/health' });
    const places = await app.inject({ method: 'GET', url: '/v1/places/search?q=kiwi' });

    expect(health.statusCode).toBe(200);
    expect(places.statusCode).toBe(401);
    await root.httpServer.close();
  });

  it('needs both Access settings', () => {
    expect(() => CompositionRoot.fromEnv({ ...env, ACCESS_AUD: 'aud-tag' })).toThrow();
  });

  it('locks the API behind passkeys, leaving sign-in open', async () => {
    const root = CompositionRoot.fromEnv({
      ...env,
      PASSKEY_ORIGIN: 'https://amex.example.test',
      PASSKEY_INVITE_CODE: 'blue-otter-42',
    });
    const app = root.httpServer.app();

    const places = await app.inject({ method: 'GET', url: '/v1/places/search?q=kiwi' });
    const session = await app.inject({ method: 'POST', url: '/v1/access/session' });
    const signIn = await app.inject({ method: 'POST', url: '/v1/access/sign-in/options' });
    const wrong = await app.inject({
      method: 'POST',
      url: '/v1/access/registration/options',
      payload: { inviteCode: 'red-otter-42' },
    });
    const invited = await app.inject({
      method: 'POST',
      url: '/v1/access/registration/options',
      payload: { inviteCode: 'blue-otter-42' },
    });

    expect(places.statusCode).toBe(401);
    expect(session.statusCode).toBe(401);
    expect(signIn.json()).toMatchObject({ options: { rpId: 'amex.example.test' } });
    expect(wrong.statusCode).toBe(400);
    expect(invited.json()).toMatchObject({ options: { rp: { id: 'amex.example.test' } } });
    await root.httpServer.close();
  });

  it('takes an exact passkey origin, and not together with Cloudflare Access', () => {
    expect(() =>
      CompositionRoot.fromEnv({ ...env, PASSKEY_ORIGIN: 'https://amex.example.test/app' }),
    ).toThrow();
    expect(() =>
      CompositionRoot.fromEnv({
        ...env,
        PASSKEY_ORIGIN: 'https://amex.example.test',
        ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com',
        ACCESS_AUD: 'aud-tag',
      }),
    ).toThrow();
  });
});
