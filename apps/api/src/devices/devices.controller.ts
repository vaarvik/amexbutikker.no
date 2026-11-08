import { createHash } from 'node:crypto';
import {
  AttestDeviceRequestDtoSchema,
  AttestDeviceResponseDtoSchema,
  AttestationChallengeResponseDtoSchema,
  RegisterDeviceRequestDtoSchema,
  RegisterDeviceResponseDtoSchema,
} from '@amexbutikker/contracts';
import type {
  AttestDevice,
  InputValidator,
  IssueAttestationChallenge,
  RegisterDevice,
} from '@amexbutikker/contracts';
import type { FastifyInstance } from 'fastify';
import type { HttpController, RequestAuthenticator } from '../shared/shared.ports.js';

export class DevicesController implements HttpController {
  public constructor(
    private readonly registerDevice: RegisterDevice,
    private readonly issueChallenge: IssueAttestationChallenge,
    private readonly attestDevice: AttestDevice,
    private readonly auth: RequestAuthenticator,
    private readonly validator: InputValidator,
  ) {}

  public register(app: FastifyInstance): void {
    app.post('/v1/devices', async (request, reply) => {
      const { platform } = this.validator.validate(RegisterDeviceRequestDtoSchema, request.body);
      const clientKey = createHash('sha256').update(request.ip).digest('hex');
      const output = await this.registerDevice.execute({ platform, clientKey });
      return reply.status(201).send(RegisterDeviceResponseDtoSchema.parse(output));
    });

    app.post('/v1/devices/me/challenge', async (request) => {
      const userId = await this.auth.requireUser(request);
      const output = await this.issueChallenge.execute({ userId });
      return AttestationChallengeResponseDtoSchema.parse(output);
    });

    app.post('/v1/devices/me/attestation', async (request) => {
      const userId = await this.auth.requireUser(request);
      const proof = this.validator.validate(AttestDeviceRequestDtoSchema, request.body);
      const output = await this.attestDevice.execute({ userId, proof });
      return AttestDeviceResponseDtoSchema.parse(output);
    });
  }
}
