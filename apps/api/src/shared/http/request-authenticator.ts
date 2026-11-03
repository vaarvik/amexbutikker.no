import { UnauthenticatedError } from '@amexbutikker/contracts';
import type { DeviceTokenService, UserId } from '@amexbutikker/contracts';
import type { FastifyRequest } from 'fastify';

/** Identifies the device behind a request. */
export interface RequestAuthenticator {
  /** @throws UnauthenticatedError when no valid token is sent. */
  requireUser(request: FastifyRequest): Promise<UserId>;
  /**
   * @returns null when no token is sent.
   * @throws UnauthenticatedError when a token is sent but is invalid.
   */
  optionalUser(request: FastifyRequest): Promise<UserId | null>;
}

/** `Authorization: Bearer <device token>`. */
export class BearerTokenAuthenticator implements RequestAuthenticator {
  public constructor(private readonly tokens: DeviceTokenService) {}

  public async requireUser(request: FastifyRequest): Promise<UserId> {
    const userId = await this.optionalUser(request);
    if (userId === null) {
      throw new UnauthenticatedError();
    }
    return userId;
  }

  public optionalUser(request: FastifyRequest): Promise<UserId | null> {
    const header = request.headers.authorization;
    if (header === undefined) {
      return Promise.resolve(null);
    }
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    const token = match?.[1];
    if (token === undefined) {
      return Promise.reject(
        new UnauthenticatedError('Authorization must be "Bearer <device token>".'),
      );
    }
    return this.tokens.verify(token);
  }
}
