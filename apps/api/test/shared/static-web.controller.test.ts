import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DomainHttpErrorMapper } from '../../src/shared/domain-http-error.mapper.js';
import { NullAccessAuthenticator } from '../../src/shared/null-access.authenticator.js';
import { FastifyHttpServer } from '../../src/shared/fastify-http.server.js';
import { HealthController } from '../../src/shared/health.controller.js';
import { StaticWebController } from '../../src/shared/static-web.controller.js';

describe('StaticWebController', () => {
  let root: string;
  let server: FastifyHttpServer;
  let app: FastifyInstance;

  beforeAll(async () => {
    // A small stand-in for expo-router's static export.
    root = await mkdtemp(join(tmpdir(), 'web-'));
    await mkdir(join(root, 'place'));
    await mkdir(join(root, '_expo', 'static', 'js'), { recursive: true });
    await mkdir(join(root, 'spending'));
    await writeFile(join(root, 'index.html'), '<p>home</p>');
    await writeFile(join(root, 'map.html'), '<p>map</p>');
    await writeFile(join(root, 'spending', 'purchase.html'), '<p>purchase</p>');
    await writeFile(join(root, 'place', '[id].html'), '<p>place</p>');
    await writeFile(join(root, '+not-found.html'), '<p>not found</p>');
    await writeFile(join(root, '_expo', 'static', 'js', 'app-abc123.js'), 'console.log(1)');
    server = new FastifyHttpServer(
      [new HealthController(), new StaticWebController({ root })],
      new DomainHttpErrorMapper(),
      pino({ level: 'silent' }),
      new NullAccessAuthenticator(),
      { bodyLimit: 1024, trustProxy: false, corsOrigins: [] },
    );
    app = server.app();
  });

  afterAll(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  const get = (url: string) => app.inject({ method: 'GET', url });

  it.each([
    ['/', 'home'],
    ['/map', 'map'],
    ['/spending/purchase', 'purchase'],
    ['/place/0190a000-0000-7000-8000-000000000001', 'place'],
    ['/map?from=widget', 'map'],
  ])('serves %s as the right page, never cached', async (url, text) => {
    const response = await get(url);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain(text);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('caches hashed bundles for a year', async () => {
    const response = await get('/_expo/static/js/app-abc123.js');

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it.each([['/nowhere'], ['/place/1/extra'], ['/../../etc/passwd'], ['/%2e%2e/secret']])(
    'answers %s with the app’s not-found page',
    async (url) => {
      const response = await get(url);

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain('not found');
    },
  );

  it('keeps the API’s own routes and its JSON 404 under /v1', async () => {
    await expect(get('/health')).resolves.toMatchObject({ statusCode: 200 });

    const missing = await get('/v1/nothing');

    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: 'not_found' } });
  });
});
