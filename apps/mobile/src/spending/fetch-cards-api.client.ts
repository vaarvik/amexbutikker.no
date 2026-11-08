import { CardListResponseDtoSchema } from '@amexbutikker/contracts';
import type { Card } from '@amexbutikker/contracts';
import type { JsonTransport } from '../shared/shared.ports';
import type { CardsApiClient } from './spending.ports';

export class FetchCardsApiClient implements CardsApiClient {
  public constructor(private readonly transport: JsonTransport) {}

  public async list(): Promise<readonly Card[]> {
    const { cards } = await this.transport.request(
      { method: 'GET', path: '/v1/cards' },
      CardListResponseDtoSchema,
    );
    return cards;
  }
}
