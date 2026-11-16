import { UnauthenticatedError } from '@amexbutikker/contracts';
import type { FastifyRequest } from 'fastify';
import { jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { AccessAuthenticator } from './shared.ports.js';

export interface JwksAccessAuthenticatorConfig {
  /** The Access team domain, e.g. `https://johann.cloudflareaccess.com`: the token's issuer. */
  readonly issuer: string;
  /** The Access application's audience tag. */
  readonly audience: string;
}

const HEADER = 'cf-access-jwt-assertion';
const COOKIE = /(?:^|;\s*)CF_Authorization=([^;]+)/u;

/**
 * Checks the signed login Cloudflare Access adds to every request it lets through: the
 * `Cf-Access-Jwt-Assertion` header, or the `CF_Authorization` cookie. Signature against the team's
 * keys, issuer, audience and expiry.
 */
export class JwksAccessAuthenticator implements AccessAuthenticator {
  public constructor(
    private readonly keys: JWTVerifyGetKey,
    private readonly config: JwksAccessAuthenticatorConfig,
  ) {}

  public async requireAccess(request: FastifyRequest): Promise<void> {
    const token = this.token(request);
    if (token === null) {
      throw new UnauthenticatedError('Sign in through Cloudflare Access.');
    }
    try {
      await jwtVerify(token, this.keys, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
    } catch (error) {
      throw new UnauthenticatedError('The Cloudflare Access login is not valid.', {
        cause: error,
      });
    }
  }

  private token(request: FastifyRequest): string | null {
    const header = request.headers[HEADER];
    if (typeof header === 'string' && header !== '') {
      return header;
    }
    const cookie = request.headers.cookie?.match(COOKIE)?.[1];
    return cookie === undefined || cookie === '' ? null : cookie;
  }
}
