import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { DomainHttpErrorMapper } from '../../src/shared/domain-http-error.mapper.js';
import { FastifyHttpServer } from '../../src/shared/fastify-http.server.js';
import type { HttpController } from '../../src/shared/http.ports.js';

class FailingController implements HttpController {
  public register(app: FastifyInstance): void {
    app.get('/boom', () => {
      throw new Error('database down');
    });
  }
}

function serverWith(errors: string[]): FastifyHttpServer {
  const logger: FastifyBaseLogger = pino(
    {
      level: 'error',
      hooks: {
        logMethod(args, method) {
          errors.push(String(args.at(-1)));
          method.apply(this, args);
        },
      },
    },
    { write: () => undefined },
  );
  return new FastifyHttpServer([new FailingController()], new DomainHttpErrorMapper(), logger, {
    bodyLimit: 1024,
    trustProxy: false,
  });
}

describe('FastifyHttpServer', () => {
  it('logs unexpected errors and answers 500 without details', async () => {
    const errors: string[] = [];
    const server = serverWith(errors);

    const response = await server.app().inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'internal', message: 'Something went wrong.' },
    });
    expect(errors).toEqual(['Unhandled error']);
    await server.close();
  });

  it('listens on a port and closes', async () => {
    const server = serverWith([]);

    const address = await server.listen('127.0.0.1', 0);

    expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    await server.close();
  });

  it('closes cleanly when never started', async () => {
    await expect(serverWith([]).close()).resolves.toBeUndefined();
  });
});
