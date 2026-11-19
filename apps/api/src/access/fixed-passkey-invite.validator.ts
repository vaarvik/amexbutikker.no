import { createHash, timingSafeEqual } from 'node:crypto';
import { ValidationError } from '@amexbutikker/contracts';
import type { PasskeyInviteValidator } from '@amexbutikker/contracts';

/** One invite code from the environment; without one, no passkey can be added. */
export class FixedPasskeyInviteValidator implements PasskeyInviteValidator {
  private readonly expected: Buffer | null;

  public constructor(inviteCode: string | null) {
    this.expected = inviteCode === null ? null : this.digest(inviteCode);
  }

  public validate(inviteCode: string): void {
    if (this.expected === null) {
      throw new ValidationError('No new passkeys can be added.');
    }
    if (!timingSafeEqual(this.digest(inviteCode), this.expected)) {
      throw new ValidationError('Wrong invite code.');
    }
  }

  /** Equal lengths for timingSafeEqual, whatever was typed. */
  private digest(code: string): Buffer {
    return createHash('sha256').update(code.trim()).digest();
  }
}
