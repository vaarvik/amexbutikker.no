/** Query string values; `undefined` leaves the parameter out. */
export type QueryParams = Readonly<Record<string, string | number | undefined>>;

/** One JSON request to the API, relative to its base URL. */
export interface JsonRequest {
  readonly method: 'GET' | 'POST' | 'DELETE';
  /** Starts with `/`, e.g. `/v1/places/nearby`. */
  readonly path: string;
  readonly query?: QueryParams;
  readonly body?: unknown;
  /** Sent as `Authorization: Bearer <token>`. */
  readonly token?: string;
}

/**
 * Why a request failed, as the UI needs to know it:
 * - `unreachable`: no response (offline, timeout, server down);
 * - `invalid_response`: a response that does not match its schema;
 * - otherwise the API's error code (`not_found`, `rate_limited`, `unauthorized`, ...).
 */
export type ApiErrorCode = 'unreachable' | 'invalid_response' | (string & {});
