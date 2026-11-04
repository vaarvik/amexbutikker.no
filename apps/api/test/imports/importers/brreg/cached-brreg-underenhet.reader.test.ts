import { mkdtemp, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CachedBrregUnderenhetReader } from '../../../../src/imports/importers/brreg/cached-brreg-underenhet.reader.js';

const HOUR = 3_600_000;
const CSV =
  '﻿"organisasjonsnummer","navn"\n"912345678","KAFE, ASEN AS"\n\n"987654321","BAR ""X"" AS"\n';

async function collect(
  rows: AsyncIterable<Readonly<Record<string, string>>>,
): Promise<Record<string, string>[]> {
  const all: Record<string, string>[] = [];
  for await (const row of rows) {
    all.push({ ...row });
  }
  return all;
}

describe('CachedBrregUnderenhetReader', () => {
  let directory: string;
  let now: Date;
  let downloads: number;
  let status: number;
  const clock = { now: () => now };
  const fetchFn: typeof globalThis.fetch = () => {
    downloads += 1;
    return Promise.resolve(
      status === 200
        ? new Response(gzipSync(CSV))
        : new Response(null, { status, statusText: 'Service Unavailable' }),
    );
  };

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'brreg-cache-'));
    now = new Date();
    downloads = 0;
    status = 200;
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function reader(maxAgeMs = 24 * HOUR): CachedBrregUnderenhetReader {
    return new CachedBrregUnderenhetReader(
      {
        url: 'https://brreg.test/lastned/csv',
        cacheFile: join(directory, 'nested', 'u.csv.gz'),
        maxAgeMs,
        userAgent: 'test',
      },
      fetchFn,
      clock,
    );
  }

  it('downloads once, then streams rows keyed by header with quotes and BOM handled', async () => {
    const first = await reader().open();
    const rows = await collect(first.rows);
    const second = await reader().open();

    expect(rows).toEqual([
      { organisasjonsnummer: '912345678', navn: 'KAFE, ASEN AS' },
      { organisasjonsnummer: '987654321', navn: 'BAR "X" AS' },
    ]);
    expect(await collect(second.rows)).toEqual(rows);
    expect(downloads).toBe(1);
    expect(first.fetchedAt).toEqual(now);
  });

  it('downloads again when the cached file is too old, and reports its age otherwise', async () => {
    await collect((await reader().open()).rows);
    const old = new Date(now.getTime() - 2 * HOUR);
    await utimes(join(directory, 'nested', 'u.csv.gz'), old, old);

    expect((await reader(3 * HOUR).open()).fetchedAt.getTime()).toBeCloseTo(old.getTime(), -4);
    await collect((await reader(HOUR).open()).rows);
    expect(downloads).toBe(2);
  });

  it('fails when the download fails', async () => {
    status = 503;

    await expect(reader().open()).rejects.toThrow(
      'Brønnøysund answered 503 Service Unavailable for https://brreg.test/lastned/csv.',
    );
  });
});
