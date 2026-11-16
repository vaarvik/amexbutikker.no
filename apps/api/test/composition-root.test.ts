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

  it('locks every path but /health behind Cloudflare Access when it is configured', async () => {
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
});
