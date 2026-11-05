import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Clock } from '@amexbutikker/contracts';
import { z } from 'zod';
import type { OverpassClient, OverpassResponse } from './osm.ports.js';

const CacheEntrySchema = z.object({ fetchedAt: z.iso.datetime(), body: z.unknown() });

export interface DiskCachingOverpassClientConfig {
  readonly directory: string;
  /** A cached response older than this is fetched again. */
  readonly maxAgeMs: number;
}

/**
 * Keeps each response on disk, keyed by a hash of the query, so repeated imports do not hit the
 * public Overpass servers. The cached `fetchedAt` is kept, so evidence age stays honest.
 */
export class DiskCachingOverpassClient implements OverpassClient {
  public constructor(
    private readonly inner: OverpassClient,
    private readonly config: DiskCachingOverpassClientConfig,
    private readonly clock: Clock,
  ) {}

  public async fetch(query: string, signal?: AbortSignal): Promise<OverpassResponse> {
    const file = join(
      this.config.directory,
      `${createHash('sha256').update(query).digest('hex').slice(0, 16)}.json`,
    );
    const cached = await this.read(file);
    if (
      cached !== null &&
      this.clock.now().getTime() - cached.fetchedAt.getTime() <= this.config.maxAgeMs
    ) {
      return cached;
    }
    const response = await this.inner.fetch(query, signal);
    await mkdir(this.config.directory, { recursive: true });
    const partial = `${file}.partial`;
    await writeFile(
      partial,
      JSON.stringify({ fetchedAt: response.fetchedAt.toISOString(), body: response.body }),
    );
    await rename(partial, file);
    return response;
  }

  private async read(file: string): Promise<OverpassResponse | null> {
    let json: unknown;
    try {
      json = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      // Missing or unreadable: fetch again and overwrite.
      return null;
    }
    const entry = CacheEntrySchema.safeParse(json);
    return entry.success
      ? { body: entry.data.body, fetchedAt: new Date(entry.data.fetchedAt) }
      : null;
  }
}
