import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { DomainHttpErrorMapper } from '../../src/shared/domain-http-error.mapper.js';
import { NullAccessAuthenticator } from '../../src/shared/null-access.authenticator.js';
import { FastifyHttpServer } from '../../src/shared/fastify-http.server.js';
import { HealthController } from '../../src/shared/health.controller.js';
import type { AccessAuthenticator, HttpController } from '../../src/shared/shared.ports.js';
import { UnauthenticatedError } from '@amexbutikker/contracts';

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
  return new FastifyHttpServer(
    [new FailingController()],
    new DomainHttpErrorMapper(),
    logger,
    new NullAccessAuthenticator(),
    { bodyLimit: 1024, trustProxy: false, corsOrigins: [] },
  );
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

  it('asks the access authenticator for the API, but not for /health, sign-in or the web app', async () => {
    class ClosedDoor implements AccessAuthenticator {
      public readonly seen: string[] = [];

      public requireAccess(request: { url: string }): Promise<void> {
        this.seen.push(request.url);
        return Promise.reject(new UnauthenticatedError('Sign in through Cloudflare Access.'));
      }
    }
    const door = new ClosedDoor();
    const server = new FastifyHttpServer(
      [new HealthController(), new FailingController()],
      new DomainHttpErrorMapper(),
      pino({ level: 'silent' }),
      door,
      { bodyLimit: 1024, trustProxy: false, corsOrigins: [] },
    );

    const health = await server.app().inject({ method: 'GET', url: '/health?x=1' });
    const api = await server.app().inject({ method: 'GET', url: '/v1/places?q=x' });
    const signIn = await server.app().inject({ method: 'POST', url: '/v1/access/sign-in' });
    const web = await server.app().inject({ method: 'GET', url: '/boom' });

    expect(health.statusCode).toBe(200);
    expect(api.statusCode).toBe(401);
    expect(signIn.statusCode).toBe(404);
    expect(web.statusCode).toBe(500);
    expect(door.seen).toEqual(['/v1/places?q=x']);
    await server.close();
  });
});
