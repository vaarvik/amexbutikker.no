import {
  PlaceIdParamsDtoSchema,
  StatusChangeResponseDtoSchema,
  SubmitReportRequestDtoSchema,
} from '@amexbutikker/contracts';
import type { InputValidator, RemoveMyReport, SubmitReport } from '@amexbutikker/contracts';
import type { FastifyInstance } from 'fastify';
import type { HttpController } from '../shared/shared.ports.js';
import type { HttpDtoMapper } from '../shared/default-http-dto.mapper.js';
import type { RequestAuthenticator } from '../shared/bearer-token.authenticator.js';

export class ReportsController implements HttpController {
  public constructor(
    private readonly submitReport: SubmitReport,
    private readonly removeMyReport: RemoveMyReport,
    private readonly auth: RequestAuthenticator,
    private readonly validator: InputValidator,
    private readonly dtos: HttpDtoMapper,
  ) {}

  public register(app: FastifyInstance): void {
    app.post('/v1/places/:id/reports', async (request) => {
      const userId = await this.auth.requireUser(request);
      const { id } = this.validator.validate(PlaceIdParamsDtoSchema, request.params);
      const body = this.validator.validate(SubmitReportRequestDtoSchema, request.body);
      const output = await this.submitReport.execute({
        userId,
        placeId: id,
        result: body.result,
        ...(body.note === undefined ? {} : { note: body.note }),
      });
      return StatusChangeResponseDtoSchema.parse(this.dtos.statusChange(output));
    });

    app.delete('/v1/places/:id/reports/me', async (request) => {
      const userId = await this.auth.requireUser(request);
      const { id } = this.validator.validate(PlaceIdParamsDtoSchema, request.params);
      const output = await this.removeMyReport.execute({ userId, placeId: id });
      return StatusChangeResponseDtoSchema.parse(this.dtos.statusChange(output));
    });
  }
}
