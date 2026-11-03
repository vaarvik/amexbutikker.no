import {
  ConflictError,
  DomainError,
  NotFoundError,
  RateLimitedError,
  UnauthenticatedError,
  ValidationError,
} from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { DomainHttpErrorMapper } from '../../src/shared/domain-http-error.mapper.js';

describe('DomainHttpErrorMapper', () => {
  const mapper = new DomainHttpErrorMapper();

  it.each([
    [
      new ValidationError('bad', [{ path: ['name'], message: 'required' }]),
      400,
      'validation_failed',
    ],
    [new UnauthenticatedError(), 401, 'unauthenticated'],
    [new NotFoundError('Place', 'x'), 404, 'not_found'],
    [new ConflictError('taken'), 409, 'conflict'],
    [new RateLimitedError(30), 429, 'rate_limited'],
    [new DomainError('other_rule', 'broken'), 400, 'other_rule'],
  ])('maps %o to %i', (error, statusCode, code) => {
    const response = mapper.toResponse(error);

    expect(response).toMatchObject({ statusCode, unexpected: false, body: { error: { code } } });
  });

  it('includes issues for validation errors and Retry-After for rate limits', () => {
    expect(
      mapper.toResponse(new ValidationError('bad', [{ path: ['name'], message: 'required' }])).body
        .error.issues,
    ).toEqual([{ path: ['name'], message: 'required' }]);
    expect(mapper.toResponse(new RateLimitedError(30)).headers).toEqual({ 'retry-after': '30' });
  });

  it("passes Fastify's own client errors through as bad_request", () => {
    const fastifyError = Object.assign(new Error('Body is too large'), { statusCode: 413 });

    expect(mapper.toResponse(fastifyError)).toMatchObject({
      statusCode: 413,
      unexpected: false,
      body: { error: { code: 'bad_request', message: 'Body is too large' } },
    });
    expect(mapper.toResponse({ statusCode: 400 }).body.error.message).toBe('Bad request.');
  });

  it.each([new Error('boom'), { statusCode: 503 }, { statusCode: '400' }, 'text', null])(
    'hides unexpected error %o behind a 500',
    (error) => {
      expect(mapper.toResponse(error)).toEqual({
        statusCode: 500,
        headers: {},
        body: { error: { code: 'internal', message: 'Something went wrong.' } },
        unexpected: true,
      });
    },
  );
});
