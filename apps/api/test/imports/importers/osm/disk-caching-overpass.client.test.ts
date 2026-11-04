import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiskCachingOverpassClient } from '../../../../src/imports/importers/osm/disk-caching-overpass.client.js';
import type {
  OverpassClient,
  OverpassResponse,
} from '../../../../src/imports/importers/osm/osm.ports.js';

const HOUR = 3_600_000;

class CountingOverpassClient implements OverpassClient {
  public calls = 0;

  public constructor(private readonly clock: { now(): Date }) {}

  public fetch(): Promise<OverpassResponse> {
    this.calls += 1;
    return Promise.resolve({ body: { call: this.calls }, fetchedAt: this.clock.now() });
  }
}

describe('DiskCachingOverpassClient', () => {
  let directory: string;
  let now: Date;
  const clock = { now: () => now };

  beforeEach(async () => {
    directory = join(await mkdtemp(join(tmpdir(), 'overpass-cache-')), 'nested');
    now = new Date('2026-11-04T08:00:00Z');
  });

  afterEach(async () => {
    await rm(join(directory, '..'), { recursive: true, force: true });
  });

  it('answers a repeated query from disk with the original fetch time', async () => {
    const inner = new CountingOverpassClient(clock);
    const client = new DiskCachingOverpassClient(inner, { directory, maxAgeMs: 24 * HOUR }, clock);
    const first = await client.fetch('q');
    now = new Date(now.getTime() + HOUR);

    await expect(client.fetch('q')).resolves.toEqual(first);
    expect(inner.calls).toBe(1);
    expect(await readdir(directory)).toHaveLength(1);
  });

  it('fetches again when the cached response is too old, or the query differs', async () => {
    const inner = new CountingOverpassClient(clock);
    const client = new DiskCachingOverpassClient(inner, { directory, maxAgeMs: HOUR }, clock);
    await client.fetch('q');
    await client.fetch('other');
    now = new Date(now.getTime() + 2 * HOUR);

    await expect(client.fetch('q')).resolves.toEqual({ body: { call: 3 }, fetchedAt: now });
    expect(inner.calls).toBe(3);
  });

  it('fetches again when the cache file is corrupt', async () => {
    const inner = new CountingOverpassClient(clock);
    const client = new DiskCachingOverpassClient(inner, { directory, maxAgeMs: HOUR }, clock);
    await client.fetch('q');
    const [file] = await readdir(directory);
    await writeFile(join(directory, file ?? ''), '{"fetchedAt":"yesterday"}');

    await client.fetch('q');
    await writeFile(join(directory, file ?? ''), 'not json');
    await client.fetch('q');

    expect(inner.calls).toBe(3);
  });
});
