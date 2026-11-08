import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ValidationError } from '@amexbutikker/contracts';
import type { AttestationChallengeService, Clock, UserId } from '@amexbutikker/contracts';

export interface HmacAttestationChallengeServiceConfig {
  /** Shared with the device tokens; a separate key is derived from it. At least 32 bytes. */
  readonly secret: string;
  readonly ttlSeconds: number;
}

const VERSION = 'c1';

/**
 * `c1.<expires, unix seconds>.<random nonce>.<HMAC over device, expiry and nonce>`. Stateless: a
 * challenge can be used again until it expires, but only by the device it was issued to, and an
 * App Attest key can attest one device only.
 */
export class HmacAttestationChallengeService implements AttestationChallengeService {
  private readonly key: Buffer;

  /** @throws Error when the secret is shorter than 32 bytes. */
  public constructor(
    private readonly config: HmacAttestationChallengeServiceConfig,
    private readonly clock: Clock,
  ) {
    if (Buffer.byteLength(config.secret, 'utf8') < 32) {
      throw new Error('Attestation challenge secret must be at least 32 bytes.');
    }
    this.key = createHmac('sha256', config.secret).update('attestation-challenge').digest();
  }

  public issue(userId: UserId): string {
    const expires = String(Math.floor(this.clock.now().getTime() / 1000) + this.config.ttlSeconds);
    const nonce = randomBytes(16).toString('base64url');
    return `${VERSION}.${expires}.${nonce}.${this.sign(userId, expires, nonce)}`;
  }

  public verify(userId: UserId, challenge: string): void {
    const [version, expires, nonce, signature, ...rest] = challenge.split('.');
    if (
      version !== VERSION ||
      expires === undefined ||
      !/^\d+$/.test(expires) ||
      nonce === undefined ||
      signature === undefined ||
      rest.length > 0
    ) {
      throw this.rejected('is malformed');
    }
    const expected = Buffer.from(this.sign(userId, expires, nonce), 'base64url');
    const given = Buffer.from(signature, 'base64url');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw this.rejected('was not issued to this device');
    }
    if (Number(expires) * 1000 < this.clock.now().getTime()) {
      throw this.rejected('has expired');
    }
  }

  private sign(userId: UserId, expires: string, nonce: string): string {
    return createHmac('sha256', this.key)
      .update(`${VERSION}|${userId}|${expires}|${nonce}`)
      .digest('base64url');
  }

  private rejected(reason: string): ValidationError {
    return new ValidationError('The attestation challenge was rejected.', [
      { path: ['challenge'], message: reason },
    ]);
  }
}
