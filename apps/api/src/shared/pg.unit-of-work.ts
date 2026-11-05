import type { TransactionalPorts, UnitOfWork } from '@amexbutikker/contracts';
import type { Kysely } from 'kysely';
import type { Database } from './shared.model.js';
import type { DatabaseErrorTranslator, PgPortsFactory } from './shared.ports.js';

export interface PgUnitOfWorkConfig {
  /** Attempts before a serialisation failure is given up on. Default 10. */
  readonly maxAttempts?: number;
  /** Upper bound of the random backoff before a retry, in ms. Default 20. */
  readonly maxBackoffMs?: number;
}

/**
 * Runs work in a SERIALIZABLE transaction and retries it on serialisation failures and
 * deadlocks. Serialisable isolation is what makes concurrent recalculations of one place
 * behave as if they ran one after another.
 */
export class PgUnitOfWork implements UnitOfWork {
  private readonly maxAttempts: number;
  private readonly maxBackoffMs: number;

  public constructor(
    private readonly db: Kysely<Database>,
    private readonly portsFor: PgPortsFactory,
    private readonly errors: DatabaseErrorTranslator,
    options: PgUnitOfWorkConfig = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? 10;
    this.maxBackoffMs = options.maxBackoffMs ?? 20;
  }

  public async run<T>(work: (ports: TransactionalPorts) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.db
          .transaction()
          .setIsolationLevel('serializable')
          .execute((transaction) => work(this.portsFor(transaction)));
      } catch (error) {
        if (attempt >= this.maxAttempts || !this.isRetryable(error)) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.random() * this.maxBackoffMs));
      }
    }
  }

  private isRetryable(error: unknown): boolean {
    if (this.errors.isRetryable(error)) {
      return true;
    }
    const cause: unknown = error instanceof Error ? error.cause : undefined;
    return cause !== undefined && this.errors.isRetryable(cause);
  }
}
