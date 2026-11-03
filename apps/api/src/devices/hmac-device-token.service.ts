import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthenticatedError, UserIdSchema } from '@amexbutikker/contracts';
import type { Clock, DeviceTokenService, IssuedDeviceToken, UserId } from '@amexbutikker/contracts';
import { z } from 'zod';

const PayloadSchema = z.object({ sub: UserIdSchema, iat: z.int().positive() });
const VERSION = 'v1';

/**
 * Stateless signed tokens: `v1.<base64url payload>.<base64url HMAC-SHA256>`. The payload holds
 * the user id and issue time. Rotating the secret signs every device out.
 */
export class HmacDeviceTokenService implements DeviceTokenService {
  private readonly key: Buffer;

  /** @throws Error when the secret is shorter than 32 bytes. */
  public constructor(
    secret: string,
    private readonly clock: Clock,
    private readonly maxAgeDays = 365,
  ) {
    this.key = Buffer.from(secret, 'utf8');
    if (this.key.length < 32) {
      throw new Error('Device token secret must be at least 32 bytes.');
    }
  }

  public issue(userId: UserId): Promise<IssuedDeviceToken> {
    const issuedAt = this.clock.now();
    const payload = Buffer.from(
      JSON.stringify({ sub: userId, iat: Math.floor(issuedAt.getTime() / 1000) }),
    ).toString('base64url');
    const body = `${VERSION}.${payload}`;
    return Promise.resolve({ token: `${body}.${this.sign(body)}`, userId, issuedAt });
  }

  public verify(token: string): Promise<UserId> {
    const [version, payload, signature, ...rest] = token.split('.');
    if (
      version !== VERSION ||
      payload === undefined ||
      signature === undefined ||
      rest.length > 0
    ) {
      return Promise.reject(new UnauthenticatedError('Malformed device token.'));
    }
    const expected = Buffer.from(this.sign(`${version}.${payload}`), 'base64url');
    const given = Buffer.from(signature, 'base64url');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return Promise.reject(new UnauthenticatedError('Invalid device token signature.'));
    }
    const parsed = PayloadSchema.safeParse(this.decode(payload));
    if (!parsed.success) {
      return Promise.reject(new UnauthenticatedError('Malformed device token.'));
    }
    const ageDays = (this.clock.now().getTime() / 1000 - parsed.data.iat) / 86_400;
    if (ageDays > this.maxAgeDays) {
      return Promise.reject(new UnauthenticatedError('Device token has expired.'));
    }
    return Promise.resolve(parsed.data.sub);
  }

  private sign(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }

  private decode(payload: string): unknown {
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return undefined;
    }
  }
}
