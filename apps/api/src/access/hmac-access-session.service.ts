import { createHmac, timingSafeEqual } from 'node:crypto';
import { PasskeyIdSchema, UnauthenticatedError } from '@amexbutikker/contracts';
import type {
  AccessSession,
  AccessSessionService,
  Clock,
  IssuedAccessSession,
  PasskeyId,
} from '@amexbutikker/contracts';
import { z } from 'zod';

const PayloadSchema = z.object({ sub: PasskeyIdSchema, iat: z.int().positive() });
const VERSION = 's1';
const DAY_MS = 86_400_000;

/**
 * Stateless signed sessions: `s1.<base64url payload>.<base64url HMAC-SHA256>`, the payload
 * holding the passkey id and issue time. Rotating the secret signs every browser out.
 */
export class HmacAccessSessionService implements AccessSessionService {
  private readonly key: Buffer;

  /** @throws Error when the secret is shorter than 32 bytes. */
  public constructor(
    secret: string,
    private readonly clock: Clock,
    private readonly maxAgeDays = 365,
  ) {
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('Access session secret must be at least 32 bytes.');
    }
    this.key = createHmac('sha256', secret).update('access-session').digest();
  }

  public issue(passkeyId: PasskeyId): IssuedAccessSession {
    const now = this.clock.now();
    const issuedAt = new Date(Math.floor(now.getTime() / 1000) * 1000);
    const payload = Buffer.from(
      JSON.stringify({ sub: passkeyId, iat: issuedAt.getTime() / 1000 }),
    ).toString('base64url');
    const body = `${VERSION}.${payload}`;
    return {
      token: `${body}.${this.sign(body)}`,
      passkeyId,
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + this.maxAgeDays * DAY_MS),
    };
  }

  public verify(token: string): AccessSession {
    const [version, payload, signature, ...rest] = token.split('.');
    if (
      version !== VERSION ||
      payload === undefined ||
      signature === undefined ||
      rest.length > 0
    ) {
      throw new UnauthenticatedError('Malformed session.');
    }
    const expected = Buffer.from(this.sign(`${version}.${payload}`), 'base64url');
    const given = Buffer.from(signature, 'base64url');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new UnauthenticatedError('Invalid session signature.');
    }
    const parsed = PayloadSchema.safeParse(this.decode(payload));
    if (!parsed.success) {
      throw new UnauthenticatedError('Malformed session.');
    }
    const issuedAt = new Date(parsed.data.iat * 1000);
    if (this.clock.now().getTime() - issuedAt.getTime() > this.maxAgeDays * DAY_MS) {
      throw new UnauthenticatedError('The session has expired.');
    }
    return { passkeyId: parsed.data.sub, issuedAt };
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
