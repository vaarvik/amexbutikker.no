import { ZodInputValidator } from '@amexbutikker/application';
import type {
  MatchPayment,
  MatchPaymentInput,
  MatchPaymentOutput,
  MatchSharedPlace,
  MatchSharedPlaceOutput,
} from '@amexbutikker/contracts';
import { ValidationError } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { SharedMatchController } from '../../src/shared-match/shared-match.controller.js';
import { AllowlistHttpDtoMapper } from '../../src/shared/allowlist-http-dto.mapper.js';

class FixedMatch implements MatchSharedPlace {
  public readonly texts: string[] = [];

  public constructor(private readonly output: MatchSharedPlaceOutput) {}

  public execute(input: { text: string }): Promise<MatchSharedPlaceOutput> {
    this.texts.push(input.text);
    return Promise.resolve(this.output);
  }
}

class FixedPaymentMatch implements MatchPayment {
  public readonly inputs: MatchPaymentInput[] = [];

  public constructor(private readonly output: MatchPaymentOutput) {}

  public execute(input: MatchPaymentInput): Promise<MatchPaymentOutput> {
    this.inputs.push(input);
    return Promise.resolve(this.output);
  }
}

const NO_PAYMENT_MATCH: MatchPaymentOutput = {
  merchantName: null,
  candidates: [],
  decision: { type: 'none' },
};

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
    new SharedMatchController(
      match,
      new FixedPaymentMatch(NO_PAYMENT_MATCH),
      new ZodInputValidator(),
      new AllowlistHttpDtoMapper(),
    ).register(app);

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

  async function paymentApp(payment: FixedPaymentMatch) {
    const app = Fastify();
    app.setErrorHandler(async (error, _request, reply) =>
      reply.status(error instanceof ValidationError ? 400 : 500).send(),
    );
    new SharedMatchController(
      new FixedMatch({
        parsed: {
          provider: 'unknown',
          name: null,
          street: null,
          postcode: null,
          city: null,
          location: null,
          urls: [],
        },
        candidates: [],
        decision: { type: 'none' },
      }),
      payment,
      new ZodInputValidator(),
      new AllowlistHttpDtoMapper(),
    ).register(app);
    await app.ready();
    return app;
  }

  it('matches a payment on the merchant name and the position', async () => {
    const data = new TestData();
    const place = data.physicalPlace();
    const { status } = data.statusSnapshot(place.id);
    const payment = new FixedPaymentMatch({
      merchantName: 'Kaffebrenneriet',
      candidates: [{ place, score: 0.9, reasons: [{ kind: 'distance', distanceM: 12 }], status }],
      decision: { type: 'open', placeId: place.id },
    });
    const app = await paymentApp(payment);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/match/payment',
      payload: { merchant: 'SQ *Kaffebrenneriet', lat: 59.91, lng: 10.74 },
    });

    expect(response.statusCode).toBe(200);
    expect(payment.inputs).toEqual([
      { merchant: 'SQ *Kaffebrenneriet', location: { lat: 59.91, lng: 10.74 } },
    ]);
    expect(response.json()).toMatchObject({
      merchantName: 'Kaffebrenneriet',
      candidates: [{ place: { id: place.id }, score: 0.9 }],
      decision: { type: 'open', placeId: place.id },
    });
    await app.close();
  });

  it('matches a payment without a position', async () => {
    const payment = new FixedPaymentMatch(NO_PAYMENT_MATCH);
    const app = await paymentApp(payment);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/match/payment',
      payload: { merchant: 'Kaffebrenneriet' },
    });

    expect(response.statusCode).toBe(200);
    expect(payment.inputs).toEqual([{ merchant: 'Kaffebrenneriet', location: null }]);
    await app.close();
  });

  it.each([
    { merchant: '' },
    { merchant: 'Kaffebrenneriet', lat: 59.91 },
    { merchant: 'Kaffebrenneriet', amount: 249 },
  ])('rejects the payment body %j', async (payload) => {
    const payment = new FixedPaymentMatch(NO_PAYMENT_MATCH);
    const app = await paymentApp(payment);

    const response = await app.inject({ method: 'POST', url: '/v1/match/payment', payload });

    expect(response.statusCode).toBe(400);
    expect(payment.inputs).toEqual([]);
    await app.close();
  });
});
