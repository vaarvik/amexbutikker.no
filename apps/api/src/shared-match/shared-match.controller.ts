import {
  MatchPaymentRequestDtoSchema,
  MatchPaymentResponseDtoSchema,
  MatchSharedRequestDtoSchema,
  MatchSharedResponseDtoSchema,
} from '@amexbutikker/contracts';
import type { InputValidator, MatchPayment, MatchSharedPlace } from '@amexbutikker/contracts';
import type { FastifyInstance } from 'fastify';
import type { HttpController, HttpDtoMapper } from '../shared/shared.ports.js';

export class SharedMatchController implements HttpController {
  public constructor(
    private readonly matchSharedPlace: MatchSharedPlace,
    private readonly matchPayment: MatchPayment,
    private readonly validator: InputValidator,
    private readonly dtos: HttpDtoMapper,
  ) {}

  public register(app: FastifyInstance): void {
    app.post('/v1/match/shared', async (request) => {
      const { text } = this.validator.validate(MatchSharedRequestDtoSchema, request.body);
      const output = await this.matchSharedPlace.execute({ text });
      return MatchSharedResponseDtoSchema.parse(this.dtos.sharedMatch(output));
    });

    app.post('/v1/match/payment', async (request) => {
      const body = this.validator.validate(MatchPaymentRequestDtoSchema, request.body);
      const output = await this.matchPayment.execute({
        merchant: body.merchant,
        location:
          body.lat === undefined || body.lng === undefined
            ? null
            : { lat: body.lat, lng: body.lng },
      });
      return MatchPaymentResponseDtoSchema.parse(this.dtos.paymentMatch(output));
    });
  }
}
