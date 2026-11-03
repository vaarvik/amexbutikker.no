/**
 * Base class of every typed error. Adapters map subclasses to transport errors
 * (HTTP status codes, CLI exit codes); anything that is not a DomainError is a bug.
 */
export class DomainError extends Error {
  /** Stable machine-readable code, e.g. for API error bodies. */
  public readonly code: string;

  public constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/** The requested entity does not exist. */
export class NotFoundError extends DomainError {
  public constructor(
    public readonly entity: string,
    public readonly id: string,
    options?: ErrorOptions,
  ) {
    super('not_found', `${entity} ${id} was not found.`, options);
  }
}

/** One problem found while validating input. `path` points into the input, e.g. `['address', 'postcode']`. */
export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** Input is well-formed but violates a rule, or failed schema validation at a boundary. */
export class ValidationError extends DomainError {
  public constructor(
    message: string,
    public readonly issues: readonly ValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super('validation_failed', message, options);
  }
}

/** The operation conflicts with existing state, e.g. a duplicate unique key. */
export class ConflictError extends DomainError {
  public constructor(message: string, options?: ErrorOptions) {
    super('conflict', message, options);
  }
}

/** The caller exceeded a rate limit. `retryAfterSeconds` is a hint for the client. */
export class RateLimitedError extends DomainError {
  public constructor(
    public readonly retryAfterSeconds: number,
    options?: ErrorOptions,
  ) {
    super(
      'rate_limited',
      `Too many requests. Retry after ${String(retryAfterSeconds)} s.`,
      options,
    );
  }
}

/** A device token is missing, malformed, expired or has an invalid signature. */
export class UnauthenticatedError extends DomainError {
  public constructor(message = 'A valid device token is required.', options?: ErrorOptions) {
    super('unauthenticated', message, options);
  }
}
