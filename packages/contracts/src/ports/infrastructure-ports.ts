import type { ChainId, EvidenceId, ImportRunId, PlaceId, UserId } from '../ids.js';

/** The current time. Injected so tests can fix it. */
export interface Clock {
  now(): Date;
}

/** New unique ids. UUIDs (v7, so they sort by creation time). */
export interface IdGenerator {
  placeId(): PlaceId;
  chainId(): ChainId;
  userId(): UserId;
  evidenceId(): EvidenceId;
  importRunId(): ImportRunId;
}

export type LogFields = Readonly<Record<string, unknown>>;

/** Structured logging. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface IssuedDeviceToken {
  readonly token: string;
  readonly userId: UserId;
  readonly issuedAt: Date;
}

/** Issues and verifies the signed tokens that identify anonymous devices. */
export interface DeviceTokenService {
  /** @returns an opaque signed token bound to `userId`. */
  issue(userId: UserId): Promise<IssuedDeviceToken>;

  /**
   * @returns the user the token was issued to.
   * @throws UnauthenticatedError when the token is malformed, has a bad signature or has expired.
   */
  verify(token: string): Promise<UserId>;
}

/** What is being limited, e.g. `{ action: 'submit_report', key: userId }`. */
export interface RateLimitKey {
  readonly action: string;
  readonly key: string;
}

/** Counts actions per key and refuses them past a limit. */
export interface RateLimiter {
  /**
   * Records one action.
   *
   * @throws RateLimitedError when the key is over its limit; the action is then not counted.
   */
  consume(key: RateLimitKey): Promise<void>;
}
