import { createHash } from 'node:crypto';
import {
  RegisterDeviceRequestDtoSchema,
  RegisterDeviceResponseDtoSchema,
} from '@amexbutikker/contracts';
import type { InputValidator, RegisterDevice } from '@amexbutikker/contracts';
import type { FastifyInstance } from 'fastify';
import type { HttpController } from '../shared/shared.ports.js';

export class DevicesController implements HttpController {
  public constructor(
    private readonly registerDevice: RegisterDevice,
    private readonly validator: InputValidator,
  ) {}

  public register(app: FastifyInstance): void {
    app.post('/v1/devices', async (request, reply) => {
      const { platform } = this.validator.validate(RegisterDeviceRequestDtoSchema, request.body);
      const clientKey = createHash('sha256').update(request.ip).digest('hex');
      const output = await this.registerDevice.execute({ platform, clientKey });
      return reply.status(201).send(RegisterDeviceResponseDtoSchema.parse(output));
    });
  }
}
