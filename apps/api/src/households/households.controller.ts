import {
  AppendHouseholdRecordsRequestDtoSchema,
  AppendHouseholdRecordsResponseDtoSchema,
  CreateHouseholdRequestDtoSchema,
  HouseholdIdSchema,
  HouseholdRecordListQueryDtoSchema,
  HouseholdRecordListResponseDtoSchema,
  HouseholdResponseDtoSchema,
  JoinHouseholdRequestDtoSchema,
} from '@amexbutikker/contracts';
import type {
  AppendHouseholdRecords,
  CreateHousehold,
  GetMyHousehold,
  InputValidator,
  JoinHousehold,
  LeaveHousehold,
  ListHouseholdRecords,
} from '@amexbutikker/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HttpController, RequestAuthenticator } from '../shared/shared.ports.js';

const HouseholdParamsSchema = z.object({ id: HouseholdIdSchema });

/**
 * Households relay sealed records between phones. Every endpoint needs the device token; nothing
 * here can read what the records hold.
 */
export class HouseholdsController implements HttpController {
  public constructor(
    private readonly createHousehold: CreateHousehold,
    private readonly joinHousehold: JoinHousehold,
    private readonly leaveHousehold: LeaveHousehold,
    private readonly getMyHousehold: GetMyHousehold,
    private readonly appendRecords: AppendHouseholdRecords,
    private readonly listRecords: ListHouseholdRecords,
    private readonly auth: RequestAuthenticator,
    private readonly validator: InputValidator,
  ) {}

  public register(app: FastifyInstance): void {
    app.post('/v1/households', async (request, reply) => {
      const userId = await this.auth.requireUser(request);
      const { joinToken } = this.validator.validate(CreateHouseholdRequestDtoSchema, request.body);
      const output = await this.createHousehold.execute({ userId, joinToken });
      return reply.status(201).send(HouseholdResponseDtoSchema.parse(output));
    });

    app.post('/v1/households/:id/members', async (request) => {
      const userId = await this.auth.requireUser(request);
      const { id } = this.validator.validate(HouseholdParamsSchema, request.params);
      const { joinToken } = this.validator.validate(JoinHouseholdRequestDtoSchema, request.body);
      const output = await this.joinHousehold.execute({ userId, householdId: id, joinToken });
      return HouseholdResponseDtoSchema.parse(output);
    });

    app.get('/v1/households/me', async (request, reply) => {
      const userId = await this.auth.requireUser(request);
      const output = await this.getMyHousehold.execute({ userId });
      return reply
        .header('cache-control', 'no-store')
        .send(HouseholdResponseDtoSchema.parse(output));
    });

    app.delete('/v1/households/me', async (request, reply) => {
      const userId = await this.auth.requireUser(request);
      await this.leaveHousehold.execute({ userId });
      return reply.status(204).send();
    });

    app.post('/v1/households/me/records', async (request) => {
      const userId = await this.auth.requireUser(request);
      const { records } = this.validator.validate(
        AppendHouseholdRecordsRequestDtoSchema,
        request.body,
      );
      const output = await this.appendRecords.execute({
        userId,
        sealed: records.map((record) => record.sealed),
      });
      return AppendHouseholdRecordsResponseDtoSchema.parse(output);
    });

    app.get('/v1/households/me/records', async (request, reply) => {
      const userId = await this.auth.requireUser(request);
      const query = this.validator.validate(HouseholdRecordListQueryDtoSchema, request.query);
      const output = await this.listRecords.execute({
        userId,
        afterSeq: query.after,
        limit: query.limit,
      });
      return reply
        .header('cache-control', 'no-store')
        .send(HouseholdRecordListResponseDtoSchema.parse(output));
    });
  }
}
