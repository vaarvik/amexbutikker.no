import {
  ConflictError,
  DomainError,
  DuplicatePlaceError,
  NotFoundError,
  RateLimitedError,
  UnauthenticatedError,
  ValidationError,
} from '@amexbutikker/contracts';
import type { ErrorResponseDto } from '@amexbutikker/contracts';
import type { HttpErrorResponse } from './shared.model.js';
import type { HttpErrorMapper } from './shared.ports.js';

/** Typed domain errors to status codes. Everything else is a 500 that hides its details. */
export class DomainHttpErrorMapper implements HttpErrorMapper {
  public toResponse(error: unknown): HttpErrorResponse {
    if (error instanceof ValidationError) {
      return this.response(400, error, {
        issues: error.issues.map((issue) => ({ path: [...issue.path], message: issue.message })),
      });
    }
    if (error instanceof UnauthenticatedError) {
      return this.response(401, error);
    }
    if (error instanceof NotFoundError) {
      return this.response(404, error);
    }
    if (error instanceof DuplicatePlaceError) {
      return this.response(409, error, { existingPlaceId: error.existing.id });
    }
    if (error instanceof ConflictError) {
      return this.response(409, error);
    }
    if (error instanceof RateLimitedError) {
      return {
        ...this.response(429, error, { retryAfterSeconds: error.retryAfterSeconds }),
        headers: { 'retry-after': String(error.retryAfterSeconds) },
      };
    }
    if (error instanceof DomainError) {
      return this.response(400, error);
    }
    const clientStatus = this.fastifyClientStatus(error);
    if (clientStatus !== undefined) {
      return {
        statusCode: clientStatus,
        headers: {},
        body: {
          error: {
            code: 'bad_request',
            message: error instanceof Error ? error.message : 'Bad request.',
          },
        },
        unexpected: false,
      };
    }
    return {
      statusCode: 500,
      headers: {},
      body: { error: { code: 'internal', message: 'Something went wrong.' } },
      unexpected: true,
    };
  }

  private response(
    statusCode: number,
    error: DomainError,
    extra: Partial<ErrorResponseDto['error']> = {},
  ): HttpErrorResponse {
    return {
      statusCode,
      headers: {},
      body: { error: { code: error.code, message: error.message, ...extra } },
      unexpected: false,
    };
  }

  /** Fastify's own 4xx errors (invalid JSON, body too large, unsupported media type). */
  private fastifyClientStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
      return undefined;
    }
    const { statusCode } = error;
    return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
      ? statusCode
      : undefined;
  }
}
