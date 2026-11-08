import type { z } from 'zod';
import type {
  ChainId,
  EvidenceId,
  HouseholdId,
  ImportRunId,
  PlaceId,
  UserId,
} from './shared.model.js';

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
  householdId(): HouseholdId;
}

export type LogFields = Readonly<Record<string, unknown>>;

/** Structured logging. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
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

/**
 * Accent- and case-insensitive text comparison, the same semantics Postgres gets from
 * `unaccent(lower(...))` and pg_trgm. Used by in-memory adapters and by matching logic.
 */
export interface NameSimilarity {
  /**
   * Lowercases, strips accents (å→a, ø→o, æ→ae, é→e) and collapses whitespace.
   * Invariant: idempotent; `normalize(normalize(x)) === normalize(x)`.
   */
  normalize(text: string): string;

  /**
   * Trigram similarity of the normalised texts, as pg_trgm's `similarity()`.
   *
   * @returns 0..1; 1 for equal normalised texts, 0 when they share no trigram.
   */
  similarity(a: string, b: string): number;
}

/** Validates input against a schema at a use case boundary. */
export interface InputValidator {
  /**
   * @returns the parsed value.
   * @throws ValidationError listing every issue when `input` does not match.
   */
  validate<T>(schema: z.ZodType<T>, input: unknown): T;
}
