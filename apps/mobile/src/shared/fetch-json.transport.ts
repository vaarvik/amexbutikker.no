import { ErrorResponseDtoSchema } from '@amexbutikker/contracts';
import type { z } from 'zod';
import type { ApiErrorCode, JsonRequest, QueryParams } from './shared.model';
import type { Fetch, JsonTransport } from './shared.ports';

/** A failed API request. `status` is null when no response arrived. */
export class ApiError extends Error {
  public constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number | null,
    message: string,
    public readonly retryAfterSeconds: number | null = null,
    /** With `duplicate_place`: the stored place the new one looks like. */
    public readonly existingPlaceId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface FetchJsonTransportConfig {
  /** e.g. `http://192.168.1.20:3000`, without a trailing slash. */
  readonly baseUrl: string;
  /** A request that takes longer is aborted and reported as `unreachable`. */
  readonly timeoutMs: number;
}

/** JSON over `fetch`, with a timeout, bearer tokens and zod-validated responses. */
export class FetchJsonTransport implements JsonTransport {
  public constructor(
    private readonly fetch: Fetch,
    private readonly config: FetchJsonTransportConfig,
  ) {}

  public async request<T>(request: JsonRequest, schema: z.ZodType<T>): Promise<T> {
    const response = await this.send(request);
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = ErrorResponseDtoSchema.safeParse(body);
      throw error.success
        ? new ApiError(
            error.data.error.code,
            response.status,
            error.data.error.message,
            error.data.error.retryAfterSeconds ?? null,
            error.data.error.existingPlaceId ?? null,
          )
        : new ApiError('invalid_response', response.status, `HTTP ${String(response.status)}`);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        'invalid_response',
        response.status,
        `${request.method} ${request.path} returned an unexpected body: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  private async send(request: JsonRequest): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (request.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (request.token !== undefined) {
      headers.authorization = `Bearer ${request.token}`;
    }
    try {
      return await this.fetch(this.url(request.path, request.query), {
        method: request.method,
        headers,
        signal: controller.signal,
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      });
    } catch (error) {
      throw new ApiError(
        'unreachable',
        null,
        error instanceof Error ? error.message : 'The request failed.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private url(path: string, query: QueryParams = {}): string {
    const params = Object.entries(query)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    return `${this.config.baseUrl}${path}${params.length === 0 ? '' : `?${params.join('&')}`}`;
  }
}
