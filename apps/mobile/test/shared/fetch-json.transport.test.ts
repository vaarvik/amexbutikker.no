import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, FetchJsonTransport } from '../../src/shared/fetch-json.transport';
import type { Fetch } from '../../src/shared/shared.ports';

const Body = z.object({ ok: z.boolean() });

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function transport(fetch: Fetch, timeoutMs = 1000) {
  return new FetchJsonTransport(fetch, { baseUrl: 'http://api.test', timeoutMs });
}

describe('FetchJsonTransport', () => {
  it('sends the method, query, JSON body and bearer token, and parses the response', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetch: Fetch = (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(json(200, { ok: true }));
    };

    const result = await transport(fetch).request(
      {
        method: 'POST',
        path: '/v1/things',
        query: { q: 'kafé åsen', lat: 59.9, skip: undefined },
        body: { a: 1 },
        token: 'secret',
      },
      Body,
    );

    expect(result).toEqual({ ok: true });
    expect(calls[0]?.url).toBe('http://api.test/v1/things?q=kaf%C3%A9%20%C3%A5sen&lat=59.9');
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      body: '{"a":1}',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer secret',
      },
    });
  });

  it('sends no body, content type or token when there are none', async () => {
    let init: RequestInit | undefined;
    await transport((_url, given) => {
      init = given;
      return Promise.resolve(json(200, { ok: true }));
    }).request({ method: 'GET', path: '/v1/things' }, Body);

    expect(init?.body).toBeUndefined();
    expect(init?.headers).toEqual({ accept: 'application/json' });
  });

  it('turns an API error body into an ApiError with code, status and retry hint', async () => {
    const fetch: Fetch = () =>
      Promise.resolve(
        json(429, { error: { code: 'rate_limited', message: 'Slow down', retryAfterSeconds: 30 } }),
      );

    await expect(transport(fetch).request({ method: 'GET', path: '/x' }, Body)).rejects.toEqual(
      new ApiError('rate_limited', 429, 'Slow down', 30),
    );
  });

  it('reports an error response without an error body as invalid_response', async () => {
    const fetch: Fetch = () => Promise.resolve(new Response('Bad gateway', { status: 502 }));

    await expect(
      transport(fetch).request({ method: 'GET', path: '/x' }, Body),
    ).rejects.toMatchObject({ code: 'invalid_response', status: 502 });
  });

  it('reports a body that does not match the schema as invalid_response', async () => {
    const fetch: Fetch = () => Promise.resolve(json(200, { ok: 'yes' }));

    await expect(
      transport(fetch).request({ method: 'GET', path: '/x' }, Body),
    ).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
  });

  it('reports a network failure as unreachable', async () => {
    const fetch: Fetch = () => Promise.reject(new TypeError('Network request failed'));

    await expect(
      transport(fetch).request({ method: 'GET', path: '/x' }, Body),
    ).rejects.toMatchObject({
      code: 'unreachable',
      status: null,
      message: 'Network request failed',
    });
  });

  it('aborts a request that takes longer than the timeout', async () => {
    const fetch: Fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });

    await expect(
      transport(fetch, 5).request({ method: 'GET', path: '/x' }, Body),
    ).rejects.toMatchObject({ code: 'unreachable' });
  });

  it('reports a non-Error rejection as unreachable', async () => {
    const offline: unknown = 'offline';
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- fetch polyfills may reject with anything
    const fetch: Fetch = () => Promise.reject(offline);

    await expect(
      transport(fetch).request({ method: 'GET', path: '/x' }, Body),
    ).rejects.toMatchObject({ code: 'unreachable', message: 'The request failed.' });
  });
});
