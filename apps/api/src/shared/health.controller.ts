import type { FastifyInstance } from 'fastify';
import type { HttpController } from './shared.ports.js';

/**
 * `GET /health` for the host's health check: 200 while the process serves requests. It does not
 * touch the database, so a slow database does not get the API restarted in a loop.
 */
export class HealthController implements HttpController {
  public register(app: FastifyInstance): void {
    app.get('/health', () => ({ status: 'ok' }));
  }
}
