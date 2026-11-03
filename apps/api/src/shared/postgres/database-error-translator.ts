import type { DomainError } from '@amexbutikker/contracts';

/** Maps a constraint name to the typed error it means for the caller. */
export type ConstraintErrors = Readonly<Record<string, () => DomainError>>;

/** Turns driver errors into typed domain errors. */
export interface DatabaseErrorTranslator {
  /**
   * @returns the mapped DomainError when `error` violates one of the given constraints,
   *   otherwise `error` itself (wrapped in an Error if it is not one).
   */
  translate(error: unknown, constraints: ConstraintErrors): Error;

  /** True for errors after which the whole transaction may be retried (serialisation, deadlock). */
  isRetryable(error: unknown): boolean;
}

interface PgDriverError {
  readonly code?: unknown;
  readonly constraint?: unknown;
}

export class PgDatabaseErrorTranslator implements DatabaseErrorTranslator {
  private static readonly integrityCodes: ReadonlySet<string> = new Set([
    '23505', // unique_violation
    '23503', // foreign_key_violation
  ]);
  private static readonly retryableCodes: ReadonlySet<string> = new Set([
    '40001', // serialization_failure
    '40P01', // deadlock_detected
  ]);

  public translate(error: unknown, constraints: ConstraintErrors): Error {
    const { code, constraint } = this.fields(error);
    const make =
      code !== undefined &&
      PgDatabaseErrorTranslator.integrityCodes.has(code) &&
      constraint !== undefined
        ? constraints[constraint]
        : undefined;
    if (make !== undefined) {
      return this.withCause(make(), error);
    }
    return error instanceof Error ? error : new Error(String(error), { cause: error });
  }

  public isRetryable(error: unknown): boolean {
    const { code } = this.fields(error);
    return code !== undefined && PgDatabaseErrorTranslator.retryableCodes.has(code);
  }

  private fields(error: unknown): { code?: string; constraint?: string } {
    if (typeof error !== 'object' || error === null) {
      return {};
    }
    const { code, constraint } = error as PgDriverError;
    return {
      ...(typeof code === 'string' ? { code } : {}),
      ...(typeof constraint === 'string' ? { constraint } : {}),
    };
  }

  private withCause(mapped: DomainError, cause: unknown): DomainError {
    Object.defineProperty(mapped, 'cause', { value: cause, enumerable: false });
    return mapped;
  }
}
