import { ZodInputValidator } from '@amexbutikker/application';
import type { MatchSharedPlace, MatchSharedPlaceOutput } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { SharedMatchController } from '../../src/shared-match/shared-match.controller.js';
import { DefaultHttpDtoMapper } from '../../src/shared/default-http-dto.mapper.js';

class FixedMatch implements MatchSharedPlace {
  public readonly texts: string[] = [];

  public constructor(private readonly output: MatchSharedPlaceOutput) {}

  public execute(input: { text: string }): Promise<MatchSharedPlaceOutput> {
    this.texts.push(input.text);
    return Promise.resolve(this.output);
  }
}

describe('SharedMatchController', () => {
  it('matches shared text and returns parsed fields, candidates and the decision', async () => {
    const data = new TestData();
    const place = data.physicalPlace();
    const { status } = data.statusSnapshot(place.id);
    const match = new FixedMatch({
      parsed: {
        provider: 'google_maps',
        name: 'Kafé Åsen',
        street: null,
        postcode: null,
        city: 'Oslo',
        location: null,
        urls: [],
      },
      candidates: [{ place, score: 0.9, reasons: [{ kind: 'postcode' }], status }],
      decision: { type: 'open', placeId: place.id },
    });
    const app = Fastify();
    new SharedMatchController(match, new ZodInputValidator(), new DefaultHttpDtoMapper()).register(
      app,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/match/shared',
      payload: { text: 'Kafé Åsen, Oslo' },
    });

    expect(response.statusCode).toBe(200);
    expect(match.texts).toEqual(['Kafé Åsen, Oslo']);
    expect(response.json()).toMatchObject({
      parsed: { provider: 'google_maps', name: 'Kafé Åsen', city: 'Oslo' },
      candidates: [{ place: { id: place.id }, status: { status: 'accepted' }, score: 0.9 }],
      decision: { type: 'open', placeId: place.id },
    });
    await app.close();
  });
});
