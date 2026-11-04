import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CompositionRoot,
  DEFAULT_IMPORTS,
  DEFAULT_RATE_LIMITS,
} from '../../src/composition-root.js';
import type { ApiConfig } from '../../src/composition-root.js';

const config: ApiConfig = {
  storage: 'memory',
  deviceTokenSecret: 'test-secret-that-is-at-least-32-characters',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  trustProxy: false,
  rateLimits: DEFAULT_RATE_LIMITS,
  imports: DEFAULT_IMPORTS,
};

const OSLO_S = { lat: 59.9111, lng: 10.7528 };

describe('HTTP API (in-memory storage)', () => {
  let root: CompositionRoot;
  let app: FastifyInstance;

  beforeEach(() => {
    root = new CompositionRoot(config);
    app = root.httpServer.app();
  });

  afterEach(() => root.close());

  async function registerDevice(): Promise<{ userId: string; authorization: string }> {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/devices',
      payload: { platform: 'ios' },
    });
    expect(response.statusCode).toBe(201);
    const { userId, token } = response.json<{ userId: string; token: string }>();
    return { userId, authorization: `Bearer ${token}` };
  }

  async function createCafe(authorization: string, name = 'Kafé Åsen'): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/places',
      headers: { authorization },
      payload: {
        kind: 'physical',
        name,
        category: 'cafe',
        address: { street: 'Karl Johans gate 1', postcode: '0154', city: 'Oslo' },
        location: OSLO_S,
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ place: { id: string } }>().place.id;
  }

  describe('POST /v1/devices', () => {
    it('issues a token bound to a new user', async () => {
      const { userId, authorization } = await registerDevice();

      expect(userId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(authorization).toMatch(/^Bearer v1\./);
    });

    it('rejects an unknown platform', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/devices',
        payload: { platform: 'symbian' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'validation_failed' } });
    });
  });

  describe('POST /v1/places', () => {
    it('requires a device token', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/places', payload: {} });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: 'unauthenticated' } });
    });

    it('rejects a forged token', async () => {
      const { authorization } = await registerDevice();
      const forged = `${authorization.slice(0, -4)}AAAA`;

      const response = await app.inject({
        method: 'POST',
        url: '/v1/places',
        headers: { authorization: forged },
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it('creates an online place', async () => {
      const { authorization } = await registerDevice();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/places',
        headers: { authorization },
        payload: {
          kind: 'online',
          name: 'Nettbutikken',
          website: 'https://nettbutikken.example.no/',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        place: { kind: 'online', name: 'Nettbutikken', category: 'online_shop' },
      });
    });

    it('lists every validation issue', async () => {
      const { authorization } = await registerDevice();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/places',
        headers: { authorization },
        payload: {
          kind: 'physical',
          name: '',
          category: 'cafe',
          address: {},
          location: { lat: 200, lng: 0 },
        },
      });

      expect(response.statusCode).toBe(400);
      const issues = response.json<{ error: { issues: { path: string[] }[] } }>().error.issues;
      expect(issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['name', 'location.lat']),
      );
    });

    it('answers malformed JSON with 400', async () => {
      const { authorization } = await registerDevice();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/places',
        headers: { authorization, 'content-type': 'application/json' },
        payload: '{not json',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'bad_request' } });
    });
  });

  describe('search and nearby', () => {
    it('finds a place by name ignoring accents, with an unknown status', async () => {
      const { authorization } = await registerDevice();
      const id = await createCafe(authorization);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/places/search?q=kafe%20asen&lat=59.9111&lng=10.7528',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        results: [{ place: { id }, status: { status: 'unknown', confidence: 0 }, distanceM: 0 }],
      });
    });

    it('filters search by kind and uses the default nearby radius', async () => {
      const { authorization } = await registerDevice();
      const id = await createCafe(authorization);

      const physical = await app.inject({
        method: 'GET',
        url: '/v1/places/search?q=kafe&kind=physical',
      });
      const online = await app.inject({
        method: 'GET',
        url: '/v1/places/search?q=kafe&kind=online',
      });
      const nearby = await app.inject({
        method: 'GET',
        url: '/v1/places/nearby?lat=59.9111&lng=10.7528',
      });

      expect(physical.json()).toMatchObject({ results: [{ place: { id } }] });
      expect(online.json()).toEqual({ results: [] });
      expect(nearby.json()).toMatchObject({ results: [{ place: { id } }] });
    });

    it('requires lat and lng together', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/places/search?q=kafe&lat=59.9',
      });

      expect(response.statusCode).toBe(400);
    });

    it('lists nearby places', async () => {
      const { authorization } = await registerDevice();
      const id = await createCafe(authorization);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/places/nearby?lat=59.9111&lng=10.7528&radiusM=500',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ results: [{ place: { id } }] });
    });

    it('caps the nearby radius', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/places/nearby?lat=59.9&lng=10.7&radiusM=999999',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('reports', () => {
    it('turns a report into a status, shows it on the place and in search, and can be withdrawn', async () => {
      const me = await registerDevice();
      const id = await createCafe(me.authorization);

      const submitted = await app.inject({
        method: 'POST',
        url: `/v1/places/${id}/reports`,
        headers: { authorization: me.authorization },
        payload: { result: 'accepted', note: 'Gikk fint i kassa' },
      });
      expect(submitted.statusCode).toBe(200);
      expect(submitted.json()).toMatchObject({
        status: { status: 'accepted', basis: 'user_report' },
        chainHint: null,
      });

      const details = await app.inject({
        method: 'GET',
        url: `/v1/places/${id}`,
        headers: { authorization: me.authorization },
      });
      expect(details.json()).toMatchObject({
        status: { status: 'accepted' },
        basis: {
          kind: 'user_report',
          scope: 'place',
          source: 'app',
          userAccepted: 1,
          userRejected: 0,
        },
        latestNotes: [{ result: 'accepted', note: 'Gikk fint i kassa' }],
        myReport: 'accepted',
        chain: null,
      });

      const anonymous = await app.inject({ method: 'GET', url: `/v1/places/${id}` });
      expect(anonymous.json()).toMatchObject({ myReport: null });

      const search = await app.inject({ method: 'GET', url: '/v1/places/search?q=kafe' });
      expect(search.json()).toMatchObject({ results: [{ status: { status: 'accepted' } }] });

      const removed = await app.inject({
        method: 'DELETE',
        url: `/v1/places/${id}/reports/me`,
        headers: { authorization: me.authorization },
      });
      expect(removed.statusCode).toBe(200);
      expect(removed.json()).toMatchObject({ status: { status: 'unknown' } });

      const again = await app.inject({
        method: 'DELETE',
        url: `/v1/places/${id}/reports/me`,
        headers: { authorization: me.authorization },
      });
      expect(again.statusCode).toBe(404);
    });

    it('keeps one active report per device: a new report replaces the old one', async () => {
      const me = await registerDevice();
      const id = await createCafe(me.authorization);
      const report = (result: string) =>
        app.inject({
          method: 'POST',
          url: `/v1/places/${id}/reports`,
          headers: { authorization: me.authorization },
          payload: { result },
        });

      await report('accepted');
      const second = await report('rejected');

      expect(second.json()).toMatchObject({ status: { status: 'rejected' } });
      const details = await app.inject({ method: 'GET', url: `/v1/places/${id}` });
      expect(details.json()).toMatchObject({ basis: { userAccepted: 0, userRejected: 1 } });
    });

    it('rejects a malformed authorization header on an optional-auth route', async () => {
      const { authorization } = await registerDevice();
      const id = await createCafe(authorization);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/places/${id}`,
        headers: { authorization: 'Basic abc' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('answers 404 for an unknown place', async () => {
      const me = await registerDevice();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/places/0190f0d8-0000-7000-8000-000000000000/reports',
        headers: { authorization: me.authorization },
        payload: { result: 'accepted' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: { code: 'not_found' } });
    });

    it('answers 400 for a malformed place id', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/places/not-a-uuid' });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('rate limiting', () => {
    it('answers 429 with Retry-After once the report limit is reached', async () => {
      await root.close();
      root = new CompositionRoot({
        ...config,
        rateLimits: { submit_report: { limit: 2, windowSeconds: 60 } },
      });
      app = root.httpServer.app();
      const me = await registerDevice();
      const id = await createCafe(me.authorization);
      const report = () =>
        app.inject({
          method: 'POST',
          url: `/v1/places/${id}/reports`,
          headers: { authorization: me.authorization },
          payload: { result: 'accepted' },
        });

      await report();
      await report();
      const limited = await report();

      expect(limited.statusCode).toBe(429);
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      expect(limited.json()).toMatchObject({ error: { code: 'rate_limited' } });
    });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'not_found' } });
  });
});
