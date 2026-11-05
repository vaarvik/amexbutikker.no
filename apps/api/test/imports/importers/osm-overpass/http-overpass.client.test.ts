import { describe, expect, it } from 'vitest';
import { HttpOverpassClient } from '../../../../src/imports/importers/osm-overpass/http-overpass.client.js';

const fetchedAt = new Date('2026-11-04T08:00:00Z');
const config = {
  endpoint: 'https://overpass.test/api/interpreter',
  userAgent: 'test-agent',
  timeoutMs: 1000,
};

function clientAnswering(response: Response): {
  client: HttpOverpassClient;
  requests: { url: string; init: RequestInit | undefined }[];
} {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: typeof globalThis.fetch = (input, init) => {
    requests.push({ url: input instanceof Request ? input.url : String(input), init });
    return Promise.resolve(response);
  };
  return { client: new HttpOverpassClient(config, fetchFn, { now: () => fetchedAt }), requests };
}

describe('HttpOverpassClient', () => {
  it('posts the query form-encoded with its user agent and returns the body', async () => {
    const { client, requests } = clientAnswering(Response.json({ elements: [] }));

    await expect(client.fetch('[out:json];node(1);out;')).resolves.toEqual({
      body: { elements: [] },
      fetchedAt,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(config.endpoint);
    expect(requests[0]?.init?.method).toBe('POST');
    expect(requests[0]?.init?.headers).toMatchObject({ 'User-Agent': 'test-agent' });
    expect(requests[0]?.init?.body).toBe('data=%5Bout%3Ajson%5D%3Bnode%281%29%3Bout%3B');
  });

  it('passes an abort signal through', async () => {
    const { client, requests } = clientAnswering(Response.json({ elements: [] }));

    await client.fetch('q', new AbortController().signal);

    expect(requests[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('says when Overpass is busy', async () => {
    const { client } = clientAnswering(
      new Response('', { status: 429, statusText: 'Too Many Requests' }),
    );

    await expect(client.fetch('q')).rejects.toThrow(
      'Overpass answered 429 Too Many Requests (busy, try again later).',
    );
  });

  it('reports other failures without the busy hint', async () => {
    const { client } = clientAnswering(
      new Response('', { status: 400, statusText: 'Bad Request' }),
    );

    await expect(client.fetch('q')).rejects.toThrow(/^Overpass answered 400 Bad Request\.$/);
  });
});
