import type { FastifyInstance } from 'fastify';

/** One resource's routes. */
export interface HttpController {
  register(app: FastifyInstance): void;
}
