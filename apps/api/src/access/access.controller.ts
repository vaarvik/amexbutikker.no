import { createHash } from 'node:crypto';
import {
  PasskeyCredentialRequestDtoSchema,
  PasskeyOptionsResponseDtoSchema,
  PasskeyRegistrationOptionsRequestDtoSchema,
  UnauthenticatedError,
} from '@amexbutikker/contracts';
import type {
  CompletePasskeyRegistration,
  CompletePasskeySignIn,
  InputValidator,
  IssuedAccessSession,
  RenewAccessSession,
  StartPasskeyRegistration,
  StartPasskeySignIn,
} from '@amexbutikker/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { HttpController } from '../shared/shared.ports.js';
import { ACCESS_SESSION_COOKIE } from './access.model.js';

const COOKIE = new RegExp(`(?:^|;\\s*)${ACCESS_SESSION_COOKIE}=([^;]+)`, 'u');

/** Passkey sign-in for a private deployment. These routes are open; everything else under /v1 is not. */
export class AccessController implements HttpController {
  public constructor(
    private readonly startRegistration: StartPasskeyRegistration,
    private readonly completeRegistration: CompletePasskeyRegistration,
    private readonly startSignIn: StartPasskeySignIn,
    private readonly completeSignIn: CompletePasskeySignIn,
    private readonly renewSession: RenewAccessSession,
    private readonly validator: InputValidator,
  ) {}

  public register(app: FastifyInstance): void {
    app.post('/v1/access/registration/options', async (request) => {
      const { inviteCode } = this.validator.validate(
        PasskeyRegistrationOptionsRequestDtoSchema,
        request.body,
      );
      const clientKey = createHash('sha256').update(request.ip).digest('hex');
      const output = await this.startRegistration.execute({ inviteCode, clientKey });
      return PasskeyOptionsResponseDtoSchema.parse(output);
    });

    app.post('/v1/access/registration', async (request, reply) => {
      const { credential } = this.validator.validate(
        PasskeyCredentialRequestDtoSchema,
        request.body,
      );
      return this.signedIn(reply, await this.completeRegistration.execute({ credential }));
    });

    app.post('/v1/access/sign-in/options', async () =>
      PasskeyOptionsResponseDtoSchema.parse(await this.startSignIn.execute()),
    );

    app.post('/v1/access/sign-in', async (request, reply) => {
      const { credential } = this.validator.validate(
        PasskeyCredentialRequestDtoSchema,
        request.body,
      );
      return this.signedIn(reply, await this.completeSignIn.execute({ credential }));
    });

    app.post('/v1/access/session', async (request, reply) => {
      const token = request.headers.cookie?.match(COOKIE)?.[1];
      if (token === undefined || token === '') {
        throw new UnauthenticatedError('Sign in with your passkey.');
      }
      return this.signedIn(reply, await this.renewSession.execute({ token }));
    });
  }

  private signedIn(reply: FastifyReply, session: IssuedAccessSession): FastifyReply {
    const maxAge = Math.floor((session.expiresAt.getTime() - session.issuedAt.getTime()) / 1000);
    return reply
      .header(
        'set-cookie',
        `${ACCESS_SESSION_COOKIE}=${session.token}; Path=/; Max-Age=${String(maxAge)}; HttpOnly; Secure; SameSite=Lax`,
      )
      .header('cache-control', 'no-store')
      .status(204)
      .send();
  }
}
