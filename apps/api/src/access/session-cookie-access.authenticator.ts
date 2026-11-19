import { UnauthenticatedError } from '@amexbutikker/contracts';
import type { AccessSessionService, PasskeyReader } from '@amexbutikker/contracts';
import type { FastifyRequest } from 'fastify';
import type { AccessAuthenticator } from '../shared/shared.ports.js';
import { ACCESS_SESSION_COOKIE } from './access.model.js';

const COOKIE = new RegExp(`(?:^|;\\s*)${ACCESS_SESSION_COOKIE}=([^;]+)`, 'u');

/**
 * Lets a request in when it carries the session cookie of a stored passkey. Removing the passkey
 * from the database signs its browsers out.
 */
export class SessionCookieAccessAuthenticator implements AccessAuthenticator {
  public constructor(
    private readonly sessions: AccessSessionService,
    private readonly passkeys: PasskeyReader,
  ) {}

  public async requireAccess(request: FastifyRequest): Promise<void> {
    const token = request.headers.cookie?.match(COOKIE)?.[1];
    if (token === undefined || token === '') {
      throw new UnauthenticatedError('Sign in with your passkey.');
    }
    const { passkeyId } = this.sessions.verify(token);
    if ((await this.passkeys.findById(passkeyId)) === null) {
      throw new UnauthenticatedError('The passkey behind this session was removed.');
    }
  }
}
