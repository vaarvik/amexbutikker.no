import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ValidationError } from '@amexbutikker/contracts';
import type {
  Clock,
  PasskeyChallengePurpose,
  PasskeyChallengeService,
} from '@amexbutikker/contracts';

const PURPOSES: readonly PasskeyChallengePurpose[] = ['register', 'sign_in'];
/** purpose (1) | expires, unix seconds (8) | random (16) */
const BODY_LENGTH = 25;
const MAC_LENGTH = 32;

/**
 * Challenges that carry their own purpose and expiry, signed with HMAC-SHA256 and encoded
 * base64url, so the server needs no store between a ceremony's two requests.
 */
export class HmacPasskeyChallengeService implements PasskeyChallengeService {
  private readonly key: Buffer;

  /** @throws Error when the secret is shorter than 32 bytes. */
  public constructor(
    secret: string,
    private readonly clock: Clock,
    private readonly ttlSeconds = 300,
  ) {
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('Passkey challenge secret must be at least 32 bytes.');
    }
    this.key = createHmac('sha256', secret).update('passkey-challenge').digest();
  }

  public issue(purpose: PasskeyChallengePurpose): string {
    const body = Buffer.alloc(BODY_LENGTH);
    body.writeUInt8(PURPOSES.indexOf(purpose), 0);
    body.writeBigUInt64BE(BigInt(this.nowSeconds() + this.ttlSeconds), 1);
    randomBytes(16).copy(body, 9);
    return Buffer.concat([body, this.mac(body)]).toString('base64url');
  }

  public verify(challenge: string, purpose: PasskeyChallengePurpose): void {
    const bytes = Buffer.from(challenge, 'base64url');
    if (bytes.length !== BODY_LENGTH + MAC_LENGTH || bytes.toString('base64url') !== challenge) {
      throw new ValidationError('Malformed passkey challenge.');
    }
    const body = bytes.subarray(0, BODY_LENGTH);
    if (!timingSafeEqual(this.mac(body), bytes.subarray(BODY_LENGTH))) {
      throw new ValidationError('This passkey challenge was not issued here.');
    }
    if (PURPOSES[body.readUInt8(0)] !== purpose) {
      throw new ValidationError('This passkey challenge is for another ceremony.');
    }
    if (Number(body.readBigUInt64BE(1)) < this.nowSeconds()) {
      throw new ValidationError('This passkey challenge has expired; try again.');
    }
  }

  private mac(body: Buffer): Buffer {
    return createHmac('sha256', this.key).update(body).digest();
  }

  private nowSeconds(): number {
    return Math.floor(this.clock.now().getTime() / 1000);
  }
}
