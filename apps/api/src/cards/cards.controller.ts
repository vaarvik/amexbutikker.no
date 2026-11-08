import { CardListResponseDtoSchema } from '@amexbutikker/contracts';
import type { ListCards } from '@amexbutikker/contracts';
import type { FastifyInstance } from 'fastify';
import type { HttpController } from '../shared/shared.ports.js';

export class CardsController implements HttpController {
  public constructor(private readonly listCards: ListCards) {}

  public register(app: FastifyInstance): void {
    app.get('/v1/cards', async (_request, reply) => {
      const output = await this.listCards.execute();
      // Changes only with a deploy; an hour keeps the app's copy fresh enough.
      void reply.header('cache-control', 'public, max-age=3600');
      return CardListResponseDtoSchema.parse(output);
    });
  }
}
