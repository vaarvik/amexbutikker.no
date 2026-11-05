import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';
import type { Clock } from '@amexbutikker/contracts';
import { parse } from 'csv-parse';
import type { BrregUnderenhetFile, BrregUnderenhetReader } from './brreg-underenheter.ports.js';

export interface CachedBrregUnderenhetReaderConfig {
  /** The gzipped CSV bulk download. */
  readonly url: string;
  readonly cacheFile: string;
  /** A cached file older than this is downloaded again. Brreg publishes a new file nightly. */
  readonly maxAgeMs: number;
  readonly userAgent: string;
}

/**
 * Downloads the bulk file once into the cache (about 60 MB for all of Norway), then streams it:
 * gunzip, then CSV with the header row as keys. The file's modification time is its fetchedAt.
 */
export class CachedBrregUnderenhetReader implements BrregUnderenhetReader {
  public constructor(
    private readonly config: CachedBrregUnderenhetReaderConfig,
    private readonly fetchFn: typeof globalThis.fetch,
    private readonly clock: Clock,
  ) {}

  public async open(signal?: AbortSignal): Promise<BrregUnderenhetFile> {
    const { cacheFile } = this.config;
    let fetchedAt = await this.modifiedAt(cacheFile);
    if (
      fetchedAt === null ||
      this.clock.now().getTime() - fetchedAt.getTime() > this.config.maxAgeMs
    ) {
      await this.download(signal);
      fetchedAt = this.clock.now();
    }
    const rows: AsyncIterable<Record<string, string>> = createReadStream(cacheFile)
      .pipe(createGunzip())
      .pipe(parse({ columns: true, bom: true, skip_empty_lines: true }));
    return { fetchedAt, rows };
  }

  private async download(signal?: AbortSignal): Promise<void> {
    const response = await this.fetchFn(this.config.url, {
      headers: { 'User-Agent': this.config.userAgent },
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok || response.body === null) {
      throw new Error(
        `Brønnøysund answered ${String(response.status)} ${response.statusText} for ${this.config.url}.`,
      );
    }
    await mkdir(dirname(this.config.cacheFile), { recursive: true });
    const partial = `${this.config.cacheFile}.partial`;
    await pipeline(
      Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
      createWriteStream(partial),
      ...(signal === undefined ? [] : [{ signal }]),
    );
    await rename(partial, this.config.cacheFile);
  }

  private async modifiedAt(file: string): Promise<Date | null> {
    try {
      return (await stat(file)).mtime;
    } catch {
      return null;
    }
  }
}
