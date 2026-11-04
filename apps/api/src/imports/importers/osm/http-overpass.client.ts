import type { Clock } from '@amexbutikker/contracts';
import type { OverpassClient, OverpassResponse } from './osm.ports.js';

export interface HttpOverpassClientConfig {
  /** e.g. https://overpass-api.de/api/interpreter */
  readonly endpoint: string;
  /** The usage policy asks clients to identify themselves. */
  readonly userAgent: string;
  readonly timeoutMs: number;
}

/** Posts the query to an Overpass endpoint. One request, no retries, per the usage policy. */
export class HttpOverpassClient implements OverpassClient {
  public constructor(
    private readonly config: HttpOverpassClientConfig,
    private readonly fetchFn: typeof globalThis.fetch,
    private readonly clock: Clock,
  ) {}

  public async fetch(query: string, signal?: AbortSignal): Promise<OverpassResponse> {
    const timeout = AbortSignal.timeout(this.config.timeoutMs);
    const response = await this.fetchFn(this.config.endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': this.config.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
    });
    if (!response.ok) {
      const busy = response.status === 429 || response.status === 504;
      throw new Error(
        `Overpass answered ${String(response.status)} ${response.statusText}${busy ? ' (busy, try again later)' : ''}.`,
      );
    }
    const body: unknown = await response.json();
    return { body, fetchedAt: this.clock.now() };
  }
}
